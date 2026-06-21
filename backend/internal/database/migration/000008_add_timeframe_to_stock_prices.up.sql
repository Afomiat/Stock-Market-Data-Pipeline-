TRUNCATE TABLE stock_prices;

ALTER TABLE stock_prices ADD COLUMN timeframe VARCHAR(5) DEFAULT '1h';

CREATE UNIQUE INDEX stock_prices_ticker_ts_tf_idx ON stock_prices (ticker, timestamp, timeframe);

