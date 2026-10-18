import {reply,currentUser} from "../auth/_utils.js";
const callbackFor=request=>{const origin=new URL(request.url).origin;if(!["https://feature-d1-auth.shipping-erp.pages.dev","https://shipping-erp.pages.dev"].includes(origin))throw Error("Unsupported OAuth origin");return origin+"/api/google/callback"};
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...b));
async function encryptionKey(secret){const raw=/^[a-f0-9]{64}$/i.test(secret)?Uint8Array.from(secret.match(/.{2}/g),v=>parseInt(v,16)):Uint8Array.from(atob(secret),c=>c.charCodeAt(0));if(raw.length!==32)throw Error("Invalid encryption key");return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt"])}
export async function onRequestGet({request,env}){
 if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_ENCRYPTION_KEY)return reply({error:"OAuth not configured"},503);
 const url=new URL(request.url),state=url.searchParams.get("state"),code=url.searchParams.get("code");
 if(!state||!code||url.searchParams.has("error"))return reply({error:"Authorization not completed"},400);
 const actor=await currentUser(request,env).catch(()=>null);
 if(!actor||actor.role!=="super_admin")return reply({error:"Forbidden"},403);
 const found=await env.DB.prepare("SELECT state FROM google_oauth_states WHERE state=? AND user_id=? AND expires_at>?").bind(state,actor.id,new Date().toISOString()).first();
 if(!found)return reply({error:"Invalid or expired OAuth state"},400);
 await env.DB.prepare("DELETE FROM google_oauth_states WHERE state=?").bind(state).run();
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callbackFor(request),grant_type:"authorization_code"})});
 if(!response.ok)return reply({error:"Google authorization failed"},502);
 const tokens=await response.json();
 if(!tokens.refresh_token)return reply({error:"Google did not issue offline access; retry consent"},400);
 // Validate actual granted scope before replacing the existing encrypted token.
 // No Sheets writes occur during OAuth reconnection.
 const scopeCheck=await fetch("https://oauth2.googleapis.com/tokeninfo?access_token="+encodeURIComponent(tokens.access_token||""));
 if(!scopeCheck.ok)return reply({error:"Could not verify granted Google permissions; previous connection preserved"},502);
 const granted=String((await scopeCheck.json()).scope||"").split(/\s+/);
 if(!granted.includes("https://www.googleapis.com/auth/spreadsheets"))return reply({error:"Google Sheets write permission was not granted; previous connection preserved"},403);
 try{
  let key;try{key=await encryptionKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY)}catch{return reply({error:"Google encryption key is invalid",code:"INVALID_ENCRYPTION_KEY"},503)}
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(tokens.refresh_token)));
  const payload=b64(iv)+"."+b64(encrypted);
  try{await env.DB.prepare("INSERT INTO google_oauth_tokens(id,refresh_token_ciphertext,updated_at) VALUES(1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET refresh_token_ciphertext=excluded.refresh_token_ciphertext,updated_at=CURRENT_TIMESTAMP").bind(payload).run()}catch{return reply({error:"Google token database write failed",code:"TOKEN_DATABASE_WRITE_FAILED"},503)}
  return reply({connected:true,message:"Google Sheets read-write authorization saved; sync still disabled until verified"});
 }catch{return reply({error:"Token encryption failed",code:"TOKEN_ENCRYPTION"},503)}
}
