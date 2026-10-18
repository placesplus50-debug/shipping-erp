-- Preview D1 only: accountant-confirmed handover of approved cash collections.
CREATE TABLE IF NOT EXISTS cash_handover (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 collection_id INTEGER NOT NULL UNIQUE REFERENCES collection_events(id),
 reviewer_user_id INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 destination TEXT NOT NULL CHECK(destination IN ('cashbox','bank')),
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cash_handover_date ON cash_handover(created_at);
