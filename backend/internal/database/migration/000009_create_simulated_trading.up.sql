ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) NOT NULL DEFAULT 100000.00;

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    ticker TEXT NOT NULL,
    side VARCHAR(4) NOT NULL, 
    quantity NUMERIC(12, 4) NOT NULL,
    entry_price NUMERIC(12, 4) NOT NULL,
    exit_price NUMERIC(12, 4),
    stop_loss NUMERIC(12, 4),
    take_profit NUMERIC(12, 4),
    status VARCHAR(10) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS positions_user_id_idx ON positions (user_id);