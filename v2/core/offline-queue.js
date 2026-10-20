// Pure validation for a future encrypted, authenticated offline queue.
// NO persistence, network retries, or financial writes in this module.
export const OFFLINE_SAFE_ACTIONS=Object.freeze(["shipment_note_draft","proof_of_delivery_draft"]);
export function validateOfflineAction(action){
 if(!action||!OFFLINE_SAFE_ACTIONS.includes(action.type))return {ok:false,reason:"Action must stay online for safety"};
 if(typeof action.localId!=="string"||!/^[a-zA-Z0-9_-]{12,100}$/.test(action.localId))return {ok:false,reason:"Invalid local ID"};
 if(typeof action.orderKey!=="string"||action.orderKey.length>300||!action.orderKey)return {ok:false,reason:"Invalid order key"};
 return {ok:true};
}
