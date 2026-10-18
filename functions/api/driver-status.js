import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
const ALLOWED=new Set(["Assigned","Out for delivery","Delivered","Returned","Delivery failed"]);
const validId=s=>typeof s==="string"&&/^ORD-[A-Za-z0-9-]{1,50}$/.test(s);
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(actor.role!=="driver"||!actor.driver_id)return reply({error:"Driver access required"},403);
  if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
  if(!(request.headers.get("content-type")||"").includes("application/json"))return reply({error:"JSON required"},415);
  const body=await request.json();
  const orderId=body?.orderId,status=body?.status,requestId=body?.requestId;
  if(!validId(orderId)||!ALLOWED.has(status)||typeof requestId!=="string"||!/^[a-zA-Z0-9_-]{12,100}$/.test(requestId))return reply({error:"Invalid request"},400);
  // Reuse the authenticated, driver-scoped Google Sheets endpoint; never trust client-provided driver assignment.
  const {onRequestGet}=await import("./orders.js");
  const source=await onRequestGet({request,env});
  if(!source.ok)return reply({error:"Unable to verify assigned order"},503);
  const data=await source.json();
  if(data.scope!=="assigned_driver")return reply({error:"Driver scope required"},403);
  const order=data.orders.find(o=>o["Order ID"]===orderId);
  if(!order)return reply({error:"Order not assigned to driver"},403);
  const latest=await env.DB.prepare("SELECT new_status FROM driver_status_events WHERE order_id=? ORDER BY id DESC LIMIT 1").bind(orderId).first();
  const previous=latest?.new_status||order["Shipping Status"];
  if(previous===status)return reply({error:"Status already set"},409);
  // Forbid editing completed/returned shipments; first iteration tests only active orders.
  if(["Delivered","Returned"].includes(previous))return reply({error:"Finalized order cannot be changed"},409);
  const transitions={"Assigned":["Out for delivery","Delivery failed"],"Out for delivery":["Delivered","Returned","Delivery failed"],"Delivery failed":["Out for delivery","Returned"]};
  if(!transitions[previous]?.includes(status))return reply({error:"Invalid status transition"},409);
  const existing=await env.DB.prepare("SELECT order_id,new_status FROM driver_status_events WHERE request_id=?").bind(requestId).first();
  if(existing)return reply({error:"Duplicate request"},409);
  await env.DB.prepare("INSERT INTO driver_status_events (order_id,driver_id,actor_user_id,previous_status,new_status,request_id) VALUES (?,?,?,?,?,?)").bind(orderId,actor.driver_id,actor.id,previous,status,requestId).run();
  return reply({ok:true,orderId,previousStatus:previous,status,storage:"preview_d1",googleSheetsModified:false},201);
 }catch(e){return safeError()}
}
export const onRequestGet=()=>reply({error:"Method not allowed"},405);
