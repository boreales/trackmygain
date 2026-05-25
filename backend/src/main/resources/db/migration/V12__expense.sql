CREATE TABLE expense (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount >= 0),
    date DATE NOT NULL,
    recurring BOOLEAN NOT NULL DEFAULT false,
    category VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_date ON expense(date);
CREATE INDEX idx_expense_category ON expense(category);
