-- Store the EUR-converted balance at snapshot time so historical net-worth /
-- per-account trends do not depend on today's prices.
ALTER TABLE balance_snapshot
    ADD COLUMN balance_eur NUMERIC(20, 8);

-- Best-effort backfill: assume snapshots for EUR accounts were already in EUR.
-- Non-EUR (crypto / foreign stocks) stays NULL — the historical FX/price is
-- unknown; new snapshots will be populated from now on.
UPDATE balance_snapshot s
SET balance_eur = s.balance
FROM account a
WHERE s.account_id = a.id
  AND a.currency = 'EUR';
