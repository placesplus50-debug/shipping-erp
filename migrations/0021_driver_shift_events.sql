CREATE TABLE IF NOT EXISTS driver_shift_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 driver_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('shift_start','shift_end','sharing_start','sharing_stop')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_shift_events_driver ON driver_shift_events(driver_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_shift_events_time ON driver_shift_events(created_at);
