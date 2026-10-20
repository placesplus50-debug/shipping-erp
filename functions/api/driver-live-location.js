import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
const adminRoles=new Set(["super_admin","admin"]);
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 const actor=await currentUser(request,env);
 if(!actor)return reply({error:"Authentication required"},401);
 if(!adminRoles.has(actor.role))return reply({error:"Forbidden"},403);
 try{
  const rows=await env.DB.prepare("SELECT driver_id,latitude,longitude,accuracy_m,updated_at FROM driver_live_locations WHERE updated_at >= datetime('now','-24 hours') ORDER BY updated_at DESC LIMIT 250").all();
  return reply({locations:(rows.results||[]).map(r=>({...r,online:Date.now()-Date.parse(r.updated_at)<120000}))});
 }catch{return reply({error:"Location storage not ready; apply D1 migration"},503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 const actor=await currentUser(request,env);
 if(!actor)return reply({error:"Authentication required"},401);
 if(actor.role!=="driver"||!actor.driver_id)return reply({error:"Driver access required"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 if(!(request.headers.get("content-type")||"").includes("application/json"))return reply({error:"JSON required"},415);
 let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
 try{
  if(body?.sharing===false){
   await env.DB.prepare("DELETE FROM driver_live_locations WHERE driver_id=?").bind(actor.driver_id).run();
   return reply({ok:true,sharing:false});
  }
  const lat=body?.latitude,lng=body?.longitude,accuracy=body?.accuracy;
  if(body?.sharing!==true||typeof lat!=="number"||typeof lng!=="number"||typeof accuracy!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(accuracy)||Math.abs(lat)>90||Math.abs(lng)>180||accuracy<0||accuracy>100000)return reply({error:"Invalid location"},400);
  await env.DB.prepare("INSERT INTO driver_live_locations(driver_id,user_id,latitude,longitude,accuracy_m,updated_at) VALUES(?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(driver_id) DO UPDATE SET user_id=excluded.user_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at").bind(actor.driver_id,String(actor.id),lat,lng,accuracy).run();
  return reply({ok:true,sharing:true});
 }catch{return reply({error:"Location storage not ready; apply D1 migration"},503)}
}
