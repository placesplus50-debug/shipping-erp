import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
import {onRequestGet as readOrders} from "./orders.js";
const allowedActions=new Set(["review","call_customer","retry_delivery","return_to_sender","resolved"]);
const idOk=v=>typeof v==="string"&&/^ORD-[A-Za-z0-9-]{1,50}$/.test(v);
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant","driver"].includes(user.role))return reply({error:"Forbidden"},403);
  const db=await env.DB.prepare("SELECT order_id,driver_id,reason,action_required,attempt_count,updated_at FROM delivery_followups WHERE (? != 'driver' OR driver_id=?) ORDER BY updated_at DESC LIMIT 1000").bind(user.role,user.driver_id||"").all();
  return reply({followups:db.results||[],readOnly:true});
 }catch{return reply({error:"Delivery follow-up table unavailable; apply migration 0005"},503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin"].includes(user.role))return reply({error:"Admin only"},403);
  if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
  if(!(request.headers.get("content-type")||"").includes("application/json"))return reply({error:"JSON required"},415);
  const b=await request.json();
  if(!idOk(b?.orderId)||typeof b?.reason!=="string"||!b.reason.trim()||b.reason.length>500||!allowedActions.has(b.actionRequired)||!Number.isInteger(b.attemptCount)||b.attemptCount<0||b.attemptCount>100)return reply({error:"Invalid follow-up"},400);
  const source=await readOrders({request,env});
  if(!source.ok)return reply({error:"Order verification unavailable"},503);
  const order=(await source.json()).orders.find(o=>o["Order ID"]===b.orderId);
  if(!order)return reply({error:"Order not found"},404);
  const status=order["Effective Shipping Status"]||order["Shipping Status"];
  if(!["Returned","Delivery failed","Out for delivery"].includes(status))return reply({error:"Follow-up allowed only for returned, failed or active delivery orders"},409);
  await env.DB.prepare("INSERT INTO delivery_followups(order_id,driver_id,reason,action_required,attempt_count,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET driver_id=excluded.driver_id,reason=excluded.reason,action_required=excluded.action_required,attempt_count=excluded.attempt_count,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(b.orderId,order["Driver ID"],b.reason.trim(),b.actionRequired,b.attemptCount,user.id).run();
  return reply({ok:true,orderId:b.orderId,driverId:order["Driver ID"]});
 }catch{return reply({error:"Unable to save follow-up; verify D1 migration 0005"},503)}
}
