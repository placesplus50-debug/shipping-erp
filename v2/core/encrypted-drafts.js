// Offline draft vault — browser-only, explicit opt-in and encrypted at rest.
// Drafts are NEVER auto-sent to a server and never contain finance/status changes.
import {validateOfflineAction} from "./offline-queue.js";
const DB_NAME="shipping-pulse-v2-drafts",STORE="drafts";
const encode=new TextEncoder(),decode=new TextDecoder();
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:"localId"});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function transaction(db,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),req=fn(store);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error)})}
function bytesToB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function b64ToBytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
export async function unlockDraftVault(passphrase,saltB64){
 if(typeof passphrase!=="string"||passphrase.length<12)throw Error("Use a passphrase of at least 12 characters");
 const salt=saltB64?b64ToBytes(saltB64):crypto.getRandomValues(new Uint8Array(16));
 const keyMaterial=await crypto.subtle.importKey("raw",encode.encode(passphrase),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},keyMaterial,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
 return {key,saltB64:bytesToB64(salt)};
}
export async function saveDraft(vault,action){
 const result=validateOfflineAction(action);if(!result.ok)throw Error(result.reason);
 const payload={...action,savedAt:new Date().toISOString()};
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv},vault.key,encode.encode(JSON.stringify(payload)));
 const db=await openDB();
 await transaction(db,"readwrite",store=>store.put({localId:action.localId,iv:bytesToB64(iv),data:bytesToB64(new Uint8Array(ciphertext))}));
 return {saved:true,localId:action.localId,localOnly:true};
}
export async function listDraftIds(){const db=await openDB();const records=await transaction(db,"readonly",store=>store.getAllKeys());return records}
export async function readDraft(vault,localId){const db=await openDB();const record=await transaction(db,"readonly",store=>store.get(localId));if(!record)return null;const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(record.iv)},vault.key,b64ToBytes(record.data));return JSON.parse(decode.decode(clear))}
export async function deleteDraft(localId){const db=await openDB();await transaction(db,"readwrite",store=>store.delete(localId))}
