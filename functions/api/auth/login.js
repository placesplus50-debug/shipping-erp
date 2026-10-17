import {reply,digest,randomToken,verifyPassword,cookie,sameOrigin,safeError} from "./_utils.js";
const WINDOW=15*60,MAX_ATTEMPTS=5;
export async function onRequestPost({request,env}){
  if(!sameOrigin(request))return reply({error:"Forbidden origin"},403);
  if(!env.DB||!env.AUTH_RATE_LIMIT_KEY||env.AUTH_RATE_LIMIT_KEY.length<32)return safeError();
  let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
  const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
  if(!email||email.length>254||password.length>1024)return reply({error:"Invalid credentials"},401);
  // HMAC prevents exposing email addresses in the throttle table.
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.AUTH_RATE_LIMIT_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(email));
  const identity=[...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,"0")).join("");
  const now=Math.floor(Date.now()/1000);
  try{
    const state=await env.DB.prepare("SELECT attempts,window_start,blocked_until FROM auth_attempts WHERE identity_hash=?").bind(identity).first();
    if(state&&state.blocked_until>now)return reply({error:"Too many attempts. Try later."},429,{"retry-after":String(state.blocked_until-now)});
    // Record attempts BEFORE checking credentials. Missing migration fails closed.
    await env.DB.prepare(`INSERT INTO auth_attempts(identity_hash,attempts,window_start,blocked_until) VALUES(?,1,?,0)
      ON CONFLICT(identity_hash) DO UPDATE SET
      attempts=CASE WHEN window_start < ? THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END,
      blocked_until=CASE WHEN window_start >= ? AND attempts+1 >= ? THEN ? ELSE 0 END`)
      .bind(identity,now,now-WINDOW,now-WINDOW,now-WINDOW,MAX_ATTEMPTS,now+WINDOW).run();
    const updated=await env.DB.prepare("SELECT blocked_until FROM auth_attempts WHERE identity_hash=?").bind(identity).first();
    if(updated.blocked_until>now)return reply({error:"Too many attempts. Try later."},429,{"retry-after":String(updated.blocked_until-now)});
    const user=await env.DB.prepare("SELECT id,full_name,email,role,driver_id,password_hash FROM users WHERE email=? AND is_active=1").bind(email).first();
    if(!user||!(await verifyPassword(password,user.password_hash)))return reply({error:"Invalid credentials"},401);
    const token=randomToken(),expires=new Date(Date.now()+8*3600000).toISOString();
    await env.DB.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)").bind(user.id,await digest(token),expires).run();
    await env.DB.prepare("DELETE FROM auth_attempts WHERE identity_hash=?").bind(identity).run();
    await env.DB.prepare("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(?,?,?,?)").bind(user.id,"login","user",String(user.id)).run();
    return reply({authenticated:true,user:{id:user.id,name:user.full_name,email:user.email,role:user.role,driverId:user.driver_id}},200,{"set-cookie":cookie(token,28800)});
  }catch{return safeError()}
}
export const onRequestGet=()=>reply({error:"Method not allowed"},405);
