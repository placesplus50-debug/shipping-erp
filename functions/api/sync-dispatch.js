import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
import {getAccessToken} from "./orders.js";
const spreadsheet="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
const headers={
 TRACKING:["Event ID","Order ID","Driver ID","Old Status","New Status","Event Time","Collected Cash","Collection Method","Notes","Recorded By"],
 COLLECTIONS:["Settlement ID","Order ID","Driver ID","Cash Collected","Cash Remitted","Outstanding","Remittance Date","Settlement Status","Reviewed By","Notes"]
};
const endpoint=range=>"https://sheets.googleapis.com/v4/spreadsheets/"+spreadsheet+"/values/"+encodeURIComponent(range);
async function sheets(token,range,method="GET",values){
 const url=endpoint(range)+(method==="GET"?"":method==="POST"?":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS":"?valueInputOption=RAW");
 const r=await fetch(url,{method,headers:{authorization:"Bearer "+token,...(values?{"content-type":"application/json"}:{})},body:values?JSON.stringify({values:[values]}):undefined});
 if(!r.ok)throw Error("sheets_http_"+r.status);
 return r.json();
}
async function rowFor(env,item){
 const p=JSON.parse(item.payload_json);
 if(item.destination_tab==="TRACKING")return [p.eventId,p.orderId,p.driverId,p.oldStatus,p.newStatus,p.eventTime||"",0,"","",p.recordedBy||""];
 const id=Number(String(p.settlementId||"").replace("COL-",""));
 if(!Number.isSafeInteger(id)||id<1)throw Error("bad_collection_id");
 const e=await env.DB.prepare("SELECT e.id,e.order_id,e.driver_id,e.amount_cents,e.method,e.holder,e.note,r.decision,r.reviewer_user_id,h.amount_cents AS remitted,h.created_at AS remittance_date,h.destination FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id LEFT JOIN cash_handover h ON h.collection_id=e.id WHERE e.id=?").bind(id).first();
 if(!e)throw Error("missing_collection");
 const cash=e.method==="cash"?e.amount_cents/100:0,remitted=(e.remitted||0)/100;
 return ["COL-"+id,e.order_id,e.driver_id,cash,remitted,e.method==="cash"&&e.holder==="driver"&&e.decision==="approved"?Math.max(0,cash-remitted):0,e.remittance_date||"",e.remitted!=null?"remitted":e.decision||"pending",e.reviewer_user_id||"",[e.method,e.destination,e.note].filter(Boolean).join(" | ")];
}
export async function deliver(env,token,item){
 const tab=item.destination_tab;
 if(!headers[tab])throw Error("unknown_tab");
 const existing=await sheets(token,tab+"!A1:J");
 if(JSON.stringify(existing.values?.[0]||[])!==JSON.stringify(headers[tab]))throw Error("header_mismatch");
 const row=await rowFor(env,item),matches=[];
 for(let i=1;i<(existing.values||[]).length;i++)if(existing.values[i]?.[0]===row[0])matches.push(i+1);
 if(matches.length>1)throw Error("duplicate_sheet_id");
 if(matches.length)await sheets(token,tab+"!A"+matches[0]+":J"+matches[0],"PUT",row);
 else await sheets(token,tab+"!A:J","POST",row);
}
// Called after a successful D1 transaction. Writes remain disabled unless explicitly enabled.
export async function dispatchPending(env){
 if(env.SHEETS_SYNC_ENABLED!=="true")return {sent:0,failed:0,enabled:false};
 const token=await getAccessToken(env);
 const {results}=await env.DB.prepare("SELECT * FROM sheet_sync_outbox WHERE state!='sent' AND (synced_at IS NULL OR synced_at < datetime('now','-2 minutes')) ORDER BY id LIMIT 10").all();
 let sent=0,failed=0;
 for(const item of results||[]){
  // Claim an outbox row before calling Sheets, preventing concurrent dispatch.
  const lease=await env.DB.prepare("UPDATE sheet_sync_outbox SET synced_at=CURRENT_TIMESTAMP WHERE id=? AND state!='sent' AND (synced_at IS NULL OR synced_at < datetime('now','-2 minutes'))").bind(item.id).run();
  if(!lease.meta?.changes)continue;
  try{
   await deliver(env,token,item);
   await env.DB.prepare("UPDATE sheet_sync_outbox SET state='sent',attempts=attempts+1,last_error=NULL,synced_at=CURRENT_TIMESTAMP WHERE id=?").bind(item.id).run();
   sent++;
  }catch(e){
   await env.DB.prepare("UPDATE sheet_sync_outbox SET state='error',attempts=attempts+1,last_error=?,synced_at=NULL WHERE id=?").bind(String(e.message||"failed").slice(0,100),item.id).run();
   failed++;
  }
 }
 return {sent,failed,enabled:true};
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 try{
 const user=await currentUser(request,env);
 if(!user)return reply({error:"Authentication required"},401);
 if(!["super_admin","admin"].includes(user.role))return reply({error:"Admin only"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 if(env.SHEETS_SYNC_ENABLED!=="true")return reply({error:"Sync not enabled"},409);
 const result=await dispatchPending(env);
 return reply({...result,mode:"manual_preview_dispatch"});
 }catch{return safeError()}
}
