import {reply,currentUser,safeError} from "./auth/_utils.js";

// Read-only Google Sheets adapter. No Sheets write scope or write methods.
const SHEET_ID="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
const COLUMNS=["orderId","orderDate","customer","phone","area","driverId","total","prepaid","codDue","paymentType","shippingStatus","paymentStatus","notes"];
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function googleToken(raw){
 const credentials=JSON.parse(raw);
 if(credentials.type!=="service_account"||!credentials.client_email||!credentials.private_key)throw Error("Invalid service account");
 const now=Math.floor(Date.now()/1000);
 const header=b64url(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claim=b64url(new TextEncoder().encode(JSON.stringify({iss:credentials.client_email,scope:"https://www.googleapis.com/auth/spreadsheets.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3000})));
 const pem=credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(header+"."+claim))));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:header+"."+claim+"."+signature})});
 if(!response.ok)throw Error("Google token unavailable");
 const data=await response.json();return data.access_token;
}
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 let user;try{user=await currentUser(request,env)}catch{return safeError()}
 if(!user)return reply({error:"Authentication required"},401);
 if(!["super_admin","admin","accountant","driver"].includes(user.role))return reply({error:"Forbidden"},403);
 if(user.role==="driver"&&!user.driver_id)return reply({error:"Driver assignment required"},403);
 if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)return reply({error:"Google Sheets connection not configured"},503);
 try{
  const token=await googleToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const url="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(SHEET_ID)+"/values/"+encodeURIComponent("ORDERS!A1:M1000");
  const response=await fetch(url,{headers:{authorization:"Bearer "+token}});
  if(!response.ok)return reply({error:"Google Sheets read unavailable"},502);
  const data=await response.json();
  const rows=(data.values||[]).slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(COLUMNS.map((key,i)=>[key,r[i]??""])));
  // Exact-match driver ID: no user-controlled override and no implicit aliases.
  const orders=user.role==="driver"?rows.filter(o=>o.driverId===user.driver_id):rows;
  return reply({orders,source:"google_sheets",scope:user.role==="driver"?"assigned_driver":"authorized_staff",readOnly:true});
 }catch{return reply({error:"Google Sheets read unavailable"},502)}
}
export const onRequestPost=()=>reply({error:"Read only"},405);
export const onRequestPatch=onRequestPost;
export const onRequestDelete=onRequestPost;
