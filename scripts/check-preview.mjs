import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';

function walk(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):entry.name.endsWith('.js')?[join(dir,entry.name)]:[]);
}
for(const path of walk('functions'))new Script(readFileSync(path,'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,''),{filename:path});
for(const path of ['driver.html','collections.html','login.html','home.html']){
 const html=readFileSync(path,'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.ok(scripts.length,path+' must have inline scripts');
 for(const script of scripts)new Script(script,{filename:path});
}
const middleware=readFileSync('functions/_middleware.js','utf8');
assert.ok(middleware.includes('"/home.html"'),'staff home redirect required');
assert.ok(middleware.includes('if(homePage&&!["super_admin","admin","accountant"].includes(user.role))'),'home must be role-protected');
const dispatcher=readFileSync('functions/api/sync-dispatch.js','utf8');
assert.ok(dispatcher.includes('env.SHEETS_SYNC_ENABLED!=="true"'),'Sheets writes must remain gated');
const driver=readFileSync('driver.html','utf8');
const api=readFileSync('functions/api/collections.js','utf8');
const status=readFileSync('functions/api/driver-status.js','utf8');
assert.ok(api.includes('SELECT ?,?,?,?,?,?,?,? WHERE ? >= ? +'),'COD limit must be checked in atomic insert');
assert.ok(api.includes('sameOrigin(request)'),'mutations must enforce same origin');
assert.ok(api.includes('actor.role!=="driver"'),'collections must restrict drivers');
assert.ok(api.includes('["super_admin","accountant","admin"].includes(actor.role)'),'reviews and handovers must restrict staff');
assert.ok(status.includes('WHERE COALESCE((SELECT new_status'),'status update must be guarded');
const match=driver.match(/function remaining\(o\)\{[^\n]*\}/);
assert.ok(match,'remaining balance calculation missing');
const claims=[{order_id:'ORD-1006',amount_cents:175000,decision:'approved'},{order_id:'ORD-1006',amount_cents:50000,decision:'rejected'}];
const remaining=runInNewContext('('+match[0]+')',{claims});
assert.equal(remaining({'Order ID':'ORD-1006','COD Due':'1,750'}),0);
assert.equal(remaining({'Order ID':'ORD-1007','COD Due':'900'}),900);
console.log('Preview static syntax, authorization guard, and COD balance checks passed.');
