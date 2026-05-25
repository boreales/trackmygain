-- Reset previous_price_eur so the next price refresh re-baselines the trend:
-- the normal cycle (previous ← last, last ← new) will then produce a real
-- variation instead of the misleading 0 left over from the initial bootstrap.
UPDATE account
SET previous_price_eur = NULL
WHERE last_price_eur IS NOT NULL
  AND previous_price_eur IS NOT NULL
  AND previous_price_eur = last_price_eur;
