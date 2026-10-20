import {reply,currentUser,safeError} from "../auth/_utils.js";
import {onRequestGet as getOrders} from "../orders.js";
// Authenticated CSV export. Driver visibility is enforced by the existing scoped orders endpoint.
const columns=["Order ID","Order Date","Customer","Phone","City / Area","Driver ID","Order Total","Prepaid Amount","COD Due","Payment Type","Shipping Status","Payment Status","Notes","Effective Shipping Status"];
const csvCell=value=>'"'+String(value??"").replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["driver","admin","super_admin","accountant"].includes(actor.role))return reply({error:"Forbidden"},403);
  const result=await getOrders({request,env});
  if(!result.ok)return reply({error:"Orders unavailable"},503);
  const data=await result.json();
  const lines=[columns.map(csvCell).join(","),...data.orders.map(o=>columns.map(c=>csvCell(o[c])).join(","))];
  return new Response("\uFEFF"+lines.join("\r\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":'attachment; filename="shipping-pulse-orders.csv"',"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return safeError()}
}
