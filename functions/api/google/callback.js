import {reply,currentUser} from "../auth/_utils.js";
const CALLBACK="https://feature-d1-auth.shipping-erp.pages.dev/api/google/callback";
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...b));
async function encryptionKey(secret){const raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));if(raw.length!==32)throw Error("Invalid encryption key");return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt"])}
export async function onRequestGet({request,env}){
 if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_ENCRYPTION_KEY)return reply({error:"OAuth not configured"},503);
 const url=new URL(request.url),state=url.searchParams.get("state"),code=url.searchParams.get("code");
 if(!state||!code||url.searchParams.has("error"))return reply({error:"Authorization not completed"},400);
 const actor=await currentUser(request,env).catch(()=>null);
 if(!actor||actor.role!=="super_admin")return reply({error:"Forbidden"},403);
 const found=await env.DB.prepare("SELECT state FROM google_oauth_states WHERE state=? AND user_id=? AND expires_at>?").bind(state,actor.id,new Date().toISOString()).first();
 if(!found)return reply({error:"Invalid or expired OAuth state"},400);
 await env.DB.prepare("DELETE FROM google_oauth_states WHERE state=?").bind(state).run();
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:"authorization_code"})});
 if(!response.ok)return reply({error:"Google authorization failed"},502);
 const tokens=await response.json();
 if(!tokens.refresh_token)return reply({error:"Google did not issue offline access; retry consent"},400);
 try{
  const key=await encryptionKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(tokens.refresh_token)));
  const payload=b64(iv)+"."+b64(encrypted);
  await env.DB.prepare("INSERT INTO google_oauth_tokens(id,refresh_token_ciphertext,updated_at) VALUES(1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET refresh_token_ciphertext=excluded.refresh_token_ciphertext,updated_at=CURRENT_TIMESTAMP").bind(payload).run();
  return reply({connected:true,message:"Google Sheets read-only authorization saved"});
 }catch{return reply({error:"Token storage unavailable; run preview migrations and check encryption key"},503)}
}
