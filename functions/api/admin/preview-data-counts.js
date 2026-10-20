import {reply,currentUser} from "../auth/_utils.js";
const TABLES=["driver_status_events","collection_events","collection_reviews","cash_handover","sheet_sync_outbox"];
export async function onRequestGet({request,env}){
 if(!["https://feature-d1-auth.shipping-erp.pages.dev","https://02337136.shipping-erp.pages.dev"].includes(new URL(request.url).origin))return reply({error:"Preview only"},403);
 const user=await currentUser(request,env).catch(()=>null);
 if(!user||user.role!=="super_admin")return reply({error:"Super admin required"},403);
 try{
  const counts={};
  for(const name of TABLES){const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM "+name).first();counts[name]=r.n}
  return reply({ok:true,source:"preview",counts,notice:"Read-only inspection. No records changed."});
 }catch{return reply({error:"Could not inspect preview tables"},503)}
}
