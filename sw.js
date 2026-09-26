/* Copiloto de reparto: permite abrir la app sin cobertura.
   La app se pide siempre primero a internet (así las actualizaciones llegan enseguida)
   y solo si no hay conexión se usa la copia guardada.
   Los trozos del mapa (IGN y CARTO) y las librerías se guardan para poder usarlos sin cobertura. */
const CACHE="copiloto-v3";
const TILES="copiloto-mapa-v1";
const MAX_TILES=4000; /* unos 60-100 MB como mucho; se borran primero los más antiguos */
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
/* librerías con versión fija (no cambian): Leaflet, Supabase, lector de etiquetas y su idioma, tipografías */
const LIBS=/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet|cdn\.jsdelivr\.net\/npm\/(@supabase|tesseract\.js|tesseract\.js-core|@tesseract\.js-data)|tessdata\.projectnaptha\.com|fonts\.(googleapis|gstatic)\.com/;
const TILE=/^https:\/\/(www\.ign\.es\/wmts\/|[a-d]\.basemaps\.cartocdn\.com\/)/;
/* misma clave para los subdominios a/b/c/d de CARTO */
const tileKey=u=>u.replace(/^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//,"https://a.basemaps.cartocdn.com/");

self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

let puts=0;
async function trimTiles(){const c=await caches.open(TILES);const ks=await c.keys();const extra=ks.length-MAX_TILES;
  for(let i=0;i<extra;i++)await c.delete(ks[i])}
async function tile(req){
  const key=tileKey(req.url),c=await caches.open(TILES);
  const hit=await c.match(key);if(hit)return hit;
  /* se pide con CORS para poder guardarlo sin ocupar de más; si el servidor no lo admite, se sirve sin guardar */
  try{const res=await fetch(req.url,{mode:"cors",credentials:"omit"});
    if(res.ok){await c.put(key,res.clone());if(++puts%50===0)trimTiles();return res}
    return res}
  catch(_){try{return await fetch(req)}catch(e){return new Response("",{status:504})}}
}
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin===location.origin){ /* la app: primero internet, si no, copia */
    /* con cobertura débil no se espera más de 4 s: se abre la copia guardada */
    const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res});
    const slow=new Promise((_,rej)=>setTimeout(()=>rej(new Error("lento")),4000));
    e.respondWith(Promise.race([net,slow]).catch(()=>caches.match(r).then(m=>m||caches.match("./index.html")).then(m=>m||net)));return}
  if(TILE.test(r.url)){e.respondWith(tile(r));return}
  if(LIBS.test(r.url)){ /* librerías con versión fija: copia primero */
    /* solo se guarda si la descarga fue correcta (nunca una respuesta opaca o de error) */
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&res.type!=="opaque"){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})));}
  /* precios, direcciones, rutas, Supabase…: siempre en directo */
});
/* la app pregunta cuántos trozos de mapa hay guardados, o pide borrarlos */
self.addEventListener("message",e=>{const d=e.data||{};
  if(d.tipo==="mapa-info")e.waitUntil(caches.open(TILES).then(c=>c.keys()).then(ks=>e.source&&e.source.postMessage({tipo:"mapa-info",n:ks.length})));
  if(d.tipo==="mapa-borrar")e.waitUntil(caches.delete(TILES).then(()=>e.source&&e.source.postMessage({tipo:"mapa-info",n:0})));
});
