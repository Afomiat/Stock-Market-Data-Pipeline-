CREATE TABLE notifications(
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id         UUID        NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    ticker           TEXT        NOT NULL,
    price_at_trigger NUMERIC     NOT NULL,
    triggered_at     TIMESTAMPTZ DEFAULT NOW()
);