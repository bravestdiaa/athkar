const C='athkar-v3';
const FONT_CACHE='athkar-fonts';
const FILES=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
const FONT_CSS='https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&display=swap';
const KEEP=new Set([C,FONT_CACHE,'azkar-flags']);

function isFontUrl(u){
  return u.hostname==='fonts.googleapis.com' || u.hostname==='fonts.gstatic.com';
}

async function precacheFonts(){
  const c=await caches.open(FONT_CACHE);
  const res=await fetch(FONT_CSS,{headers:{'Accept':'text/css'}});
  if(!res.ok) return;
  await c.put(FONT_CSS,res.clone());
  const css=await res.text();
  const urls=[...css.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1].replace(/['"]/g,''));
  await Promise.all(urls.map(async u=>{
    try{
      const r=await fetch(u);
      if(r.ok) await c.put(u,r);
    }catch(e){}
  }));
}

self.addEventListener('install',e=>{
  e.waitUntil(Promise.all([
    caches.open(C).then(c=>c.addAll(FILES)),
    precacheFonts().catch(()=>{})
  ]).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>!KEEP.has(x)).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(isFontUrl(url)){
    e.respondWith(caches.open(FONT_CACHE).then(c=>c.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(res=>{
        if(res && res.ok) c.put(e.request,res.clone());
        return res;
      });
    })));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    const cp=res.clone();
    caches.open(C).then(c=>c.put(e.request,cp));
    return res;
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Promise.reject(e.request))));
});

// إشعار صامت مرة واحدة في كل فترة
async function maybeNotify(){
  const now=new Date(), hr=now.getHours();
  let slot=null;
  if(hr>=8&&hr<10) slot='am'; else if(hr>=15&&hr<17) slot='pm';
  if(!slot) return;
  const key=now.toDateString()+'-'+slot;
  const c=await caches.open('azkar-flags');
  if(await c.match(key)) return;
  await self.registration.showNotification('أذكار الصباح والمساء',{body:'أذكار الصباح والمساء',icon:'icons/icon-192.png',badge:'icons/icon-192.png',silent:true,tag:'athkar-'+slot});
  await c.put(key,new Response('1'));
}
self.addEventListener('periodicsync',e=>{ if(e.tag==='azkar-reminder') e.waitUntil(maybeNotify()); });
self.addEventListener('notificationclick',e=>{ e.notification.close(); e.waitUntil(clients.openWindow('./')); });
