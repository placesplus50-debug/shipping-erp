import {reply,currentUser,safeError} from "./auth/_utils.js";

// Authorization-only endpoint. No orders are exposed until a server-side
// driver-scoped data source is configured and verified.
export async function onRequestGet({request,env}) {
  if(!env.DB)return safeError();
  try {
    const actor=await currentUser(request,env);
    if(!actor)return reply({error:"Authentication required"},401);
    if(actor.role==="driver"&&!actor.driver_id)return reply({error:"Driver assignment required"},403);
    if(actor.role!=="super_admin"&&actor.role!=="admin"&&actor.role!=="accountant"&&actor.role!=="driver")return reply({error:"Forbidden"},403);
    // Explicitly no demo orders or unfiltered Google Sheet records.
    return reply({orders:[],source:"not_connected",scope:actor.role==="driver"?"assigned_driver":"authorized_staff",readOnly:true});
  }catch{return safeError()}
}
export const onRequestPost=()=>reply({error:"Order writes are disabled until scoped storage and audit logging are ready"},405);
export const onRequestPatch=onRequestPost;
export const onRequestDelete=onRequestPost;
