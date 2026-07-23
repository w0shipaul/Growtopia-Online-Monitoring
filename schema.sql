CREATE TABLE IF NOT EXISTS webhook_state (
  webhook_id TEXT PRIMARY KEY,
  message_id TEXT,
  previous_count INTEGER,
  last_updated TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_state_last_updated
  ON webhook_state(last_updated);
