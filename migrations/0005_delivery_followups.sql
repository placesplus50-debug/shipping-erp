CREATE TABLE IF NOT EXISTS delivery_followups (
 order_id TEXT PRIMARY KEY,
 driver_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 action_required TEXT NOT NULL DEFAULT 'review',
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 100),
 updated_by INTEGER NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_followups_driver ON delivery_followups(driver_id);
