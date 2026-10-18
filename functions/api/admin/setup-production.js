import {reply,currentUser} from "../auth/_utils.js";
// Temporary, admin-only, idempotent production schema setup. No business records are modified.
const statements=[
  "CREATE TABLE IF NOT EXISTS collection_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, driver_id TEXT NOT NULL, actor_user_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0), method TEXT NOT NULL, holder TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS collection_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id INTEGER NOT NULL UNIQUE, reviewer_user_id INTEGER NOT NULL, decision TEXT NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS cash_handover (\n id INTEGER PRIMARY KEY AUTOINCREMENT,\n collection_id INTEGER NOT NULL UNIQUE REFERENCES collection_events(id),\n reviewer_user_id INTEGER NOT NULL,\n amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),\n destination TEXT NOT NULL CHECK(destination IN ('cashbox','bank')),\n note TEXT NOT NULL DEFAULT '',\n created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\n)",
  "CREATE INDEX IF NOT EXISTS idx_cash_handover_date ON cash_handover(created_at)",
  "CREATE TABLE IF NOT EXISTS sheet_sync_outbox (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  event_type TEXT NOT NULL CHECK(event_type IN ('driver_status','collection','review','handover')),\n  event_id INTEGER NOT NULL,\n  destination_tab TEXT NOT NULL CHECK(destination_tab IN ('TRACKING','COLLECTIONS')),\n  payload_json TEXT NOT NULL,\n  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','error')),\n  attempts INTEGER NOT NULL DEFAULT 0,\n  last_error TEXT,\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  synced_at TEXT,\n  UNIQUE(event_type,event_id)\n)",
  "CREATE INDEX IF NOT EXISTS idx_sheet_sync_pending ON sheet_sync_outbox(state,id)"
];
export async function onRequestGet({request,env}){
 const actor=await currentUser(request,env).catch(()=>null);
 if(!actor||actor.role!=="super_admin")return reply({error:"Forbidden"},403);
 if(new URL(request.url).origin!=="https://shipping-erp.pages.dev")return reply({error:"Production only"},403);
 if(!env.DB)return reply({error:"Database unavailable"},503);
 try{
  for(const statement of statements)await env.DB.prepare(statement).run();
  const {results}=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('driver_status_events','collection_events','collection_reviews','cash_handover','sheet_sync_outbox') ORDER BY name").all();
  return reply({ok:true,createdOrVerified:results.map(x=>x.name),message:"Production schema ready. Preview data not copied. Sheets sync unchanged."});
 }catch{return reply({error:"Schema setup failed; inspect D1 logs",code:"SCHEMA_SETUP_FAILED"},503)}
}
