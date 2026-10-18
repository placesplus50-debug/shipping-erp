import {reply,currentUser,sameOrigin,safeError} from "./auth/_utils.js";
import {onRequestGet as getOrders} from "./orders.js";
const methods=["cash","company_transfer","paymob"];
const holders=["driver","company"];
async function scopedOrders(request,env){const r=await getOrders({request,env});if(!r.ok)throw Error("orders_unavailable");return (await r.json()).orders}
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{const actor=await currentUser(request,env);if(!actor)return reply({error:"Authentication required"},401);
 const orders=await scopedOrders(request,env),ids=new Set(orders.map(o=>o["Order ID"]));
 const {results}=await env.DB.prepare("SELECT e.id,e.order_id,e.driver_id,e.amount_cents,e.method,e.holder,e.note,e.created_at,r.decision,r.note AS review_note,r.created_at AS reviewed_at,h.id AS handover_id,h.amount_cents AS handed_over_cents,h.destination AS handover_destination,h.note AS handover_note,h.reviewer_user_id AS handover_reviewer_user_id,r.reviewer_user_id AS review_user_id,h.created_at AS handed_over_at FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id LEFT JOIN cash_handover h ON h.collection_id=e.id ORDER BY e.id DESC LIMIT 2000").all();
 return reply({collections:results.filter(e=>ids.has(e.order_id)&&(actor.role!=="driver"||e.driver_id===actor.driver_id)),truncated:results.length===2000,readOnly:false,scope:actor.role==="driver"?"assigned_driver":"authorized_staff"});
 }catch{return safeError()}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return safeError();
 try{
 const actor=await currentUser(request,env);if(!actor)return reply({error:"Authentication required"},401);
 if(actor.role!=="driver"||!actor.driver_id)return reply({error:"Driver only"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 const b=await request.json();
 if(typeof b.orderId!=="string"||!/^ORD-[\w-]{1,50}$/.test(b.orderId)||!Number.isSafeInteger(b.amountCents)||b.amountCents<0||!methods.includes(b.method)||!holders.includes(b.holder)||typeof b.requestId!=="string"||!/^[-\w]{12,100}$/.test(b.requestId)||String(b.note||"").length>500)return reply({error:"Invalid collection"},400);
 if(b.method==="cash"&&b.holder!=="driver")return reply({error:"Cash must be held by driver until reviewed"},400);
 if(b.method!=="cash"&&b.holder!=="company")return reply({error:"Electronic payments are company-held"},400);
 const orders=await scopedOrders(request,env),order=orders.find(o=>o["Order ID"]===b.orderId);
 if(!order||order["Driver ID"]!==actor.driver_id)return reply({error:"Order not assigned"},403);
 const effective=order["Effective Shipping Status"]||order["Shipping Status"];
 if(effective!=="Delivered")return reply({error:"Delivery must be completed first"},409);
 const due=Math.round(Number(String(order["COD Due"]||"0").replace(/,/g,""))*100);
 if(!Number.isSafeInteger(due)||due<=0||b.amountCents<=0)return reply({error:"No positive COD due"},409);
 const existing=await env.DB.prepare("SELECT id FROM collection_events WHERE request_id=?").bind(b.requestId).first();
 if(existing)return reply({error:"Duplicate request"},409);
 const sum=await env.DB.prepare("SELECT COALESCE(SUM(e.amount_cents),0) AS total FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id WHERE e.order_id=? AND (r.decision IS NULL OR r.decision='approved')").bind(b.orderId).first();
 if(sum.total+b.amountCents>due)return reply({error:"Amount exceeds remaining COD"},409);
 const result=await env.DB.prepare("INSERT INTO collection_events(order_id,driver_id,actor_user_id,amount_cents,method,holder,request_id,note) SELECT ?,?,?,?,?,?,?,? WHERE ? >= ? + (SELECT COALESCE(SUM(e.amount_cents),0) FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id WHERE e.order_id=? AND (r.decision IS NULL OR r.decision='approved'))").bind(b.orderId,actor.driver_id,actor.id,b.amountCents,b.method,b.holder,b.requestId,String(b.note||""),due,b.amountCents,b.orderId).run();
 if(!result.meta?.changes)return reply({error:"COD already fully claimed"},409);
 return reply({ok:true,id:result.meta.last_row_id,review:"pending",googleSheetsModified:false},201);
 }catch{return safeError()}
}
export async function onRequestPatch({request,env}){
 if(!env.DB)return safeError();
 try{
 const actor=await currentUser(request,env);if(!actor)return reply({error:"Authentication required"},401);
 if(!["super_admin","accountant","admin"].includes(actor.role))return reply({error:"Accountant only"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 const b=await request.json(),id=Number(b.id);
 if(!Number.isSafeInteger(id)||id<1||!["approved","rejected"].includes(b.decision)||String(b.note||"").length>500)return reply({error:"Invalid review"},400);
 const item=await env.DB.prepare("SELECT id FROM collection_events WHERE id=?").bind(id).first();if(!item)return reply({error:"Not found"},404);
 const existing=await env.DB.prepare("SELECT id FROM collection_reviews WHERE collection_id=?").bind(id).first();if(existing)return reply({error:"Already reviewed"},409);
 await env.DB.prepare("INSERT INTO collection_reviews(collection_id,reviewer_user_id,decision,note) VALUES(?,?,?,?)").bind(id,actor.id,b.decision,String(b.note||"")).run();
 return reply({ok:true,decision:b.decision},201);
 }catch{return safeError()}
}

export async function onRequestPut({request,env}){
 if(!env.DB)return safeError();
 try{
 const actor=await currentUser(request,env);
 if(!actor)return reply({error:"Authentication required"},401);
 if(!["super_admin","accountant","admin"].includes(actor.role))return reply({error:"Accountant only"},403);
 if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
 const b=await request.json(),id=Number(b.id),note=String(b.note||""),destination=String(b.destination||"");
 if(!Number.isSafeInteger(id)||id<1||!["cashbox","bank"].includes(destination)||note.length>500)return reply({error:"Invalid handover"},400);
 const entry=await env.DB.prepare("SELECT e.id,e.amount_cents,e.method,e.holder,r.decision FROM collection_events e LEFT JOIN collection_reviews r ON r.collection_id=e.id WHERE e.id=?").bind(id).first();
 if(!entry)return reply({error:"Not found"},404);
 if(entry.decision!=="approved"||entry.method!=="cash"||entry.holder!=="driver")return reply({error:"Only approved driver-held cash may be handed over"},409);
 const exists=await env.DB.prepare("SELECT id FROM cash_handover WHERE collection_id=?").bind(id).first();
 if(exists)return reply({error:"Already handed over"},409);
 await env.DB.prepare("INSERT INTO cash_handover(collection_id,reviewer_user_id,amount_cents,destination,note) VALUES(?,?,?,?,?)").bind(id,actor.id,entry.amount_cents,destination,note).run();
 return reply({ok:true,collectionId:id,handedOverCents:entry.amount_cents,destination,googleSheetsModified:false},201);
 }catch{return safeError()}
}
