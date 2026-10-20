// Pure KPI calculations; no database writes. Amounts are integer cents.
const terminal=new Set(["Delivered","Returned","Cancelled"]);
export function driverMetrics(orders=[]){
 const result={total:0,delivered:0,returned:0,active:0,other:0,mapped:0,codDueCents:0};
 for(const o of orders){
  result.total++;
  const status=o.effectiveStatus||o.shippingStatus||"";
  if(status==="Delivered")result.delivered++;
  else if(status==="Returned")result.returned++;
  else if(status==="Cancelled")result.other++;
  else result.active++;
  if(o.mapsUrl||Number.isFinite(o.latitude)&&Number.isFinite(o.longitude))result.mapped++;
  const cents=Number(o.codDueCents);
  if(Number.isSafeInteger(cents)&&cents>0&&!terminal.has(status))result.codDueCents+=cents;
 }
 return result;
}
