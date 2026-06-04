CREATE TABLE alerts(
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker       TEXT        NOT NULL,
    target_price NUMERIC     NOT NULL,
    condition    TEXT        NOT NULL CHECK (condition IN ('above', 'below')),
    is_active    BOOLEAN     DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);