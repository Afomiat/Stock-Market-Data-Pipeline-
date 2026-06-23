ALTER TABLE positions 
ALTER COLUMN user_id TYPE VARCHAR(255);

DROP INDEX IF EXISTS positions_user_id_idx;

CREATE INDEX IF NOT EXISTS positions_user_id_idx ON positions (user_id);