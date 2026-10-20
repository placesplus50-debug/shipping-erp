import {reply,currentUser,safeError} from "../auth/_utils.js";
import {onRequestGet as getOrders} from "../orders.js";
const validId=s=>typeof s==="string"&&/^ORD-[A-Za-z0-9-]{1,50}$/.test(s);
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant","driver"].includes(actor.role))return reply({error:"Forbidden"},403);
  const id=new URL(request.url).searchParams.get("orderId");
  if(!validId(id))return reply({error:"Invalid order ID"},400);
  // Verify access against the existing role-scoped orders endpoint before exposing any event.
  const source=await getOrders({request,env});
  if(!source.ok)return reply({error:"Order lookup unavailable"},503);
  const orders=(await source.json()).orders||[];
  if(!orders.some(o=>o["Order ID"]===id))return reply({error:"Order not found in your scope"},404);
  const events=await env.DB.prepare("SELECT id,previous_status,new_status,created_at FROM driver_status_events WHERE order_id=? ORDER BY id DESC LIMIT 100").bind(id).all();
  return reply({orderId:id,events:events.results||[],readOnly:true});
 }catch{return safeError()}
}
export const onRequestPost=()=>reply({error:"Method not allowed"},405);
