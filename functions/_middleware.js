import {currentUser,reply,safeError} from "./api/auth/_utils.js";

// Protect the legacy demo dashboard at the edge. API authorization remains
// the responsibility of each API handler; this middleware does not grant access.
export async function onRequest({request,env,next}) {
  const url=new URL(request.url);
  if(url.pathname!=="/"&&url.pathname!=="/index.html")return next();
  if(!env.DB)return safeError();
  try {
    const user=await currentUser(request,env);
    if(!user)return Response.redirect(url.origin+"/login.html",302);
    // Legacy HTML contains unscoped sample shipments and has no server-side
    // per-driver filtering yet. Fail closed for non-super-admin roles.
    if(user.role!=="super_admin")return reply({error:"Dashboard access pending role-scoped API"},403);
    return next();
  }catch{return safeError()}
}
