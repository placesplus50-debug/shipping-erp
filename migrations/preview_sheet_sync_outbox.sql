-- Preview-only outbox. Apply to Preview D1 before enabling Google Sheets writes.
-- One row per immutable business event; no data is deleted from ORDERS.
CREATE TABLE IF NOT EXISTS sheet_sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('driver_status','collection','review','handover')),
  event_id INTEGER NOT NULL,
  destination_tab TEXT NOT NULL CHECK(destination_tab IN ('TRACKING','COLLECTIONS')),
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','error')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  UNIQUE(event_type,event_id)
);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_pending ON sheet_sync_outbox(state,id);
