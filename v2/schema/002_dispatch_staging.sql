// Proposed staging-only migration. Never apply to production without backup and verification.
// Assignment overrides are isolated from the original Google Sheet.
CREATE TABLE IF NOT EXISTS v2_dispatch_assignments (
  order_id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_v2_dispatch_driver ON v2_dispatch_assignments(driver_id);
