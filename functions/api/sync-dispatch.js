import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
import {getAccessToken} from "./orders.js";
const spreadsheet="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
const headers={
 TRACKING:["Event ID","Order ID","Driver ID","Old Status","New Status","Event Time","Collected Cash","Collection Method","Notes","Recorded By"],
 COLLECTIONS:["Settlement ID","Order ID","Driver ID","Cash Collected","Cash Remitted","Outstanding","Remittance Date","Settlement Status","Reviewed By","Notes"],
 FOLLOWUPS:["Order ID","Driver ID","Reason","Attempts","Action Required","Updated At","Updated By","Shipping Status"]
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
 if(item.destination_tab==="TRACKING"){
  const actorId=Number(p.recordedBy);
  const actor=Number.isSafeInteger(actorId)&&actorId>0
   ?await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(actorId).first():null;
  return [p.eventId,p.orderId,p.driverId,p.oldStatus,p.newStatus,p.eventTime||"",0,"","",actor?.email||String(p.recordedBy||"")];
 }
 if(item.destination_tab==="FOLLOWUPS"){
  const record=await env.DB.prepare("SELECT f.order_id,f.driver_id,f.reason,f.attempt_count,f.action_required,f.updated_at,u.email FROM delivery_followups f LEFT JOIN users u ON u.id=f.updated_by WHERE f.order_id=?").bind(p.orderId).first();
  if(!record)throw Error("missing_followup");
  return [record.order_id,record.driver_id,record.reason,record.attempt_count,record.action_required,record.updated_at,record.email||"",p.shippingStatus||""];
 }
 const id=Number(String(p.settlementId||"").replace(/^COL-/,""));
 if(!Number.isSafeInteger(id)||id<1)throw Error("bad_collection_id");
 const e=await env.DB.prepare("SELECT e.id,e.order_id,e.driver_id,e.amount_cents,e.method,e.holder,e.note,r.decision,r.reviewer_user_id,h.amount_cents AS remitted,h.created_at AS remittance_date,h.destination,u.email AS reviewer_email FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id LEFT JOIN cash_handover h ON h.collection_id=e.id LEFT JOIN users u ON u.id=r.reviewer_user_id WHERE e.id=?").bind(id).first();
 if(!e)throw Error("missing_collection");
 const collected=e.method==="cash"?e.amount_cents/100:0;
 const remitted=(e.remitted||0)/100;
 const outstanding=e.method==="cash"&&e.holder==="driver"&&e.decision!=="rejected"?Math.max(0,collected-remitted):0;
 const status=e.decision==="rejected"?"Rejected":e.remitted!=null?"Fully remitted":e.decision==="approved"?"Pending":"Pending";
 return ["COL-"+id,e.order_id,e.driver_id,collected,remitted,outstanding,e.remittance_date||"",status,e.reviewer_email||"",[e.method,e.destination,e.note].filter(Boolean).join(" | ")];
}
export async function deliver(env,token,item){
 const tab=item.destination_tab;
 if(!headers[tab])throw Error("unknown_tab");
 const last=tab==="FOLLOWUPS"?"H":"J";
 const existing=await sheets(token,tab+"!A1:"+last);
 if(JSON.stringify(existing.values?.[0]||[])!==JSON.stringify(headers[tab]))throw Error("header_mismatch");
 const row=await rowFor(env,item),matches=[];
 if(tab==="FOLLOWUPS"){
  const orders=await sheets(token,"ORDERS!A1:K");
  const values=orders.values||[];
  const idColumn=(values[0]||[]).indexOf("Order ID");
  const statusColumn=(values[0]||[]).indexOf("Shipping Status");
  if(idColumn<0||statusColumn<0)throw Error("orders_header_mismatch");
  const found=values.slice(1).filter(r=>r[idColumn]===row[0]);
  if(found.length!==1)throw Error(found.length?"duplicate_order_id":"order_not_found_in_sheet");
  row[7]=found[0][statusColumn]||"";
 }
 for(let i=1;i<(existing.values||[]).length;i++)if(existing.values[i]?.[0]===row[0])matches.push(i+1);
 if(matches.length>1)throw Error("duplicate_sheet_id");
 if(matches.length)await sheets(token,tab+"!A"+matches[0]+":"+last+matches[0],"PUT",row);
 else await sheets(token,tab+"!A:"+last,"POST",row);
}
async function syncOrderStatus(env,token,orderId){
 const latest=await env.DB.prepare("SELECT new_status FROM driver_status_events WHERE order_id=? ORDER BY id DESC LIMIT 1").bind(orderId).first();
 if(!latest)return;
 const sheet=await sheets(token,"ORDERS!A1:K");
 const rows=sheet.values||[];
 if(rows[0]?.[0]!=="Order ID"||rows[0]?.[10]!=="Shipping Status")throw Error("orders_header_mismatch");
 const matches=[];
 for(let i=1;i<rows.length;i++)if(rows[i]?.[0]===orderId)matches.push(i+1);
 if(matches.length!==1)throw Error(matches.length?"duplicate_order_id":"order_not_found_in_sheet");
 if(rows[matches[0]-1][10]!==latest.new_status)await sheets(token,"ORDERS!K"+matches[0],"PUT",[latest.new_status]);
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
   if(item.destination_tab==="TRACKING")await syncOrderStatus(env,token,JSON.parse(item.payload_json).orderId);
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
 const body=await request.json().catch(()=>({}));
 let backfilled=0,ordersUpdated=0;
 if(body?.backfillFollowups===true){
  const {results}=await env.DB.prepare("SELECT order_id FROM delivery_followups LIMIT 1000").all();
  for(const r of results||[]){
   const exists=await env.DB.prepare("SELECT id FROM sheet_sync_outbox WHERE destination_tab='FOLLOWUPS' AND json_extract(payload_json,'$.orderId')=? LIMIT 1").bind(r.order_id).first();
   if(exists)continue;
   await env.DB.prepare("INSERT INTO sheet_sync_outbox(event_type,event_id,destination_tab,payload_json) VALUES('followup', (SELECT COALESCE(MAX(event_id),0)+1 FROM sheet_sync_outbox WHERE event_type='followup'),'FOLLOWUPS',json_object('orderId',?))").bind(r.order_id).run();
   backfilled++;
  }
 }
 if(body?.backfillFollowups===true){
  const token=await getAccessToken(env);
  const {results:orders}=await env.DB.prepare("SELECT DISTINCT order_id FROM driver_status_events LIMIT 1000").all();
  for(const o of orders||[]){await syncOrderStatus(env,token,o.order_id);ordersUpdated++}
 }
 const result=await dispatchPending(env);
 return reply({...result,backfilled,ordersUpdated,mode:"manual_dispatch"});
 }catch(e){return reply({error:"Sync dispatch failed",detail:String(e?.message||e).slice(0,180)},503)}
}

