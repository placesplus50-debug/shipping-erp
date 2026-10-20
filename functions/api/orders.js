import {reply,currentUser,safeError} from "./auth/_utils.js";

// Read-only Google Sheets source. Never accept a spreadsheet or driver ID from the caller.
const SPREADSHEET_ID="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
const RANGE="ORDERS!A1:N";
const REQUIRED=["Order ID","Order Date","Customer","Phone","City / Area","Driver ID","Order Total","Prepaid Amount","COD Due","Payment Type","Shipping Status","Payment Status","Notes"];
const noWrite=()=>reply({error:"Orders are read-only"},405);
export const onRequestPost=noWrite;
export const onRequestPatch=noWrite;
export const onRequestPut=noWrite;
export const onRequestDelete=noWrite;

export async function getAccessToken(env){
 const record=await env.DB.prepare("SELECT refresh_token_ciphertext FROM google_oauth_tokens WHERE id=1").first();
 if(!record?.refresh_token_ciphertext)throw Error("not_connected");
 const [ivB64,dataB64]=record.refresh_token_ciphertext.split(".");
 if(!ivB64||!dataB64)throw Error("invalid_token");
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const secret=env.GOOGLE_TOKEN_ENCRYPTION_KEY;const raw=/^[a-f0-9]{64}$/i.test(secret)?Uint8Array.from(secret.match(/.{2}/g),v=>parseInt(v,16)):bytes(secret);
 if(raw.length!==32)throw Error("invalid_key");
 const key=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["decrypt"]);
 const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(ivB64)},key,bytes(dataB64)));
 const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:token,grant_type:"refresh_token"})});
 if(!res.ok)throw Error("refresh_failed");
 const data=await res.json();
 if(!data.access_token)throw Error("refresh_failed");
 return data.access_token;
}

export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant","driver"].includes(actor.role))return reply({error:"Forbidden"},403);
  if(actor.role==="driver"&&!actor.driver_id)return reply({error:"Driver assignment required"},403);
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_ENCRYPTION_KEY)return reply({error:"Google Sheets not configured"},503);
  let token;
  try{token=await getAccessToken(env)}catch{return reply({error:"Google Sheets connection unavailable"},503)}
  const endpoint="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(SPREADSHEET_ID)+"/values/"+encodeURIComponent(RANGE)+"?valueRenderOption=FORMATTED_VALUE";
  const response=await fetch(endpoint,{headers:{authorization:"Bearer "+token}});
  if(!response.ok)return reply({error:"Google Sheets read failed",status:response.status},502);
  const data=await response.json(),values=data.values||[];
  const headers=(values[0]||[]).map(v=>String(v).trim());
  if(REQUIRED.some(h=>!headers.includes(h)))return reply({error:"ORDERS sheet headers do not match expected columns"},502);
  const orders=values.slice(1).filter(row=>row.some(v=>String(v??"").trim())).map(row=>{
   const order={};
   for(const h of [...REQUIRED,"Google Maps URL"])if(headers.includes(h))order[h]=String(row[headers.indexOf(h)]??"");
   return order;
  });
  const scoped=actor.role==="driver"?orders.filter(o=>o["Driver ID"]===actor.driver_id):orders;
  // Overlay preview-only status events without mutating Google Sheets.
  const ids=scoped.map(o=>o["Order ID"]);
  if(ids.length){
   const rows=await env.DB.prepare("SELECT order_id,new_status,id FROM driver_status_events ORDER BY id DESC LIMIT 5000").all();
   const latest=new Map();
   for(const e of rows.results||[])if(!latest.has(e.order_id))latest.set(e.order_id,e.new_status);
   for(const o of scoped)if(latest.has(o["Order ID"]))o["Effective Shipping Status"]=latest.get(o["Order ID"]);
  }
  return reply({orders:scoped,source:"google_sheets",scope:actor.role==="driver"?"assigned_driver":"authorized_staff",readOnly:true,statusSource:"d1_overlay"});
 }catch{return safeError()}
}
