import {currentUser,reply,safeError} from "./api/auth/_utils.js";

// Protect dashboards at the edge. API authorization is enforced by each API handler.
export async function onRequest({request,env,next}) {
  const url=new URL(request.url);
  const legacy=url.pathname==="/"||url.pathname==="/index.html";
  const homePage=url.pathname==="/home.html";
  const driverPage=url.pathname==="/driver.html";
  const collectionsPage=url.pathname==="/collections.html";
  const staffPages=url.pathname==="/orders.html"||url.pathname==="/drivers.html";
  if(!legacy&&!homePage&&!driverPage&&!collectionsPage&&!staffPages)return next();
  if(!env.DB)return safeError();
  try {
    const user=await currentUser(request,env);
    if(!user)return Response.redirect(url.origin+"/login.html",302);
    // Route authenticated staff to the new live home dashboard; never serve legacy fixtures.
    if(legacy)return Response.redirect(url.origin+(user.role==="driver"?"/driver.html":"/home.html"),302);
    if((homePage||staffPages)&&!["super_admin","admin","accountant"].includes(user.role))return reply({error:"Accounting access required"},403);
    // Driver page must never be served to other roles.
    if(driverPage&&(user.role!=="driver"||!user.driver_id))return reply({error:"Driver access required"},403);
    if(collectionsPage&&!["super_admin","accountant","admin"].includes(user.role))return reply({error:"Accounting access required"},403);
    return next();
  }catch{return safeError()}
}
