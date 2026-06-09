DROP TABLE IF EXISTS stock_prices;

CREATE TABLE stock_prices (
    ticker     TEXT        NOT NULL,
    price      NUMERIC     NOT NULL,
    volume     BIGINT,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('stock_prices', 'timestamp');

CREATE INDEX ON stock_prices (ticker, timestamp DESC);