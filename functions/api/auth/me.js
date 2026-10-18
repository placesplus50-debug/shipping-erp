import {reply,currentUser,tokenFrom,digest,safeError} from "./_utils.js";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const token=tokenFrom(request);
  const u=await currentUser(request,env);
  if(u)return reply({authenticated:true,user:{id:u.id,name:u.full_name,email:u.email,role:u.role,driverId:u.driver_id}});
  // Diagnostics never expose session tokens, hashes, emails, or user identifiers.
  if(!token)return reply({authenticated:false,diagnostic:{reason:"cookie_missing"}},401);
  if(!/^[a-f0-9]{64}$/.test(token))return reply({authenticated:false,diagnostic:{reason:"cookie_invalid_format"}},401);
  const db=typeof env.DB.withSession==="function"?env.DB.withSession("first-primary"):env.DB;
  const row=await db.prepare("SELECT s.expires_at,s.revoked_at,u.is_active FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE s.token_hash=?").bind(await digest(token)).first();
  const reason=!row?"session_not_found":row.revoked_at?"session_revoked":!row.is_active?"user_inactive":String(row.expires_at)<=new Date().toISOString()?"session_expired":"session_lookup_mismatch";
  return reply({authenticated:false,diagnostic:{reason}},401);
 }catch{return safeError()}
}
