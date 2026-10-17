import {reply,currentUser,hashPassword,sameOrigin,safeError} from "./auth/_utils.js";
const ROLES=["admin","accountant","driver"];
const PERMISSIONS=["orders.read","orders.manage","drivers.manage","collections.read","collections.approve","reports.export","users.manage"];
async function superAdmin(request,env){const user=await currentUser(request,env);return user?.role==="super_admin"?user:null}
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{const actor=await superAdmin(request,env);if(!actor)return reply({error:"Forbidden"},403);
 const {results}=await env.DB.prepare("SELECT id,full_name,email,role,driver_id,is_active,created_at FROM users ORDER BY id").all();
 const {results:grants}=await env.DB.prepare("SELECT user_id,permission,granted FROM user_permissions").all();
 return reply({users:results.map(u=>({...u,permissions:grants.filter(p=>p.user_id===u.id&&p.granted===1).map(p=>p.permission)}))});
 }catch{return safeError()}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return reply({error:"Forbidden origin"},403);
 if(!env.DB)return safeError();
 try{const actor=await superAdmin(request,env);if(!actor)return reply({error:"Forbidden"},403);
 const b=await request.json(),name=String(b.name||"").trim(),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||""),role=String(b.role||""),driverId=b.driverId==null?null:String(b.driverId).trim();
 const permissions=Array.isArray(b.permissions)?b.permissions:[];
 if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<14||password.length>256||!ROLES.includes(role)||permissions.some(p=>!PERMISSIONS.includes(p))||(role==="driver"&&!driverId))return reply({error:"Invalid user details"},400);
 const hash=await hashPassword(password);
 const result=await env.DB.prepare("INSERT INTO users(full_name,email,password_hash,role,driver_id) VALUES(?,?,?,?,?)").bind(name,email,hash,role,role==="driver"?driverId:null).run();
 const id=result.meta.last_row_id;
 for(const p of [...new Set(permissions)])await env.DB.prepare("INSERT INTO user_permissions(user_id,permission,granted) VALUES(?,?,1)").bind(id,p).run();
 await env.DB.prepare("INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)").bind(actor.id,"user.create","user",String(id),JSON.stringify({role,permissions})).run();
 return reply({ok:true,id},201);
 }catch{return safeError()}
}
export async function onRequestPatch({request,env}){
 if(!sameOrigin(request))return reply({error:"Forbidden origin"},403);
 if(!env.DB)return safeError();
 try{const actor=await superAdmin(request,env);if(!actor)return reply({error:"Forbidden"},403);
 const b=await request.json(),id=Number(b.id),target=await env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(id).first();
 if(!target||target.role==="super_admin"||id===actor.id)return reply({error:"Protected user"},403);
 const role=String(b.role||target.role),active=b.isActive===undefined?undefined:(b.isActive?1:0),permissions=b.permissions;
 if(!ROLES.includes(role)||permissions!==undefined&&(!Array.isArray(permissions)||permissions.some(p=>!PERMISSIONS.includes(p))))return reply({error:"Invalid change"},400);
 await env.DB.prepare("UPDATE users SET role=?,is_active=COALESCE(?,is_active),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(role,active??null,id).run();
 if(Array.isArray(permissions)){await env.DB.prepare("DELETE FROM user_permissions WHERE user_id=?").bind(id).run();for(const p of [...new Set(permissions)])await env.DB.prepare("INSERT INTO user_permissions(user_id,permission,granted) VALUES(?,?,1)").bind(id,p).run()}
 if(active===0)await env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND revoked_at IS NULL").bind(id).run();
 await env.DB.prepare("INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(?,?,?,?)").bind(actor.id,"user.update","user",String(id)).run();
 return reply({ok:true});
 }catch{return safeError()}
}
