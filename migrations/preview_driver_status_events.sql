-- Preview D1 only: shipping-pulse-preview-db. Does not modify Google Sheets.
CREATE TABLE IF NOT EXISTS driver_status_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL,
 driver_id TEXT NOT NULL,
 actor_user_id INTEGER NOT NULL,
 previous_status TEXT NOT NULL,
 new_status TEXT NOT NULL CHECK(new_status IN ('Assigned','Out for delivery','Delivered','Returned','Delivery failed')),
 request_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_driver_status_events_order ON driver_status_events(order_id,id);
CREATE INDEX IF NOT EXISTS idx_driver_status_events_driver ON driver_status_events(driver_id,id);
