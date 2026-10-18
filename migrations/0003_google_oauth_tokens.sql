-- Preview only. Stores encrypted Google OAuth refresh tokens, never plaintext.
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  refresh_token_ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
