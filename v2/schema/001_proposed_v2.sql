-- PROPOSAL ONLY. DO NOT APPLY TO PRODUCTION. Requires D1 schema review and staging backup.
-- Every v2 table is namespaced to avoid altering legacy financial or order records.
CREATE TABLE IF NOT EXISTS v2_sources (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 spreadsheet_id TEXT NOT NULL,
 sheet_range TEXT NOT NULL,
 mapping_json TEXT NOT NULL,
 is_enabled INTEGER NOT NULL DEFAULT 0 CHECK(is_enabled IN (0,1)),
 read_only INTEGER NOT NULL DEFAULT 1 CHECK(read_only=1),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS v2_orders (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES v2_sources(id),
 external_order_id TEXT NOT NULL,
 customer TEXT NOT NULL,
 driver_id TEXT,
 cod_due_cents INTEGER NOT NULL DEFAULT 0 CHECK(cod_due_cents>=0),
 imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(source_id,external_order_id)
);
CREATE INDEX IF NOT EXISTS idx_v2_orders_driver ON v2_orders(driver_id);
CREATE TABLE IF NOT EXISTS v2_order_events (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES v2_orders(id),
 actor_user_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 event_json TEXT NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS v2_finance_events (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES v2_orders(id),
 actor_user_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('collection','handover','reversal','adjustment')),
 amount_cents INTEGER NOT NULL,
 method TEXT,
 holder TEXT,
 reverses_event_id TEXT REFERENCES v2_finance_events(id),
 request_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_v2_finance_order ON v2_finance_events(order_id);
CREATE TABLE IF NOT EXISTS v2_delivery_proofs (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES v2_orders(id),
 actor_user_id TEXT NOT NULL,
 proof_type TEXT NOT NULL CHECK(proof_type IN ('photo','signature','otp')),
 storage_key TEXT,
 verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS v2_notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 read_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
