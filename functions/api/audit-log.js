import {reply,currentUser,safeError} from "./auth/_utils.js";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin"].includes(actor.role))return reply({error:"Forbidden"},403);
  const url=new URL(request.url);
  const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50));
  const before=Number(url.searchParams.get("before"));
  if(url.searchParams.has("before")&&(!Number.isSafeInteger(before)||before<1))return reply({error:"Invalid cursor"},400);
  const action=String(url.searchParams.get("action")||"").trim();
  if(action.length>80||action&&!/^[a-zA-Z0-9._-]+$/.test(action))return reply({error:"Invalid filter"},400);
  const rows=await env.DB.prepare("SELECT a.id,a.user_id,u.email AS actor_email,a.action,a.entity_type,a.entity_id,a.details,a.created_at FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE (? IS NULL OR a.id<?) AND (?='' OR a.action=?) ORDER BY a.id DESC LIMIT ?").bind(Number.isSafeInteger(before)&&before>0?before:null,Number.isSafeInteger(before)&&before>0?before:null,action,action,limit+1).all();
  const all=rows.results||[],hasMore=all.length>limit,items=all.slice(0,limit);
  return reply({readOnly:true,events:items,hasMore,nextBefore:hasMore?items[items.length-1]?.id:null});
 }catch{return safeError()}
}
