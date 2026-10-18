import {currentUser,reply,safeError} from "./api/auth/_utils.js";

// Protect dashboards at the edge. API authorization is enforced by each API handler.
export async function onRequest({request,env,next}) {
  const url=new URL(request.url);
  const legacy=url.pathname==="/"||url.pathname==="/index.html";
  const driverPage=url.pathname==="/driver.html";
  const collectionsPage=url.pathname==="/collections.html";
  if(!legacy&&!driverPage&&!collectionsPage)return next();
  if(!env.DB)return safeError();
  try {
    const user=await currentUser(request,env);
    if(!user)return Response.redirect(url.origin+"/login.html",302);
    // The legacy dashboard still contains unscoped fixtures; super admins only.
    if(legacy&&user.role!=="super_admin")return Response.redirect(url.origin+(user.role==="driver"?"/driver.html":"/collections.html"),302);
    if(legacy&&user.role==="super_admin")return Response.redirect(url.origin+"/collections.html",302);
    // Driver page must never be served to other roles.
    if(driverPage&&(user.role!=="driver"||!user.driver_id))return reply({error:"Driver access required"},403);
    if(collectionsPage&&!["super_admin","accountant","admin"].includes(user.role))return reply({error:"Accounting access required"},403);
    return next();
  }catch{return safeError()}
}
