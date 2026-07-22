CREATE TABLE IF NOT EXISTS monitor_state (
  id INTEGER PRIMARY KEY,
  message_id TEXT,
  previous_count INTEGER,
  last_updated TEXT
);
