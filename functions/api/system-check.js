import {reply,currentUser,safeError} from "./auth/_utils.js";
import {onRequestGet as inspectSync} from "./sync-dispatch.js";
import {onRequestGet as readOrders} from "./orders.js";

// Read-only operational checks. This endpoint does not impersonate other roles.
export async function onRequestGet({request,env}){
 if(!env.DB)return safeError();
 try{
  const actor=await currentUser(request,env);
  if(!actor)return reply({error:"Authentication required"},401);
  if(actor.role!=="super_admin")return reply({error:"Super admin only"},403);
  const checks=[];
  const add=(id,label,ok,detail)=>checks.push({id,label,status:ok?"pass":"fail",detail});
  const users=await env.DB.prepare("SELECT id,role,driver_id,is_active FROM users").all();
  const list=users.results||[];
  const invalid=list.filter(u=>!["super_admin","admin","accountant","driver"].includes(u.role)||(u.role==="driver"&&u.is_active===1&&!u.driver_id));
  add("user_roles","أدوار المستخدمين وربط المندوب",invalid.length===0,invalid.length?invalid.length+" حساب يحتاج مراجعة":"جميع الحسابات النشطة لها أدوار وربط صالح");
  const sessionCheck=await env.DB.prepare("SELECT COUNT(*) AS total FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.is_active=0 AND s.revoked_at IS NULL AND s.expires_at > ?").bind(new Date().toISOString()).first();
  add("disabled_sessions","جلسات الحسابات المعطلة",Number(sessionCheck?.total||0)===0,Number(sessionCheck?.total||0)+" جلسة غير ملغاة لحساب معطل");
  const permissionCheck=await env.DB.prepare("SELECT COUNT(*) AS total FROM user_permissions p LEFT JOIN users u ON u.id=p.user_id WHERE u.id IS NULL OR p.permission NOT IN ('orders.read','orders.manage','drivers.manage','collections.read','collections.approve','reports.export','users.manage')").first();
  add("permission_records","سلامة سجلات الصلاحيات",Number(permissionCheck?.total||0)===0,Number(permissionCheck?.total||0)+" سجل صلاحية غير صالح");
  const outbox=await env.DB.prepare("SELECT state,COUNT(*) AS total FROM sheet_sync_outbox GROUP BY state").all();
  const counts=Object.fromEntries((outbox.results||[]).map(x=>[x.state,Number(x.total)]));
  add("outbox","طابور مزامنة Google Sheets",!counts.error&&!counts.pending,JSON.stringify(counts));
  const ordersResponse=await readOrders({request,env});
  if(ordersResponse.ok){
   const data=await ordersResponse.json(),orders=data.orders||[];
   const ids=new Set(),duplicates=[];
   for(const o of orders){if(ids.has(o["Order ID"]))duplicates.push(o["Order ID"]);ids.add(o["Order ID"])}
   add("orders_unique","عدم تكرار أرقام الشحنات",duplicates.length===0,duplicates.length?duplicates.join(", "):orders.length+" شحنة بدون تكرار");
   const drivers=new Set(list.filter(u=>u.role==="driver"&&u.is_active===1).map(u=>u.driver_id));
   checks.push({id:"driver_scope",label:"عزل بيانات المندوبين",status:"manual",detail:"تم التحقق من ربط حسابات المندوبين ("+drivers.size+"). اختبار منع الوصول بحساب مندوب آخر يحتاج اختبار تكامل معزول؛ لم تتم محاكاة هوية أي مستخدم."});
  }else checks.push({id:"orders_source",label:"قراءة الشحنات من Google Sheets",status:"fail",detail:"تعذر قراءة مصدر الشحنات: HTTP "+ordersResponse.status});
  const sync=await inspectSync({request,env});
  if(sync.ok){
   const data=await sync.json(),r=data.reconciliation||{};
   const problems=["missingCollections","duplicateCollections","statusMismatches","missingFollowups","duplicateFollowups","followupMismatches"].reduce((n,k)=>n+(r[k]?.length||0),0);
   const headersOk=Object.values(data.tabs||{}).every(t=>t.headerMatch);
   add("sheets_reconciliation","مطابقة Google Sheets وD1",problems===0&&headersOk&&!(data.pending||[]).length,problems+" اختلاف، "+(data.pending||[]).length+" عملية معلقة");
  }else checks.push({id:"sheets_reconciliation",label:"مطابقة Google Sheets وD1",status:"fail",detail:"تعذر الفحص: HTTP "+sync.status});
  checks.push({id:"role_api",label:"اختبار صلاحيات كل دور على API",status:"manual",detail:"الفحص الحالي لا ينشئ جلسات أو حسابات ولا ينفذ عمليات كتابة. اختبار الرفض الفعلي يحتاج بيئة اختبار معزولة."});
  return reply({readOnly:true,generatedAt:new Date().toISOString(),checks,summary:{passed:checks.filter(c=>c.status==="pass").length,failed:checks.filter(c=>c.status==="fail").length,needsIntegration:checks.filter(c=>c.status==="manual").length},writesPerformed:0});
 }catch(e){return reply({error:"System check unavailable",detail:String(e.message||e).slice(0,140)},503)}
}
