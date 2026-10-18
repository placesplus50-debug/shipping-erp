import {reply,currentUser,randomToken} from "../auth/_utils.js";
const CALLBACK="https://feature-d1-auth.shipping-erp.pages.dev/api/google/callback";
export async function onRequestGet({request,env}){
 if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_ENCRYPTION_KEY)return reply({error:"OAuth not configured"},503);
 const actor=await currentUser(request,env).catch(()=>null);
 if(!actor||actor.role!=="super_admin")return reply({error:"Forbidden"},403);
 const state=randomToken();
 await env.DB.prepare("INSERT INTO google_oauth_states(state,user_id,expires_at) VALUES(?,?,?)").bind(state,actor.id,new Date(Date.now()+600000).toISOString()).run();
 const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:"code",scope:"https://www.googleapis.com/auth/spreadsheets",access_type:"offline",prompt:"consent",state}))url.searchParams.set(k,v);
 return Response.redirect(url.toString(),302);
}
