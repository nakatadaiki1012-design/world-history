// 形の合成の共通部分
const fs = require('fs'), path = require('path');
const DATA = process.env.GEO_DATA, NM = process.env.GEO_NODE_MODULES;
if (!DATA || !NM) { console.error('GEO_DATA と GEO_NODE_MODULES を設定してください（README を参照）'); process.exit(1); }
const req = m => require(path.join(NM, m));
const pc = req('polygon-clipping');
let _adm1, _rivers, _world;
const adm1 = () => _adm1 || (_adm1 = JSON.parse(fs.readFileSync(path.join(DATA, 'adm1.geojson'), 'utf8')).features);
const rivers = () => _rivers || (_rivers = JSON.parse(fs.readFileSync(path.join(DATA, 'rivers.geojson'), 'utf8')).features);
function world() {
  if (_world) return _world;
  const topojson = req('topojson-client');
  const ctx = {}; new Function('window', fs.readFileSync(path.join(__dirname, '../../vendor/world-50m.js'), 'utf8'))(ctx);
  const t = ctx.WORLD_TOPO;
  _world = topojson.feature(t, t.objects.countries).features;
  return _world;
}
const toMP = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
const ringPoly = r => { const c = r.slice(); const a = c[0], z = c[c.length - 1]; if (a[0] !== z[0] || a[1] !== z[1]) c.push(a); return [[c]]; };

// ダグラス=ポイカー法で線を単純化
function simplifyRing(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, dm = 0;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      let d;
      if (L === 0) d = Math.hypot(x - x1, y - y1);
      else { let t = ((x - x1) * dx + (y - y1) * dy) / L; t = Math.max(0, Math.min(1, t)); d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); }
      if (d > dm) { dm = d; idx = i; }
    }
    if (dm > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(s / 2); };

// 長い辺に点を足す（地図は2点のあいだを大円で描くので、緯線にそった長い辺がふくらまないように）
function densify(r) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > 2) {
      const n = Math.ceil(d / 1);
      for (let k = 1; k < n; k++) out.push([Math.round((a[0] + (b[0] - a[0]) * k / n) * 100) / 100, Math.round((a[1] + (b[1] - a[1]) * k / n) * 100) / 100]);
    }
  }
  return out;
}

function compose(rc) {
  let parts = [];
  const want = new Set(rc.adm1 || []), want0 = new Set(rc.adm0 || []);
  if (want.size || want0.size) {
    const found = new Set();
    adm1().forEach(f => {
      const p = f.properties;
      if (want.has(p.iso_3166_2) || want0.has(p.adm0_a3)) { parts.push(...toMP(f.geometry)); found.add(p.iso_3166_2); }
    });
    const miss = [...want].filter(c => !found.has(c));
    if (miss.length) throw new Error('見つからない州・省: ' + miss.join(', '));
  }
  if (rc.iso && rc.iso.length) {
    const set = new Set(rc.iso.map(String));
    world().forEach(f => { if (set.has(String(f.id))) parts.push(...toMP(f.geometry)); });
  }
  (rc.add || []).forEach(r => parts.push(...ringPoly(r)));
  if (!parts.length) throw new Error('形がありません');
  let g = pc.union(...parts.map(p => [p]));
  (rc.minus || []).forEach(r => { g = pc.difference(g, ringPoly(r)); });
  if (rc.clip && rc.clip.length) g = pc.intersection(g, pc.union(...rc.clip.map(ringPoly)));
  const tol = rc.tol || 0.04, minArea = rc.minArea != null ? rc.minArea : 0.02;
  // 外側の輪だけ（穴は使わない）。小さすぎる島は落とす
  const rings = g.map(poly => poly[0]).filter(r => area(r) >= minArea)
    .map(r => simplifyRing(r, tol).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]))
    .map(r => { const o = []; r.forEach(p => { const l = o[o.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) o.push(p); }); if (o.length > 1) { const a = o[0], z = o[o.length - 1]; if (a[0] === z[0] && a[1] === z[1]) o.pop(); } return o; })
    .filter(r => r.length >= 4)
    .map(densify);
  return rings;
}
module.exports = { compose, adm1, rivers, world, simplifyRing };
