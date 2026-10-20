import {reply,currentUser,safeError} from "./auth/_utils.js";
import {getAccessToken} from "./orders.js";
const spreadsheet="1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M";
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const user=await currentUser(request,env);
  if(!user)return reply({error:"Authentication required"},401);
  if(!["super_admin","admin","accountant","driver"].includes(user.role))return reply({error:"Forbidden"},403);
  const token=await getAccessToken(env);
  const url="https://sheets.googleapis.com/v4/spreadsheets/"+spreadsheet+"/values/"+encodeURIComponent("DRIVERS!A1:E");
  const response=await fetch(url,{headers:{authorization:"Bearer "+token}});
  if(!response.ok)return reply({error:"Driver directory unavailable"},502);
  const values=(await response.json()).values||[];
  const header=(values[0]||[]).map(v=>String(v).trim());
  const id=header.indexOf("Driver ID"),name=header.indexOf("Driver Name");
  if(id<0||name<0)return reply({error:"DRIVERS headers mismatch"},502);
  const drivers=values.slice(1).filter(r=>r[id]&&r[name]).filter(r=>user.role!=="driver"||r[id]===user.driver_id).map(r=>({id:String(r[id]),name:String(r[name])}));
  return reply({drivers,source:"google_sheets",readOnly:true});
 }catch{return safeError()}
}
