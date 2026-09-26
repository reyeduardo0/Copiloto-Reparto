/* Copiloto de reparto: permite abrir la app sin cobertura.
   La app se pide siempre primero a internet (así las actualizaciones llegan enseguida)
   y solo si no hay conexión se usa la copia guardada. */
const CACHE="copiloto-v2";
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
const LIBS=/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet|cdn\.jsdelivr\.net\/npm\/@supabase|fonts\.(googleapis|gstatic)\.com/;
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin===location.origin){ /* la app: primero internet, si no, copia */
    /* con cobertura débil no se espera más de 4 s: se abre la copia guardada */
    const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res});
    const slow=new Promise((_,rej)=>setTimeout(()=>rej(new Error("lento")),4000));
    e.respondWith(Promise.race([net,slow]).catch(()=>caches.match(r).then(m=>m||caches.match("./index.html")).then(m=>m||net)));return}
  if(LIBS.test(r.url)){ /* librerías con versión fija: copia primero */
    /* solo se guarda si la descarga fue correcta (nunca una respuesta opaca o de error) */
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&res.type!=="opaque"){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})));}
  /* mapas, precios, direcciones, Supabase…: siempre en directo */
});
