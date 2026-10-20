import test from "node:test";
import assert from "node:assert/strict";
import {safeAmount,dashboardReport,reconcileCollections} from "../core/operations-report.js";
import {dispatchPreview} from "../core/dispatch-planner.js";
test("money parsing rejects unsafe amounts",()=>{
 assert.equal(safeAmount("1,234.50"),123450);
 for(const s of ["","-1","12.345","1e3","Infinity","1,2,3","=SUM(A1)"])assert.equal(safeAmount(s),null);
});
test("dashboard separates delivered and exceptions and never assumes collection",()=>{
 const result=dashboardReport([
  {"Order ID":"ORD-1","Driver ID":"D1","COD Due":"250.50","Shipping Status":"Delivered"},
  {"Order ID":"ORD-2","Driver ID":"","COD Due":"100","Shipping Status":"Returned"},
  {"Order ID":"ORD-3","Driver ID":"D1","COD Due":"0","Shipping Status":"Assigned"}
 ]);
 assert.deepEqual([result.stats.total,result.stats.delivered,result.stats.exception,result.stats.active],[3,1,1,1]);
 assert.equal(result.stats.codDueCents,35050);
 assert.equal(result.stats.financeIsAuthoritative,undefined);
 assert.equal(result.financeIsAuthoritative,false);
 assert.ok(result.alerts.some(a=>a.type==="reconcile_cod"&&a.orderId==="ORD-1"));
});
test("reconciliation includes reversal and flags difference",()=>{
 const orders=[{"Order ID":"ORD-1","COD Due":"100"}];
 const result=reconcileCollections(orders,[{orderId:"ORD-1",type:"collection",amountCents:10000},{orderId:"ORD-1",type:"reversal",amountCents:2000}]);
 assert.equal(result.results[0].differenceCents,2000);
});
test("dispatch excludes assigned and closed orders and respects capacity",()=>{
 const orders=[
  {"Order ID":"ORD-1","City / Area":"Nasr","Shipping Status":"Assigned"},
  {"Order ID":"ORD-2","City / Area":"Nasr","Shipping Status":"Assigned"},
  {"Order ID":"ORD-3","City / Area":"Nasr","Driver ID":"D2","Shipping Status":"Assigned"},
  {"Order ID":"ORD-4","City / Area":"Nasr","Shipping Status":"Delivered"}
 ];
 const out=dispatchPreview(orders,[{id:"D1",areas:["Nasr"],capacity:1}]);
 assert.equal(out.suggestions.length,1);
 assert.equal(out.skipped.length,3);
 assert.equal(out.readOnly,true);
});
