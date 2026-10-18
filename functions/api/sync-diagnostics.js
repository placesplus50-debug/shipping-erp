import {reply,currentUser,safeError} from "./auth/_utils.js";
import {getAccessToken} from "./orders.js";
const spreadsheetId="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin"].includes(user.role))return reply({error:"Admin only"},403);
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
  let outbox="migration_required";
  try{
   const found=await env.DB.prepare("SELECT COUNT(*) AS total FROM sheet_sync_outbox").first();
   outbox={available:true,total:found?.total||0};
  }catch{}
  return reply({mode:"read_only_diagnostic",googleSheetsModified:false,spreadsheetId,tabs,outbox,writeSyncEnabled:false});
 }catch{return safeError()}
}
export const onRequestPost=()=>reply({error:"Read-only diagnostic"},405);
