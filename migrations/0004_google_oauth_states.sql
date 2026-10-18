CREATE TABLE IF NOT EXISTS google_oauth_states (
 state TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 expires_at TEXT NOT NULL
);
