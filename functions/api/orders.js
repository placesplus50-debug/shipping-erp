import {reply,currentUser,safeError} from "./auth/_utils.js";

// Static fixtures for permission testing only. No real customer information.
// Never trust driverId or role supplied in a query parameter.
const ORDERS=Object.freeze([
 {id:"TEST-1001",driverId:"DRV-ALI",status:"assigned",paymentStatus:"cod",amount:450},
 {id:"TEST-1002",driverId:"DRV-ALI",status:"delivered",paymentStatus:"prepaid",amount:0},
 {id:"TEST-1003",driverId:"DRV-ANAS",status:"assigned",paymentStatus:"cod",amount:820},
 {id:"TEST-1004",driverId:"DRV-MAHMOUD",status:"returned",paymentStatus:"cod",amount:300},
 {id:"TEST-1005",driverId:"DRV-HUSSEIN",status:"assigned",paymentStatus:"prepaid",amount:0}
]);
export async function onRequestGet({request,env}) {
 if(!env.DB)return safeError();
 try {
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant","driver"].includes(actor.role))return reply({error:"Forbidden"},403);
  if(actor.role==="driver"&&!actor.driver_id)return reply({error:"Driver assignment required"},403);
  const orders=actor.role==="driver"?ORDERS.filter(o=>o.driverId===actor.driver_id):ORDERS;
  return reply({orders,source:"static_test_fixtures",scope:actor.role==="driver"?"assigned_driver":"authorized_staff",readOnly:true});
 }catch{return safeError()}
}
const noWrite=()=>reply({error:"Order changes disabled in test fixtures"},405);
export const onRequestPost=noWrite;
export const onRequestPatch=noWrite;
export const onRequestDelete=noWrite;
