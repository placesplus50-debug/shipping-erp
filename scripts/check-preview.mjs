import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';

function walk(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):entry.name.endsWith('.js')?[join(dir,entry.name)]:[]);
}
for(const path of walk('functions'))new Script(readFileSync(path,'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,''),{filename:path});
for(const path of ['driver.html','collections.html','login.html','home.html','orders.html','drivers.html','users.html']){
 const html=readFileSync(path,'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.ok(scripts.length,path+' must have inline scripts');
 for(const script of scripts)new Script(script,{filename:path});
}
for(const page of ['orders.html','drivers.html']){
 const html=readFileSync(page,'utf8');
 assert.ok(html.includes('<dialog id="detailDialog"'),'details popup missing: '+page);
 assert.ok(html.includes('dlg.showModal()'),'popup must be functional: '+page);
 assert.ok(html.includes("tr.onkeydown=e=>"),'keyboard access required: '+page);
 assert.ok(html.includes("credentials:'same-origin'"),'authenticated order fetch required: '+page);
}
const home=readFileSync('home.html','utf8');
const collections=readFileSync('collections.html','utf8');
assert.ok(home.includes('href="/orders.html"')&&home.includes('href="/drivers.html"'),'dashboard links must navigate');
assert.ok(collections.includes('href="/home.html"'),'collections must have home navigation');
const middleware=readFileSync('functions/_middleware.js','utf8');
assert.ok(middleware.includes('staffPages'),'orders and drivers must be protected');
assert.ok(middleware.includes('"/home.html"'),'staff home redirect required');
assert.ok(middleware.includes('if((homePage||staffPages)&&!["super_admin","admin","accountant"].includes(user.role))'),'home must be role-protected');
const oauthStart=readFileSync('functions/api/google/start.js','utf8');
const oauthCallback=readFileSync('functions/api/google/callback.js','utf8');
assert.ok(oauthStart.includes('scope:"https://www.googleapis.com/auth/spreadsheets"'),'OAuth must request write scope');
assert.ok(oauthCallback.includes('previous connection preserved'),'OAuth must preserve existing token on missing permissions');
assert.ok(oauthCallback.includes('googleapis.com/auth/spreadsheets'),'callback must validate write scope');
const dispatcher=readFileSync('functions/api/sync-dispatch.js','utf8');
assert.ok(dispatcher.includes('env.SHEETS_SYNC_ENABLED!=="true"'),'Sheets writes must remain gated');
assert.ok(dispatcher.includes("synced_at=CURRENT_TIMESTAMP WHERE id=? AND state!='sent'"),'dispatch must atomically lease rows');
for(const file of ['functions/api/collections.js','functions/api/driver-status.js'])assert.ok(readFileSync(file,'utf8').includes('waitUntil(dispatchPending(env)'),'mutations must schedule immediate sync: '+file);
assert.ok(collections.includes('function showDialog('),'accountant confirmation modal required');
const driver=readFileSync('driver.html','utf8');
assert.ok(driver.includes('function notice('),'driver confirmation modal required');
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

for(const page of ['home.html','orders.html','drivers.html','collections.html','users.html','driver.html']){const html=readFileSync(page,'utf8');assert.ok(html.includes('id="spBack"'),'missing back button '+page);assert.ok(html.includes('class="sp-navigation"'),'missing shared navigation '+page);assert.ok(html.includes('id="spLogout"'),'logout missing '+page);assert.ok(html.includes('/assets/app-shell.css'),'shared styles missing '+page);assert.ok(html.includes('/assets/app-shell.js'),'shared session handling missing '+page)}
assert.ok(readFileSync('driver.html','utf8').includes('id="spLogout"'),'driver logout missing');
assert.ok(readFileSync('login.html','utf8').includes('linear-gradient(135deg,#201431'),'login brand theme missing');


new Script(readFileSync('assets/app-shell.js','utf8'),{filename:'assets/app-shell.js'});
