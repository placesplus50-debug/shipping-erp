import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
const adminRoles=new Set(["super_admin","admin"]);
const events=new Set(["shift_start","shift_end","sharing_start","sharing_stop"]);
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 const actor=await currentUser(request,env);if(!actor)return reply({error:"Authentication required"},401);
 try{
  if(actor.role==="driver"&&actor.driver_id){
   const last=await env.DB.prepare("SELECT event_type,created_at FROM driver_shift_events WHERE driver_id=? AND event_type IN ('shift_start','shift_end') ORDER BY id DESC LIMIT 1").bind(actor.driver_id).first();
   return reply({active:last?.event_type==="shift_start",lastShiftEvent:last||null});
  }
  if(!adminRoles.has(actor.role))return reply({error:"Forbidden"},403);
  const rows=await env.DB.prepare("SELECT id,driver_id,event_type,created_at FROM driver_shift_events WHERE julianday(created_at)>=julianday('now','-7 days') ORDER BY id DESC LIMIT 500").all();
  return reply({events:rows.results||[]});
 }catch{return reply({error:"Shift storage not ready; apply D1 migration"},503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 const actor=await currentUser(request,env);if(!actor)return reply({error:"Authentication required"},401);
 if(actor.role!=="driver"||!actor.driver_id)return reply({error:"Driver access required"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 if(!(request.headers.get("content-type")||"").includes("application/json"))return reply({error:"JSON required"},415);
 let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
 if(!events.has(body?.event))return reply({error:"Invalid event"},400);
 try{
  const last=await env.DB.prepare("SELECT event_type FROM driver_shift_events WHERE driver_id=? AND event_type IN ('shift_start','shift_end') ORDER BY id DESC LIMIT 1").bind(actor.driver_id).first();
  const active=last?.event_type==="shift_start";
  if(body.event==="shift_start"&&active)return reply({error:"Shift already active"},409);
  if(body.event==="shift_end"&&!active)return reply({error:"No active shift"},409);
  await env.DB.prepare("INSERT INTO driver_shift_events(driver_id,user_id,event_type) VALUES(?,?,?)").bind(actor.driver_id,String(actor.id),body.event).run();
  return reply({ok:true,active:body.event==="shift_start"?true:body.event==="shift_end"?false:active});
 }catch{return reply({error:"Shift storage not ready; apply D1 migration"},503)}
}
