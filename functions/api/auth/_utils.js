const enc=new TextEncoder();
export const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
export const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function digest(s){return hex(await crypto.subtle.digest("SHA-256",enc.encode(s)))}
export function randomToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:100000,hash:"SHA-256"},key,256);return "pbkdf2-sha256$100000$"+salt+"$"+hex(bits)}
export async function verifyPassword(password,stored){const p=stored.split("$");if(p.length!==4||p[0]!=="pbkdf2-sha256"||p[1]!=="100000")return false;const candidate=await hashPassword(password,p[2]);const a=enc.encode(candidate),b=enc.encode(stored);let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a[i]||0)^(b[i]||0);return mismatch===0}
export const cookie=(token,maxAge)=>"sp_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge;
export function sessionTokens(req){return [...new Set((req.headers.get("cookie")||"").split(";").map(x=>x.trim()).filter(x=>x.startsWith("sp_session=")).map(x=>x.slice(11)).filter(x=>/^[a-f0-9]{64}$/.test(x)))].slice(0,5)}
export function tokenFrom(req){return sessionTokens(req)[0]||""}
export async function currentUser(req,env){
 const db=typeof env.DB.withSession==="function"?env.DB.withSession("first-primary"):env.DB;
 // Duplicate same-name cookies can arise from legacy browser paths; never let a revoked one shadow a valid one.
 for(const token of sessionTokens(req)){
  const u=await db.prepare("SELECT u.id,u.full_name,u.email,u.role,u.driver_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.is_active=1").bind(await digest(token),new Date().toISOString()).first();
  if(u)return u;
 }
 return null;
}
export const sameOrigin=req=>{const origin=req.headers.get("origin");return !!origin&&origin===new URL(req.url).origin};
export const safeError=()=>reply({error:"Server unavailable"},503);
