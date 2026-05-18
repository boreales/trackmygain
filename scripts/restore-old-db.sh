#!/usr/bin/env bash
#
# Restore the project's Postgres DB from a snapshot of an older same-project
# container. WIPES the current pgdata volume.
#
# Usage:
#   scripts/restore-old-db.sh <source-container-id-or-name>
#
# Flow:
#   1. pg_dump from the source container (started on the fly if needed)
#   2. docker compose down -v   -> drops the current pgdata volume
#   3. docker compose up -d db  -> fresh, empty Postgres
#   4. psql < dump              -> restore objects + data
#   5. docker compose up -d     -> backend boots, Flyway applies any newer
#                                  migrations on top of the restored history
#
# Requirements: docker, docker compose. Run from anywhere -- script cd's to
# the repo root automatically. A .env file at the repo root is used to read
# POSTGRES_DB / POSTGRES_USER for the destination (defaults: picsou/picsou).
#
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <source-container-id-or-name>" >&2
    exit 1
fi

SRC="$1"
DUMP_FILE="${DUMP_FILE:-/tmp/picsou-restore-$(date +%Y%m%d-%H%M%S).sql}"

# Move to project root (parent of scripts/)
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> Project root:     ${ROOT}"
echo "==> Source container: ${SRC}"
echo "==> Dump file:        ${DUMP_FILE}"
echo

# --- 1. Locate / start the source container ---------------------------------

if ! docker inspect "${SRC}" >/dev/null 2>&1; then
    echo "[ERROR] No container matches '${SRC}'." >&2
    echo "  Tip: docker ps -a   (to list stopped containers too)" >&2
    exit 1
fi

if [ "$(docker inspect -f '{{.State.Running}}' "${SRC}")" != "true" ]; then
    echo "==> Source container is stopped, starting it..."
    docker start "${SRC}" >/dev/null
    sleep 2
fi

# --- 2. Detect source DB / user ---------------------------------------------

SRC_DB=$(docker exec "${SRC}" sh -c 'printf %s "${POSTGRES_DB:-}"')
SRC_USER=$(docker exec "${SRC}" sh -c 'printf %s "${POSTGRES_USER:-}"')
SRC_DB=${SRC_DB:-picsou}
SRC_USER=${SRC_USER:-picsou}
echo "==> Source: db=${SRC_DB} user=${SRC_USER}"

# --- 3. Detect destination DB / user from .env ------------------------------

if [ ! -f .env ]; then
    echo "[ERROR] No .env at ${ROOT} -- required to know POSTGRES_DB / POSTGRES_USER." >&2
    echo "  Copy .env.example to .env and fill in the credentials, then re-run." >&2
    exit 1
fi
DEST_DB=$(awk -F= '/^POSTGRES_DB=/ {sub(/\r$/,"",$2); print $2; exit}' .env)
DEST_USER=$(awk -F= '/^POSTGRES_USER=/ {sub(/\r$/,"",$2); print $2; exit}' .env)
DEST_DB=${DEST_DB:-picsou}
DEST_USER=${DEST_USER:-picsou}
echo "==> Target: db=${DEST_DB} user=${DEST_USER}"

# --- 4. Locate destination volume -------------------------------------------

COMPOSE_PROJECT=$(basename "${ROOT}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
DEST_VOLUME=$(docker volume ls --quiet \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.volume=pgdata" 2>/dev/null | head -1)
DEST_VOLUME=${DEST_VOLUME:-${COMPOSE_PROJECT}_pgdata}
echo "==> Will wipe volume: ${DEST_VOLUME}"

# --- 5. Confirm -------------------------------------------------------------

echo
echo "WARNING: the current contents of '${DEST_VOLUME}' will be replaced"
echo "         by a dump of ${SRC} (${SRC_DB})."
read -rp "Type 'yes' to continue: " ans
[ "${ans}" = "yes" ] || { echo "Aborted."; exit 1; }

# --- 6. Dump from source ----------------------------------------------------

echo
echo "==> Dumping ${SRC_DB} from ${SRC}..."
docker exec "${SRC}" pg_dump \
    -U "${SRC_USER}" -d "${SRC_DB}" \
    --clean --if-exists --no-owner --no-privileges \
    > "${DUMP_FILE}"

if [ ! -s "${DUMP_FILE}" ]; then
    echo "[ERROR] Dump is empty. Aborting before wipe." >&2
    exit 1
fi
echo "    Saved $(du -h "${DUMP_FILE}" | cut -f1) -> ${DUMP_FILE}"

# --- 7. Tear down current stack + volume ------------------------------------

echo
echo "==> Stopping current stack and dropping volumes..."
docker compose down -v

# --- 8. Bring up empty DB and wait ------------------------------------------

echo "==> Starting empty Postgres..."
docker compose up -d db

echo -n "==> Waiting for DB readiness "
ready=0
for _ in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U "${DEST_USER}" >/dev/null 2>&1; then
        ready=1
        echo " OK"
        break
    fi
    echo -n "."
    sleep 1
done
if [ "${ready}" -ne 1 ]; then
    echo
    echo "[ERROR] DB never became ready. Check: docker compose logs db" >&2
    exit 1
fi

# --- 9. Restore the dump ----------------------------------------------------

echo "==> Restoring dump into ${DEST_DB}..."
docker compose exec -T db psql -v ON_ERROR_STOP=1 \
    -U "${DEST_USER}" -d "${DEST_DB}" < "${DUMP_FILE}"

# --- 10. Bring everything else up; Flyway catches up ------------------------

echo "==> Starting backend + frontend..."
docker compose up -d

cat <<EOF

Restore complete.
  Dump kept at: ${DUMP_FILE}
  Tail logs:    docker compose logs -f backend | grep -iE 'flyway|migration'

If Flyway reports a checksum mismatch or unknown migration, run:
  docker compose exec db psql -U ${DEST_USER} -d ${DEST_DB} \\
    -c "DELETE FROM flyway_schema_history WHERE version > '8' OR description LIKE '%dropped%';"
and restart the backend.
EOF
