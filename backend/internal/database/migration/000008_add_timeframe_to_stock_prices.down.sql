DROP INDEX IF EXISTS stock_prices_ticker_ts_tf_idx;


ALTER TABLE stock_prices DROP COLUMN IF EXISTS timeframe;