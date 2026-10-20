// Shipping Pulse v2 — safe order dispatch planning.
// Pure functions. Dispatch preview does not alter assignments or source spreadsheets.
export function normalizeOrder(o){
 return {id:String(o["Order ID"]??o.id??"").trim(),driverId:String(o["Driver ID"]??o.driverId??"").trim(),area:String(o["City / Area"]??o.area??"").trim(),status:String(o["Effective Shipping Status"]??o["Shipping Status"]??o.status??"").trim(),cod:Number(String(o["COD Due"]??o.codDue??"0").replace(/,/g,""))};
}
export function dispatchPreview(orders,drivers,{maxPerDriver=30}={}){
 if(!Array.isArray(orders)||!Array.isArray(drivers))throw Error("Orders and drivers must be arrays");
 if(!Number.isInteger(maxPerDriver)||maxPerDriver<1||maxPerDriver>500)throw Error("Invalid driver capacity");
 const roster=drivers.map(d=>({id:String(d.id??"").trim(),areas:(d.areas||[]).map(a=>String(a).trim().toLowerCase()),capacity:Math.min(maxPerDriver,Number.isInteger(d.capacity)?d.capacity:maxPerDriver),active:d.active!==false,load:0})).filter(d=>d.id&&d.active);
 const suggestions=[],skipped=[],seen=new Set();
 for(const original of orders){
  const o=normalizeOrder(original);
  if(!o.id||seen.has(o.id)){skipped.push({orderId:o.id,reason:"missing_or_duplicate_id"});continue}
  seen.add(o.id);
  if(o.driverId||/deliver|return|cancel|fail|تسليم|مرتجع|ملغي|تعذر/i.test(o.status)){skipped.push({orderId:o.id,reason:"already_assigned_or_closed"});continue}
  const area=o.area.toLowerCase();
  const eligible=roster.filter(d=>d.load<d.capacity&&(!d.areas.length||d.areas.includes(area))).sort((a,b)=>a.load-b.load||a.id.localeCompare(b.id));
  if(!eligible.length){skipped.push({orderId:o.id,reason:"no_available_driver"});continue}
  eligible[0].load++;
  suggestions.push({orderId:o.id,driverId:eligible[0].id,area:o.area,mode:"suggestion_only"});
 }
 return {suggestions,skipped,drivers:roster.map(({id,load,capacity})=>({id,load,capacity})),readOnly:true};
}
