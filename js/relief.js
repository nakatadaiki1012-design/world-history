/* 陰影起伏（山や谷の影）。Natural Earth の SR_50M（public domain）を、地図の図法・拡大に合わせて描きなおす。
   全体を見るときは小さな画像（relief/relief-0.js）、拡大したら細かいタイル（relief/relief-行-列.js）を、見ている所だけ読みこむ。
   ファイルを直接開いた（file://）ときも動くように、画像は JS の中に data URL で入れてある。 */
const RELIEF = (() => {
  const cache = {}, loading = {};
  const TW = 8, TH = 4;   // タイルの数（横8 × たて4）
  function loadScript(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    return loading[src];
  }
  function decode(key, url) {
    if (cache[key]) return Promise.resolve(cache[key]);
    return new Promise(res => {
      if (!url) { res(null); return; }
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, im.width, im.height).data;
        const g = new Uint8Array(im.width * im.height);
        for (let i = 0; i < g.length; i++) g[i] = d[i * 4];
        cache[key] = { w: im.width, h: im.height, g };
        res(cache[key]);
      };
      im.onerror = () => res(null);
      im.src = url;
    });
  }
  async function base() { await loadScript('relief/relief-0.js'); return decode('0', window.RELIEF0); }
  async function tile(j, i) { await loadScript(`relief/relief-${j}-${i}.js`); return decode(`${j}-${i}`, (window.RELIEF_TILES || {})[`${j}-${i}`]); }
  // 経度・緯度の値（なめらかに）
  function bil(img, u, v) {
    const x = Math.max(0, Math.min(img.w - 1.001, u)), y = Math.max(0, Math.min(img.h - 1.001, v));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, w = img.w, g = img.g, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }
  // 画面の大きさ W×H の陰影画像を作る。inv(x, y) → [経度, 緯度] か null
  async function render(W, H, inv, fine, isStale) {
    let sample;
    if (fine) {
      // 見ている所にかかるタイルだけ読む
      const need = new Set();
      for (let y = 0; y <= 16; y++) for (let x = 0; x <= 16; x++) {
        const ll = inv(x / 16 * W, y / 16 * H); if (!ll) continue;
        const i = Math.min(TW - 1, Math.max(0, Math.floor((ll[0] + 180) / 360 * TW))), j = Math.min(TH - 1, Math.max(0, Math.floor((90 - ll[1]) / 180 * TH)));
        need.add(j + '-' + i);
      }
      if (need.size > 8) fine = false;   // 広すぎるときは全体の画像で
      else {
        const tiles = {};
        await Promise.all([...need].map(async k => { const [j, i] = k.split('-').map(Number); tiles[k] = await tile(j, i); }));
        if (isStale()) return null;
        const b = await base();
        sample = (lon, lat) => {
          const fx = (lon + 180) / 360 * TW, fy = (90 - lat) / 180 * TH;
          const i = Math.min(TW - 1, Math.max(0, Math.floor(fx))), j = Math.min(TH - 1, Math.max(0, Math.floor(fy)));
          const t = tiles[j + '-' + i];
          if (!t) return b ? bil(b, (lon + 180) / 360 * b.w - 0.5, (90 - lat) / 180 * b.h - 0.5) : 255;
          return bil(t, (fx - i) * t.w - 0.5, (fy - j) * t.h - 0.5);
        };
      }
    }
    if (!sample) {
      const b = await base(); if (!b) return null;
      sample = (lon, lat) => bil(b, (lon + 180) / 360 * b.w - 0.5, (90 - lat) / 180 * b.h - 0.5);
    }
    if (isStale()) return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), out = ctx.createImageData(W, H), d = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ll = inv(x + 0.5, y + 0.5), k = (y * W + x) * 4;
      const v = ll ? sample(ll[0], ll[1]) : 255;
      d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return c;
  }
  return { render };
})();
