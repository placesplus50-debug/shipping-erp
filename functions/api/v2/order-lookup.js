import {reply,currentUser,safeError} from "../auth/_utils.js";
import {onRequestGet as getOrders} from "../orders.js";
// Secure lookup for barcode/manual entry. QR contains ONLY an order ID, never customer PII.
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["driver","admin","super_admin","accountant"].includes(actor.role))return reply({error:"Forbidden"},403);
  const id=new URL(request.url).searchParams.get("id")||"";
  if(!/^ORD-[A-Za-z0-9-]{1,50}$/.test(id))return reply({error:"Invalid order ID"},400);
  const result=await getOrders({request,env});
  if(!result.ok)return reply({error:"Order source unavailable"},503);
  const data=await result.json();
  const order=data.orders.find(o=>o["Order ID"]===id);
  if(!order)return reply({error:"Order not found or not assigned"},404);
  return reply({order,scope:data.scope,readOnly:true});
 }catch{return safeError()}
}
