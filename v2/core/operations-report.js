// Shipping Pulse v2: pure read-only reporting, finance reconciliation hints, and alerts.
// No persistent mutations. Money values are integer piasters to avoid float reconciliation drift.
const safeAmount=value=>{
 const raw=String(value??"").trim().replace(/,/g,"");
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw))return null;
 const [whole,fraction=""]=raw.split(".");
 const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 return Number.isSafeInteger(cents)?cents:null;
};
export {safeAmount};
export function classifyStatus(order){
 const status=String(order["Effective Shipping Status"]||order["Shipping Status"]||"").trim().toLowerCase();
 if(["delivered","تم التسليم","تم التوصيل"].includes(status))return"delivered";
 if(["returned","cancelled","delivery failed","مرتجع","ملغي","تعذر التسليم"].includes(status))return"exception";
 return"active";
}
export function dashboardReport(orders){
 if(!Array.isArray(orders))throw Error("Invalid orders");
 const stats={total:orders.length,delivered:0,exception:0,active:0,codDueCents:0,codUnknown:0,byDriver:{},byArea:{}};
 const alerts=[];
 for(const o of orders){
  const id=String(o["Order ID"]??"").trim(),driver=String(o["Driver ID"]??"").trim(),area=String(o["City / Area"]??"").trim();
  const state=classifyStatus(o);stats[state]++;
  stats.byDriver[driver||"(unassigned)"]=(stats.byDriver[driver||"(unassigned)"]||0)+1;
  stats.byArea[area||"(unknown)"]=(stats.byArea[area||"(unknown)"]||0)+1;
  const amount=safeAmount(o["COD Due"]);
  if(amount===null){stats.codUnknown++;alerts.push({type:"invalid_cod",orderId:id})}
  else stats.codDueCents+=amount;
  if(!driver)alerts.push({type:"unassigned",orderId:id});
  if(state==="exception")alerts.push({type:"delivery_exception",orderId:id});
  if(state==="delivered"&&amount>0)alerts.push({type:"reconcile_cod",orderId:id,amountCents:amount,explanation:"COD on delivered order requires finance event reconciliation; not proof of unpaid balance"});
 }
 return {stats,alerts,readOnly:true,financeIsAuthoritative:false};
}
export function reconcileCollections(orders,financeEvents){
 // Explicitly advisory. No assumption that delivered COD is automatically collected.
 const byOrder=new Map(),alerts=[];
 for(const e of financeEvents||[]){
  const id=String(e.orderId??"");
  const cents=Number(e.amountCents);
  if(!id||!Number.isSafeInteger(cents))continue;
  if(!byOrder.has(id))byOrder.set(id,0);
  if(e.type==="collection")byOrder.set(id,byOrder.get(id)+cents);
  if(e.type==="reversal")byOrder.set(id,byOrder.get(id)-cents);
 }
 const results=[];
 for(const o of orders){
  const id=String(o["Order ID"]??""),due=safeAmount(o["COD Due"]);
  const collected=byOrder.get(id)||0;
  const delta=due===null?null:due-collected;
  if(delta!==null&&delta!==0)alerts.push({type:"unreconciled",orderId:id,deltaCents:delta});
  results.push({orderId:id,codDueCents:due,recordedCollectionsCents:collected,differenceCents:delta});
 }
 return {results,alerts,readOnly:true,advisory:true};
}
