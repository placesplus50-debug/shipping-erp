-- Extend existing outbox constraints for FOLLOWUPS while preserving all existing rows.
-- Apply once on Production D1; no collection or tracking records are deleted.
BEGIN TRANSACTION;
CREATE TABLE sheet_sync_outbox_v2 (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_type TEXT NOT NULL CHECK(event_type IN ('driver_status','collection','review','handover','followup')),
 event_id INTEGER NOT NULL,
 destination_tab TEXT NOT NULL CHECK(destination_tab IN ('TRACKING','COLLECTIONS','FOLLOWUPS')),
 payload_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','error')),
 attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 synced_at TEXT,
 UNIQUE(event_type,event_id)
);
INSERT INTO sheet_sync_outbox_v2(id,event_type,event_id,destination_tab,payload_json,state,attempts,last_error,created_at,synced_at)
SELECT id,event_type,event_id,destination_tab,payload_json,state,attempts,last_error,created_at,synced_at FROM sheet_sync_outbox;
DROP TABLE sheet_sync_outbox;
ALTER TABLE sheet_sync_outbox_v2 RENAME TO sheet_sync_outbox;
CREATE INDEX idx_sheet_sync_pending ON sheet_sync_outbox(state,id);
COMMIT;
