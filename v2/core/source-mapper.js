// Shipping Pulse v2 — pure, read-only source mapping. No network or database access.
export const CANONICAL_FIELDS = Object.freeze(["externalOrderId","customer","phone","area","driverId","orderTotal","prepaid","codDue","shippingStatus","paymentStatus","notes","mapsUrl"]);
export const REQUIRED_FIELDS = Object.freeze(["externalOrderId","customer","driverId","codDue"]);
export function normalizeHeader(value){return String(value??"").trim().toLocaleLowerCase("en").replace(/[\s_\-\/]+/g," ")}
export function validateMapping(headers,mapping){
 const known=new Set(headers.map(normalizeHeader));
 const errors=[];
 for(const field of REQUIRED_FIELDS)if(!mapping[field])errors.push("Missing mapping: "+field);
 for(const [field,header] of Object.entries(mapping)){
  if(!CANONICAL_FIELDS.includes(field))errors.push("Unknown field: "+field);
  if(header&&!known.has(normalizeHeader(header)))errors.push("Missing column: "+header);
 }
 return errors;
}
export function mapPreview({sourceId,headers,rows,mapping,limit=200}){
 if(typeof sourceId!=="string"||!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(sourceId))throw Error("Invalid source ID");
 const errors=validateMapping(headers,mapping);
 if(errors.length)return {ok:false,errors,orders:[],duplicates:[],invalid:[]};
 const positions=new Map(headers.map((h,i)=>[normalizeHeader(h),i]));
 const seen=new Set(),orders=[],duplicates=[],invalid=[];
 for(let i=0;i<Math.min(rows.length,Math.max(0,limit));i++){
  const row=rows[i],order={sourceId};
  for(const field of CANONICAL_FIELDS){const header=mapping[field];order[field]=header?String(row[positions.get(normalizeHeader(header))]??"").trim():""}
  const id=order.externalOrderId;
  if(!id){invalid.push({row:i+2,reason:"Missing external order ID"});continue}
  const key=JSON.stringify([sourceId,id]);
  if(seen.has(key)){duplicates.push({row:i+2,externalOrderId:id});continue}
  seen.add(key);
  if(!order.customer||!order.driverId||!Number.isFinite(Number(order.codDue.replace(/,/g,"")))){invalid.push({row:i+2,reason:"Missing customer/driver or invalid COD"});continue}
  order.externalKey=key;
  orders.push(order);
 }
 return {ok:true,errors:[],orders,duplicates,invalid,readOnly:true,scanned:Math.min(rows.length,limit)};
}