export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin"].includes(user.role))return reply({error:"Admin only"},403);
  const token=await getAccessToken(env);
  const inspection={enabled:env.SHEETS_SYNC_ENABLED==="true",readOnly:true,tabs:{},pending:[],reconciliation:{missingCollections:[],duplicateCollections:[],checkedCollections:0}};
  for(const tab of ["TRACKING","COLLECTIONS","FOLLOWUPS"]){
   const sheet=await sheets(token,tab+"!A1:"+(tab==="FOLLOWUPS"?"H":"J"));
   const values=sheet.values||[];
   const headerMatch=JSON.stringify(values[0]||[])===JSON.stringify(headers[tab]);
   inspection.tabs[tab]={headerMatch,existingRows:Math.max(0,values.length-1)};
  }
  const collectionSheet=await sheets(token,"COLLECTIONS!A1:A");
  const sheetIds=(collectionSheet.values||[]).slice(1).map(r=>String(r[0]||""));
  const sheetCounts=new Map();
  for(const id of sheetIds)if(/^COL-[1-9][0-9]*$/.test(id))sheetCounts.set(id,(sheetCounts.get(id)||0)+1);
  const saved=await env.DB.prepare("SELECT id,order_id,driver_id,amount_cents FROM collection_events ORDER BY id LIMIT 2000").all();
  inspection.reconciliation.checkedCollections=(saved.results||[]).length;
  inspection.reconciliation.truncated=(saved.results||[]).length===2000;
  for(const e of saved.results||[]){
   const key="COL-"+e.id,count=sheetCounts.get(key)||0;
   if(count===0)inspection.reconciliation.missingCollections.push({id:key,orderId:e.order_id,driverId:e.driver_id,amount:e.amount_cents/100});
   if(count>1)inspection.reconciliation.duplicateCollections.push({id:key,count});
  }
  const {results}=await env.DB.prepare("SELECT * FROM sheet_sync_outbox WHERE state!='sent' ORDER BY id LIMIT 20").all();
  for(const item of results||[]){
   let row=null,error=null;
   try{row=await rowFor(env,item)}catch(e){error=String(e.message||e)}
   const tab=item.destination_tab;
   let matchCount=0;
   if(row&&headers[tab]){
    const existing=await sheets(token,tab+"!A1:A");
    matchCount=(existing.values||[]).slice(1).filter(r=>r[0]===row[0]).length;
   }
   inspection.pending.push({id:item.id,eventType:item.event_type,tab,state:item.state,attempts:item.attempts,recordId:row?.[0]||null,orderId:row?.[1]||null,willUpdateExisting:matchCount===1,duplicateId:matchCount>1,error,amount:tab==="COLLECTIONS"&&row?{collected:row[3],remitted:row[4],outstanding:row[5],status:row[7]}:undefined});
  }
  return reply(inspection);
 }catch(e){return reply({error:"Read-only sync inspection failed",detail:String(e.message||e).slice(0,120)},503)}
}
