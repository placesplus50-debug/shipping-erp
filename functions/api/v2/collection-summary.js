import {reply,currentUser,safeError} from "../auth/_utils.js";
import {onRequestGet as getCollections} from "../collections.js";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["driver","admin","super_admin","accountant"].includes(actor.role))return reply({error:"Forbidden"},403);
  // Reuse collection endpoint's existing role and assigned-order scoping.
  const result=await getCollections({request,env});
  if(!result.ok)return reply({error:"Collections unavailable"},503);
  const data=await result.json();
  if(data.truncated)return reply({error:"Collection history incomplete; balances unavailable"},409);
  const summary={pendingReviewCents:0,approvedDriverCashCents:0,handedOverCashCents:0,rejectedCents:0,companyHeldCents:0,records:0};
  for(const e of data.collections||[]){
   const amount=Number(e.amount_cents);
   if(!Number.isSafeInteger(amount)||amount<0)continue;
   summary.records++;
   if(e.decision==="rejected"){summary.rejectedCents+=amount;continue}
   if(!e.decision){summary.pendingReviewCents+=amount;continue}
   if(e.decision!=="approved")continue;
   if(e.method==="cash"&&e.holder==="driver"){
    if(e.handover_id!=null)summary.handedOverCashCents+=amount;
    else summary.approvedDriverCashCents+=amount;
   }else if(e.holder==="company")summary.companyHeldCents+=amount;
  }
  return reply({summary,scope:data.scope,readOnly:true,asOf:new Date().toISOString()});
 }catch{return safeError()}
}
export const onRequestPost=()=>reply({error:"Method not allowed"},405);
