/* Shared presentation/session handling. API authorization and business rules stay server-side. */
window.SP = (() => {
  const dom = new Promise(resolve => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', resolve, {once:true}) : resolve());
  let user;
  const ready = dom.then(async () => {
    const status = document.getElementById('spShellStatus');
    const page = document.body.dataset.page;
    const menu = document.getElementById('spMenu');
    const shade = document.getElementById('spShade');
    const sidebar = document.getElementById('spSidebar');
    const setMenu = open => {
      document.body.classList.toggle('sp-menu-open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
      shade.hidden = !open;
      if(open) sidebar.querySelector('a:not([hidden])')?.focus();
      else menu.focus();
    };
    menu.addEventListener('click', () => setMenu(!document.body.classList.contains('sp-menu-open')));
    shade.addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', e => {if(e.key==='Escape' && document.body.classList.contains('sp-menu-open'))setMenu(false)});
    // Existing collection forms keep their original submit/cancel handlers.
    // Add keyboard containment to their presentation overlays only.
    const modalObserver = new MutationObserver(records => {
      for(const record of records)for(const overlay of record.addedNodes){
        if(overlay.nodeType!==1||!overlay.classList.contains('modal-backdrop'))continue;
        const panel=overlay.querySelector('.modal');if(!panel)continue;
        const previous=document.activeElement;
        panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
        const heading=panel.querySelector('h2');if(heading)panel.setAttribute('aria-label',heading.textContent);
        const controls=()=>[...panel.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&!x.hidden);
        panel.addEventListener('keydown',event=>{
          if(event.key==='Escape'){
            const cancel=[...panel.querySelectorAll('button')].find(x=>x.textContent.trim()==='إلغاء');
            if(cancel){event.preventDefault();cancel.click()}
          }
          if(event.key==='Tab'){
            const items=controls(),first=items[0],last=items.at(-1);
            if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
            else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
          }
        });
        if(!panel.contains(document.activeElement))controls()[0]?.focus();
        const removal=new MutationObserver(()=>{if(!overlay.isConnected){removal.disconnect();if(previous?.isConnected)previous.focus()}});
        removal.observe(document.body,{childList:true});
      }
    });
    modalObserver.observe(document.body,{childList:true});
    const roleDialog = document.getElementById('spRoleDialog');
    roleDialog.querySelectorAll('[data-close-role]').forEach(button => button.addEventListener('click', () => roleDialog.close()));
    document.querySelector('[data-driver-link]')?.addEventListener('click', e => {
      if(user?.role !== 'driver'){e.preventDefault();roleDialog.showModal()}
    });
    const destination = () => user?.role === 'driver' ? '/driver.html' : '/home.html';
    document.getElementById('spBack').addEventListener('click', () => {
      let ref;
      try{ref=new URL(document.referrer)}catch{}
      // Never send a driver back to an inaccessible staff page or back to a login form.
      const safe=ref?.origin===location.origin && !/\/(login|setup-admin)(\.html)?\/?$/.test(ref.pathname) && (user?.role!=='driver'||/^\/driver(\.html)?\/?$/.test(ref.pathname));
      if(safe && history.length>1)history.back();else location.assign(destination());
    });
    document.getElementById('spLogout').addEventListener('click', async e => {
      e.currentTarget.disabled=true;
      try{
        const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
        if(!r.ok)throw Error('logout');
        location.replace('/login.html');
      }catch{status.hidden=false;status.textContent='تعذر تسجيل الخروج. حاول مرة أخرى.';document.getElementById('spLogout').disabled=false}
    });
    try{
      const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
      if(r.status===401){location.replace('/login.html');return null}
      if(!r.ok)throw Error('session');
      const me=await r.json();user=me.user;
      if(!me.authenticated||!user)throw Error('session');
      document.getElementById('username').textContent=user.name||'حساب المستخدم';
      document.getElementById('usersNav').hidden=user.role!=='super_admin';
      const checkNav=document.getElementById('systemCheckNav');if(checkNav)checkNav.hidden=user.role!=='super_admin';
      if(user.role==='driver'){
        document.querySelectorAll('[data-staff]').forEach(link=>link.hidden=true);
        document.querySelector('.sp-brand').href='/driver.html';
        if(page!=='driver'){location.replace('/driver.html');return null}
      }
      if((page==='users'||page==='system-check')&&user.role!=='super_admin'){
        status.hidden=false;status.textContent='إدارة المستخدمين متاحة للمدير الرئيسي فقط.';
        document.getElementById('spMain').hidden=true;return null;
      }
      return me;
    }catch{
      document.getElementById('username').textContent='تعذر تحميل الحساب';
      document.getElementById('spMain').hidden=true;
      status.hidden=false;status.textContent='تعذر التحقق من الجلسة. ';
      const retry=document.createElement('button');retry.type='button';retry.textContent='إعادة المحاولة';retry.onclick=()=>location.reload();status.append(retry);
      return null;
    }
  });
  return {ready};
})();
