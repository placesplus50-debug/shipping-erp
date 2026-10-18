import {reply,currentUser,safeError} from "./auth/_utils.js";
import {getAccessToken} from "./orders.js";
const spreadsheetId="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant"].includes(user.role))return reply({error:"Accounting staff only"},403);
  const token=await getAccessToken(env);
  const tabs={};
  for(const tab of ["TRACKING","COLLECTIONS"]){
   const range=encodeURIComponent(tab+"!A1:AZ1");
   const url="https://sheets.googleapis.com/v4/spreadsheets/"+spreadsheetId+"/values/"+range;
   const response=await fetch(url,{headers:{authorization:"Bearer "+token}});
   if(!response.ok)return reply({error:"Unable to inspect "+tab,status:response.status},502);
   const data=await response.json();
   tabs[tab]={headers:(data.values?.[0]||[]).map(v=>String(v).trim())};
  }
  // Inspect granted OAuth scopes without attempting any write to Sheets.
  let googleWriteScope="unknown";
  try{
   const row=await env.DB.prepare("SELECT refresh_token_ciphertext FROM google_oauth_tokens WHERE id=1").first();
   if(row?.refresh_token_ciphertext){
    const [iv,data]=row.refresh_token_ciphertext.split(".");
    const bytes=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey("raw",bytes(env.GOOGLE_TOKEN_ENCRYPTION_KEY),{name:"AES-GCM"},false,["decrypt"]);
    // OAuth refresh token itself does not encode scopes; do not infer write permission.
    googleWriteScope="not_verified";
   }
  }catch{googleWriteScope="unavailable"}
  let outbox="migration_required";
  try{
   const found=await env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN state='sent' THEN 1 ELSE 0 END) AS sent,SUM(CASE WHEN state!='sent' THEN 1 ELSE 0 END) AS pending FROM sheet_sync_outbox").first();
   outbox={available:true,total:found?.total||0,sent:found?.sent||0,pending:found?.pending||0};
  }catch{}
  return reply({mode:"read_only_diagnostic",googleSheetsModified:false,spreadsheetId,tabs,outbox,googleWriteScope,writeSyncEnabled:env.SHEETS_SYNC_ENABLED==="true"});
 }catch{return safeError()}
}
export const onRequestPost=()=>reply({error:"Read-only diagnostic"},405);
