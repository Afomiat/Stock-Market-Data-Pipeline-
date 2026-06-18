CREATE TABLE stock_prices(
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker     TEXT        NOT NULL,
    price      NUMERIC     NOT NULL,
    volume     BIGINT,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);