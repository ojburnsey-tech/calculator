const CACHE='graph-calc-v2';
const FILES=['./','./index.html','./app.css','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png','./vendor/math.js','./vendor/mathlive-static.css','./vendor/mathlive.min.mjs','./js/main.js','./js/parse.js','./js/engine.js','./js/exact.js','./js/stats.js','./js/apps/calculate.js','./js/apps/equation.js','./js/apps/distribution.js','./js/apps/statistics.js','./js/apps/graph.js','./js/apps/matrix.js','./js/apps/basen.js','./js/apps/physics.js','./js/apps/recursion.js','./js/apps/conics.js','./js/apps/graph3d.js','./js/apps/financial.js','./js/apps/spreadsheet.js','./js/apps/geometry.js','./js/apps/stattests.js','./js/data.js','./js/plot.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async c=>{await c.addAll(FILES);const fonts=await fetch('./vendor/fonts/list.json').then(r=>r.json()).catch(()=>[]);await Promise.all(fonts.map(f=>c.add('./vendor/fonts/'+f).catch(()=>{})))}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
if(e.request.method!=='GET')return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok&&new URL(e.request.url).origin===location.origin){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return res}).catch(()=>caches.match('./index.html'))));
});
