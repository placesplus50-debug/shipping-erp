-- Apply to shipping-pulse-db before deploying updated login endpoint.
CREATE TABLE IF NOT EXISTS auth_attempts (
  identity_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_blocked ON auth_attempts(blocked_until);
