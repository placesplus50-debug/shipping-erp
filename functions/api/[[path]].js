// Shipping Pulse / Cloudflare Pages Functions
// Secure read-only Google Sheets gateway. No public sheet data without a verified
// Cloudflare Access JWT. Fails closed until Access and Google secrets are configured.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
function b64urlDecode(s){const str=atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"="));return Uint8Array.from(str,c=>c.charCodeAt(0))}
function decodeJson(s){return JSON.parse(new TextDecoder().decode(b64urlDecode(s)))}
async function authenticate(request,env){
  if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)throw Error("Access not configured");
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token)throw Error("Missing Access token");
  const parts=token.split(".");if(parts.length!==3)throw Error("Invalid JWT");
  const header=decodeJson(parts[0]),claims=decodeJson(parts[1]);
  if(header.alg!=="RS256"||!header.kid)throw Error("Unsupported JWT");
  const domain=env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain))throw Error("Invalid Access domain");
  const issuer="https://"+domain;
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==issuer||!aud.includes(env.ACCESS_AUD)||!claims.exp||claims.exp<=now||claims.nbf>now||!claims.email)throw Error("Access claims invalid");
  const keys=await fetch(issuer+"/cdn-cgi/access/certs",{cf:{cacheTtl:300}}).then(r=>{if(!r.ok)throw Error("Access key lookup failed");return r.json()});
  const jwk=(keys.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
  if(!jwk)throw Error("Unknown Access key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64urlDecode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!ok)throw Error("Invalid Access signature");
  const email=String(claims.email).toLowerCase();
  let roles={};try{roles=JSON.parse(env.USER_ROLES_JSON||"{}")}catch{throw Error("Invalid roles configuration")}
  const role=roles[email];if(!["admin","accountant","driver"].includes(role))throw Error("User not authorized");
  return {email,role};
}
async function googleToken(env){
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)throw Error("Google credentials not configured");
  const account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if(!account.client_email||!account.private_key)throw Error("Invalid service account");
  const enc=new TextEncoder();
  const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const now=Math.floor(Date.now()/1000);
  const head=b64(enc.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const body=b64(enc.encode(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/spreadsheets.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3300})));
  const pkcs8=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",pkcs8,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(head+"."+body)));
  const resp=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:head+"."+body+"."+sig})});
  if(!resp.ok)throw Error("Google authorization failed");
  return (await resp.json()).access_token;
}
async function readSheet(env,token,name){
  if(!env.SPREADSHEET_ID)throw Error("Spreadsheet not configured");
  const range=encodeURIComponent("'"+name+"'!A1:M2000");
  const url="https://sheets.googleapis.com/v4/spreadsheets/"+encodeURIComponent(env.SPREADSHEET_ID)+"/values/"+range;
  const resp=await fetch(url,{headers:{authorization:"Bearer "+token}});
  if(!resp.ok)throw Error("Google Sheets read failed");
  const values=(await resp.json()).values||[];
  const header=values.shift()||[];
  return values.filter(r=>r.some(v=>String(v).trim())).map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]??""])));
}
export async function onRequest(context){
  const {request,env}=context;
  const url=new URL(request.url);
  if(request.method!=="GET")return json({error:"Method not allowed"},405);
  if(url.pathname==="/api/health")return json({ok:true,mode:"secure-readonly",configured:!!(env.ACCESS_AUD&&env.GOOGLE_SERVICE_ACCOUNT_JSON&&env.SPREADSHEET_ID)});
  if(url.pathname!=="/api/session"&&url.pathname!=="/api/orders")return json({error:"Not found"},404);
  let user;try{user=await authenticate(request,env)}catch{return json({error:"Authentication required or access denied"},401)}
  if(url.pathname==="/api/session")return json({authenticated:true,role:user.role,email:user.email});
  try{
    const token=await googleToken(env);
    const [orders,drivers]=await Promise.all([readSheet(env,token,"ORDERS"),readSheet(env,token,"DRIVERS")]);
    let allowed=orders;
    if(user.role==="driver"){
      const driver=drivers.find(d=>String(d["Email"]||"").toLowerCase()===user.email&&String(d["Active"]).toLowerCase()==="yes");
      // Driver identity MUST be explicitly mapped to a verified email; never
      // infer it from a selected name or trust a query parameter.
      if(!driver)return json({error:"Driver account not mapped to a verified email"},403);
      allowed=orders.filter(o=>o["Driver ID"]===driver["Driver ID"]);
    }
    // Phone and private notes excluded from this operational summary endpoint.
    const safe=allowed.map(o=>({id:o["Order ID"],date:o["Order Date"],customer:o["Customer"],area:o["City / Area"],driverId:o["Driver ID"],total:Number(o["Order Total"]||0),prepaid:Number(o["Prepaid Amount"]||0),codDue:Number(o["COD Due"]||0),paymentType:o["Payment Type"],shippingStatus:o["Shipping Status"],paymentStatus:o["Payment Status"]}));
    return json({mode:"live-readonly",role:user.role,orders:safe});
  }catch{return json({error:"Secure data source is unavailable"},503)}
}
