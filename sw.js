/* オフラインでも使えるようにする（サービスワーカー）
   - ページ（index.html）：まずネットから。つながらなければ、保存したもの
   - プログラムとデータ（js）：まずネットから（新しい版とずれないように）。つながらなければ保存したもの
   - 地形の影・肖像・ライブラリ・アイコン：保存したものをすぐ使い、裏でネットから新しくしておく
   - コモンズの画像・フォント：一度読んだら保存して使う（画像は多くなりすぎないよう 600 枚まで） */
const VER = 'v1';
const APP = 'wh-app-' + VER, IMG = 'wh-img-' + VER;

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(APP).then(c => c.addAll(['./', './index.html']).catch(() => {}))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wh-') && k !== APP && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(APP);
  try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }
  catch (e) { return (await c.match(req)) || (req.mode === 'navigate' ? await c.match('./index.html') : null) || Response.error(); }
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}
async function cacheFirstImage(req) {
  const c = await caches.open(IMG);
  const hit = await c.match(req); if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')) {
      c.put(req, r.clone());
      c.keys().then(ks => { if (ks.length > 600) ks.slice(0, ks.length - 600).forEach(k => c.delete(k)); });
    }
    return r;
  } catch (e) { return Response.error(); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) { e.respondWith(networkFirst(req)); return; }
  // 大きくてあまり変わらないもの（地形の影・肖像・ライブラリ・アイコン）は保存したものをすぐ使う。プログラムとデータは、新しい版とずれないよう、まずネットから
  if (url.origin === location.origin && /\/(relief|portraits|vendor|icons)\//.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req, APP)); return; }
  if (url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (/wikimedia\.org$/.test(url.hostname)) { e.respondWith(cacheFirstImage(req)); return; }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { e.respondWith(staleWhileRevalidate(req, APP)); return; }
});
