import test from "node:test";
import assert from "node:assert/strict";
import {mapPreview,validateMapping} from "../core/source-mapper.js";
import {driverMetrics} from "../core/driver-metrics.js";
import {validateOfflineAction} from "../core/offline-queue.js";
const headers=["Order ID","Customer","Driver ID","COD"];
const mapping={externalOrderId:"Order ID",customer:"Customer",driverId:"Driver ID",codDue:"COD"};
test("mapping validates missing required columns",()=>{assert.ok(validateMapping(headers,{...mapping,codDue:"Missing"}).length)});
test("same external order ID is isolated per source",()=>{
 const rows=[["ORD-1","Ali","D1","100"]];
 const a=mapPreview({sourceId:"company-a",headers,rows,mapping});
 const b=mapPreview({sourceId:"company-b",headers,rows,mapping});
 assert.equal(a.orders.length,1);assert.notEqual(a.orders[0].externalKey,b.orders[0].externalKey);
});
test("duplicate IDs in one source are rejected",()=>{
 const result=mapPreview({sourceId:"a",headers,rows:[["ORD-1","Ali","D1","100"],["ORD-1","Ali","D1","100"]],mapping});
 assert.equal(result.orders.length,1);assert.equal(result.duplicates.length,1);
});
test("bad amounts and missing IDs are not imported",()=>{
 const result=mapPreview({sourceId:"a",headers,rows:[["","Ali","D1","100"],["ORD-2","Ali","D1","bad"]],mapping});
 assert.equal(result.invalid.length,2);
});
test("driver status KPIs reconcile",()=>{
 const metrics=driverMetrics([{shippingStatus:"Delivered"},{shippingStatus:"Assigned",codDueCents:2500},{shippingStatus:"Returned"}]);
 assert.equal(metrics.total,metrics.delivered+metrics.active+metrics.returned+metrics.other);
 assert.equal(metrics.codDueCents,2500);
});
test("offline financial actions are blocked",()=>{
 assert.equal(validateOfflineAction({type:"collection",localId:"123456789012",orderKey:"a"}).ok,false);
 assert.equal(validateOfflineAction({type:"shipment_note_draft",localId:"123456789012",orderKey:"a"}).ok,true);
});
