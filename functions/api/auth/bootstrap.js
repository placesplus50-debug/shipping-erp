import {reply,hashPassword,sameOrigin,safeError} from "./_utils.js";
// One-time initialization. Requires BOOTSTRAP_SECRET in Pages secrets.
// Remove BOOTSTRAP_SECRET after first admin is created.
export async function onRequestPost({request,env}){if(!sameOrigin(request))return reply({error:"Forbidden origin"},403);if(!env.DB||!env.BOOTSTRAP_SECRET||env.BOOTSTRAP_SECRET.length<32)return reply({error:"Bootstrap disabled"},403);
let b;try{b=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
if(typeof b.secret!=="string"||b.secret!==env.BOOTSTRAP_SECRET)return reply({error:"Forbidden"},403);
const email=String(b.email||"").trim().toLowerCase(),name=String(b.name||"").trim(),password=String(b.password||"");
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<2||password.length<14||password.length>256)return reply({error:"Invalid admin details"},400);
try{const existing=await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();if(existing.n!==0)return reply({error:"Bootstrap already completed"},409);
const hash=await hashPassword(password);await env.DB.prepare("INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,'super_admin')").bind(name,email,hash).run();return reply({ok:true,message:"Super Admin created. Remove BOOTSTRAP_SECRET now."},201)}catch{return safeError()}}
