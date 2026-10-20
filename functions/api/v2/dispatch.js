import {reply,currentUser,sameOrigin,safeError} from "../auth/_utils.js";
import {onRequestGet as getOrders} from "../orders.js";
const validOrder=id=>typeof id==="string"&&/^ORD-[A-Za-z0-9-]{1,50}$/.test(id);
const validDriver=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(id);
const allowed=role=>role==="admin"||role==="super_admin";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!allowed(actor.role))return reply({error:"Admin only"},403);
  const source=await getOrders({request,env});
  if(!source.ok)return reply({error:"Order source unavailable"},503);
  const data=await source.json();
  const rows=await env.DB.prepare("SELECT order_id,driver_id,actor_user_id,assigned_at FROM v2_dispatch_assignments ORDER BY assigned_at DESC LIMIT 5000").all();
  return reply({assignments:(rows.results||[]).filter(a=>data.orders.some(o=>o["Order ID"]===a.order_id)),readOnly:true,source:"v2_dispatch_assignments"});
 }catch{return safeError()}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!allowed(actor.role))return reply({error:"Admin only"},403);
  if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
  if(!(request.headers.get("content-type")||"").includes("application/json"))return reply({error:"JSON required"},415);
  const body=await request.json(),orderId=body?.orderId,driverId=body?.driverId,requestId=body?.requestId;
  if(!validOrder(orderId)||!validDriver(driverId)||typeof requestId!=="string"||!/^[A-Za-z0-9_-]{12,100}$/.test(requestId))return reply({error:"Invalid assignment"},400);
  const source=await getOrders({request,env});
  if(!source.ok)return reply({error:"Order source unavailable"},503);
  const data=await source.json(),order=data.orders.find(o=>o["Order ID"]===orderId);
  if(!order)return reply({error:"Order not found"},404);
  if(String(order["Driver ID"]||"").trim())return reply({error:"Order already assigned in source sheet"},409);
  const state=String(order["Effective Shipping Status"]||order["Shipping Status"]||"").toLowerCase();
  if(/deliver|return|cancel|fail|تسليم|مرتجع|ملغي|تعذر/.test(state))return reply({error:"Finalized order"},409);
  const driver=await env.DB.prepare("SELECT id,driver_id FROM users WHERE driver_id=? AND role='driver' AND is_active=1").bind(driverId).first();
  if(!driver)return reply({error:"Driver not active"},404);
  const existing=await env.DB.prepare("SELECT order_id,driver_id FROM v2_dispatch_assignments WHERE request_id=?").bind(requestId).first();
  if(existing)return reply({error:"Duplicate request"},409);
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO v2_dispatch_assignments(order_id,driver_id,actor_user_id,request_id) VALUES(?,?,?,?)").bind(orderId,driverId,actor.id,requestId).run();
  if(!inserted.meta?.changes)return reply({error:"Already assigned"},409);
  return reply({ok:true,orderId,driverId,storage:"v2_dispatch_assignments",googleSheetsModified:false,requiresOrdersOverlay:true},201);
 }catch{return safeError()}
}
