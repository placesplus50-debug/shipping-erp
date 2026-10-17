import {reply,currentUser,safeError} from "./_utils.js";
export async function onRequestGet({request,env}){if(!env.DB)return safeError();try{const u=await currentUser(request,env);return u?reply({authenticated:true,user:{id:u.id,name:u.full_name,email:u.email,role:u.role,driverId:u.driver_id}}):reply({authenticated:false},401)}catch{return safeError()}}
