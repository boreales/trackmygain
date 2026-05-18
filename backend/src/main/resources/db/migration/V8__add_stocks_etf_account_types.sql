-- V8: Add STOCKS and ETF values to the account_type enum so users can track
-- equities and exchange-traded funds as first-class account categories
-- (distinct from generic COMPTE_TITRES brokerage accounts).

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'STOCKS';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'ETF';
