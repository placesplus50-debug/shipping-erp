CREATE TABLE IF NOT EXISTS driver_live_locations (
 driver_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 latitude REAL NOT NULL,
 longitude REAL NOT NULL,
 accuracy_m REAL NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_updated ON driver_live_locations(updated_at);
