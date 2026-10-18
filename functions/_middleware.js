import {currentUser,reply,safeError} from "./api/auth/_utils.js";

// Protect dashboards at the edge. API authorization is enforced by each API handler.
export async function onRequest({request,env,next}) {
  const url=new URL(request.url);
  const legacy=url.pathname==="/"||url.pathname==="/index.html";
  const driverPage=url.pathname==="/driver.html";
  if(!legacy&&!driverPage)return next();
  if(!env.DB)return safeError();
  try {
    const user=await currentUser(request,env);
    if(!user)return Response.redirect(url.origin+"/login.html",302);
    // The legacy dashboard still contains unscoped fixtures; super admins only.
    if(legacy&&user.role!=="super_admin")return reply({error:"Dashboard access pending role-scoped API"},403);
    // Driver page must never be served to other roles.
    if(driverPage&&(user.role!=="driver"||!user.driver_id))return reply({error:"Driver access required"},403);
    return next();
  }catch{return safeError()}
}
