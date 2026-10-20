#!/usr/bin/env node
/**
 * Read-only production security smoke tests.
 * Run: node scripts/security-smoke.mjs https://shipping-erp.pages.dev
 * Sends only unauthenticated GET requests; does not create accounts or mutate data.
 */
const base=(process.argv[2]||"https://shipping-erp.pages.dev").replace(/\/$/,"");
const cases=[
 ["admin diagnostics","/api/system-check",[401,403]],
 ["user directory","/api/users",[401,403]],
 ["collections","/api/collections",[401,403]],
 ["driver-scoped orders","/api/orders",[401,403]],
 ["sync diagnostics","/api/sync-dispatch",[401,403]]
];
let failed=0;
for(const [name,path,expected] of cases){
 try{
  const r=await fetch(base+path,{method:"GET",redirect:"manual",headers:{"accept":"application/json","cache-control":"no-cache"}});
  const ok=expected.includes(r.status);
  console.log((ok?"PASS":"FAIL")+" "+name+" — HTTP "+r.status+"; expected "+expected.join(" or "));
  if(!ok){failed++;const body=(await r.text()).slice(0,180);if(body)console.log("  response: "+body.replace(/\s+/g," "));}
 }catch(e){failed++;console.log("FAIL "+name+" — "+String(e.message||e));}
}
console.log("\nResult: "+(cases.length-failed)+"/"+cases.length+" unauthenticated API checks passed.");
console.log("Safety: requests were read-only GETs without session cookies.");
if(failed)process.exitCode=1;
