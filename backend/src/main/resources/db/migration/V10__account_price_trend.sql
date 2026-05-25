-- Track per-account unit price over the two most recent refreshes, so the
-- price-only trend can be derived as (last - previous) * currentBalance.
ALTER TABLE account
    ADD COLUMN last_price_eur     NUMERIC(20, 8),
    ADD COLUMN previous_price_eur NUMERIC(20, 8);
