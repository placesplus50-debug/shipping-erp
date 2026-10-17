import {reply,digest,randomToken,verifyPassword,cookie,sameOrigin,safeError} from "./_utils.js";
export async function onRequestPost({request,env}){if(!sameOrigin(request))return reply({error:"Forbidden origin"},403);if(!env.DB)return safeError();let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");if(!email||password.length>1024)return reply({error:"Invalid credentials"},401);
try{const user=await env.DB.prepare("SELECT id,full_name,email,role,driver_id,password_hash FROM users WHERE email=? AND is_active=1").bind(email).first();
if(!user||!(await verifyPassword(password,user.password_hash)))return reply({error:"Invalid credentials"},401);
const token=randomToken(),expires=new Date(Date.now()+8*3600000).toISOString();await env.DB.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)").bind(user.id,await digest(token),expires).run();
await env.DB.prepare("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(?,?,?,?)").bind(user.id,"login","user",String(user.id)).run();
return reply({authenticated:true,user:{id:user.id,name:user.full_name,email:user.email,role:user.role,driverId:user.driver_id}},200,{"set-cookie":cookie(token,28800)});
}catch{return safeError()}}
export const onRequestGet=()=>reply({error:"Method not allowed"},405);
