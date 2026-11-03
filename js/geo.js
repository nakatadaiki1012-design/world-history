/* 地図の計算（ブラウザとプレビュー用ツールの両方で使う）
   - 見る範囲（view）
   - その年の国・王朝の形を取り出す
   - 点の回る向きを直す（d3 は球面で考えるので、向きが逆だと「地球全体から形を引いた範囲」になってしまう） */
(function () {
  const W = window;
  // bbox: [西, 南, 東, 北]（この四角がちょうど画面に入る）。parent があるものは、その地域の中の「くわしい範囲」
  const VIEWS = {
    world:    { name: '世界', bbox: [-180, -58, 180, 80] },
    eurasia:  { name: 'ユーラシア', bbox: [-12, 0, 150, 66], parent: 'world' },
    atlantic: { name: '大西洋世界', bbox: [-100, -38, 40, 62], parent: 'world' },
    indian:   { name: 'インド洋', bbox: [30, -30, 120, 32], parent: 'world' },
    pacific:  { name: '太平洋', bbox: [100, -45, 260, 60], parent: 'world' },
    eastasia: { name: '東アジア', bbox: [92, 16, 146, 50] },
    china:    { name: '中国', bbox: [97, 20, 125, 43], parent: 'eastasia' },
    northchina:{ name: '華北・モンゴル南部', bbox: [104, 32, 124, 44], parent: 'eastasia' },
    southchina:{ name: '華中・華南', bbox: [104, 20, 123, 34], parent: 'eastasia' },
    koreajapan:{ name: '朝鮮・日本', bbox: [120, 30, 146, 46], parent: 'eastasia' },
    manchuria:{ name: '中国東北・沿海州', bbox: [115, 38, 142, 55], parent: 'eastasia' },
    inner:    { name: '内陸アジア', bbox: [45, 28, 125, 56] },
    centralasia:{ name: '中央アジア', bbox: [50, 33, 82, 48], parent: 'inner' },
    mongolia: { name: 'モンゴル高原', bbox: [88, 38, 122, 53], parent: 'inner' },
    tibet:    { name: 'チベット・青海', bbox: [76, 26, 104, 40], parent: 'inner' },
    siberia:  { name: 'シベリア', bbox: [55, 45, 180, 75], parent: 'inner' },
    southasia:{ name: '南アジア', bbox: [60, 5, 96, 37] },
    northindia:{ name: '北インド', bbox: [66, 20, 92, 36], parent: 'southasia' },
    southindia:{ name: '南インド・スリランカ', bbox: [70, 5, 88, 22], parent: 'southasia' },
    seasia:   { name: '東南アジア', bbox: [90, -11, 130, 26] },
    mainlandsea:{ name: '大陸部', bbox: [92, 5, 112, 26], parent: 'seasia' },
    islandsea:{ name: '島しょ部', bbox: [95, -11, 130, 20], parent: 'seasia' },
    westasia: { name: '西アジア', bbox: [24, 12, 72, 45] },
    orient:   { name: 'オリエント', bbox: [24, 22, 56, 40], parent: 'westasia' },
    mesopotamia:{ name: 'メソポタミア', bbox: [36, 29, 50, 38], parent: 'westasia' },
    iran:     { name: 'イラン', bbox: [43, 24, 66, 41], parent: 'westasia' },
    anatolia: { name: 'アナトリア・カフカス', bbox: [25, 35, 50, 44], parent: 'westasia' },
    arabia:   { name: 'アラビア半島', bbox: [34, 12, 60, 32], parent: 'westasia' },
    egypt:    { name: 'エジプト・東地中海', bbox: [24, 22, 38, 36], parent: 'westasia' },
    med:      { name: '地中海', bbox: [-10, 28, 42, 48] },
    aegean:   { name: 'ギリシア・エーゲ海', bbox: [19, 34, 30, 42], parent: 'med' },
    italy:    { name: 'イタリア', bbox: [6, 36, 19, 47], parent: 'med' },
    iberia:   { name: 'イベリア半島', bbox: [-10, 35, 4, 44], parent: 'med' },
    northafrica:{ name: '北アフリカ', bbox: [-12, 25, 35, 38], parent: 'med' },
    europe:   { name: 'ヨーロッパ', bbox: [-12, 35, 45, 64] },
    westeurope:{ name: '西ヨーロッパ', bbox: [-10, 42, 16, 59], parent: 'europe' },
    britfrance:{ name: 'イギリス・フランス', bbox: [-11, 42, 9, 59], parent: 'europe' },
    centraleurope:{ name: '中央ヨーロッパ（ドイツ）', bbox: [3, 45, 24, 56], parent: 'europe' },
    easteurope:{ name: '東ヨーロッパ', bbox: [14, 42, 42, 60], parent: 'europe' },
    balkans:  { name: 'バルカン半島', bbox: [13, 36, 30, 47], parent: 'europe' },
    northeurope:{ name: '北ヨーロッパ・バルト海', bbox: [4, 53, 32, 70], parent: 'europe' },
    russia:   { name: 'ロシア', bbox: [25, 42, 65, 66], parent: 'europe' },
    africa:   { name: 'アフリカ', bbox: [-20, -36, 52, 37] },
    westafrica:{ name: '西アフリカ', bbox: [-18, 3, 16, 25], parent: 'africa' },
    eastafrica:{ name: '東アフリカ', bbox: [26, -12, 52, 18], parent: 'africa' },
    southafrica:{ name: '中部・南部アフリカ', bbox: [10, -35, 42, 0], parent: 'africa' },
    america:  { name: 'アメリカ', bbox: [-125, -56, -32, 55] },
    northamerica:{ name: '北アメリカ', bbox: [-128, 22, -60, 55], parent: 'america' },
    mesoamerica:{ name: 'メソアメリカ・カリブ海', bbox: [-106, 8, -60, 28], parent: 'america' },
    southamerica:{ name: '南アメリカ', bbox: [-82, -56, -34, 13], parent: 'america' },
    andes:    { name: 'アンデス', bbox: [-82, -25, -62, 2], parent: 'america' }
  };
  Object.values(VIEWS).forEach(v => { const [w, s, e, n] = v.bbox; v.center = [(w + e) / 2, (s + n) / 2]; v.span = e - w; });


  // くわしい形（tools/geo で作ったもの）があれば、手で描いた形のかわりに使う
  (function applyPrecise() {
    const P = W.PRECISE; if (!P) return;
    (W.POLITIES || []).forEach(p => {
      const m = P[p.id]; if (!m) return;
      (p.shapes || []).forEach(s => { const r = m[String(s.from)]; if (r && r.length) { s.rings = r; delete s.iso; } });
      (p.spheres || []).forEach((s, i) => { const r = m['sphere:' + i]; if (r && r.length) { s.rings = r; delete s.iso; } });
    });
  })();

  // 輪の向きを直す（面積が半球より大きければ逆向き）
  const fixed = new WeakMap();
  function fixRings(rings) {
    if (fixed.has(rings)) return fixed.get(rings);
    const out = rings.map(r => {
      const ring = r.slice();
      const a = ring[0], z = ring[ring.length - 1];
      if (a[0] !== z[0] || a[1] !== z[1]) ring.push(a);
      const poly = { type: 'Polygon', coordinates: [ring] };
      if (d3.geoArea(poly) > 2 * Math.PI) ring.reverse();
      return ring;
    });
    fixed.set(rings, out);
    return out;
  }

  let countries = null, land = null;
  function world() {
    if (!countries) {
      const t = W.WORLD_TOPO;
      countries = topojson.feature(t, t.objects.countries).features.filter(f => f.id !== '010');
      land = topojson.merge(t, t.objects.countries.geometries.filter(g => g.id !== '010'));
    }
    return { countries, land };
  }
  const isoCache = new Map();
  function isoGeometry(ids) {
    const key = ids.join(',');
    if (!isoCache.has(key)) {
      const t = W.WORLD_TOPO;
      const set = new Set(ids.map(String));
      isoCache.set(key, topojson.merge(t, t.objects.countries.geometries.filter(g => set.has(g.id))));
    }
    return isoCache.get(key);
  }

  // その年に存在する国・王朝の形（GeoJSON Feature）
  const featCache = new WeakMap();
  function shapeAt(p, year) {
    if (year < p.start || year > p.end || !p.shapes) return null;
    const s = p.shapes.find(s => year >= s.from && year <= s.to) || null;
    if (!s) return null;
    // 同じ形には、いつも同じ Feature を返す（面積や画面上の形を覚えておけるように）
    if (featCache.has(s)) return featCache.get(s);
    let geometry;
    if (s.iso) geometry = isoGeometry(s.iso);
    else geometry = { type: 'MultiPolygon', coordinates: fixRings(s.rings).map(r => [r]) };
    const f = { type: 'Feature', id: p.id, properties: { p, s }, geometry };
    f.area = d3.geoArea(f);
    featCache.set(s, f);
    return f;
  }
  function politiesAt(year) {
    return (W.POLITIES || []).map(p => shapeAt(p, year)).filter(Boolean)
      .sort((a, b) => (b.properties.p.rank || 2) - (a.properties.p.rank || 2) || b.area - a.area);
  }
  // その年の勢力圏（斜線で表示）
  function spheresAt(year) {
    const out = [];
    (W.POLITIES || []).forEach(p => (p.spheres || []).forEach((s, i) => {
      if (year < s.from || year > s.to) return;
      const geometry = s.iso ? isoGeometry(s.iso) : (s.rings && s.rings.length ? { type: 'MultiPolygon', coordinates: fixRings(s.rings).map(r => [r]) } : null);
      if (geometry) { if (!s._f) s._f = { type: 'Feature', id: p.id + '~' + i, properties: { p, s }, geometry }; out.push(s._f); }
    }));
    return out;
  }
  function capitalAt(p, year) {
    if (p.capitals) return p.capitals.find(c => year >= c.from && year <= c.to) || null;
    return p.capital || null;
  }
  // 人物がその年にいた場所
  function placeAt(person, year) {
    if (year < person.born || year > person.died || !person.places || !person.places.length) return null;
    let best = person.places[0];
    for (const pl of person.places) if (pl.from <= year) best = pl;
    return best;
  }

  // 世界全体は「ナチュラルアース図法」、地域はゆがみの少ない「正積方位図法」（見る範囲の真ん中を中心に）
  function projection(view, w, h) {
    const v = VIEWS[view] || VIEWS.world;
    if (view === 'world' || !VIEWS[view]) {
      // 南極に近いところは画面の外に出して、陸地を大きく見せる
      const pr = d3.geoNaturalEarth1().rotate([-25, 0]);
      return pr.fitExtent([[4, 4 - h * 0.02], [w - 4, h * 1.16]], { type: 'Sphere' });
    }
    const [W0, S, E, N] = v.bbox, pts = [];
    for (let i = 0; i <= 10; i++) { const x = W0 + (E - W0) * i / 10, y = S + (N - S) * i / 10; pts.push([x, S], [x, N], [W0, y], [E, y]); }
    const pr = d3.geoAzimuthalEqualArea().rotate([-v.center[0], -v.center[1]]).clipAngle(100);
    return pr.fitExtent([[8, 8], [w - 8, h - 8]], { type: 'MultiPoint', coordinates: pts });
  }

  function yearLabel(y) {
    if (y < 0) return '前' + (-y) + '年';
    return y + '年';
  }

  // 開発用：その年の地図を SVG 文字列で
  function previewSVG(year, view, w, h) {
    const { countries, land } = world();
    const pr = projection(view, w, h);
    const path = d3.geoPath(pr);
    const feats = politiesAt(year);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#d4e7f0;font-family:sans-serif">`;
    s += `<defs><clipPath id="land"><path d="${path(land)}"/></clipPath></defs>`;
    s += `<path d="${path(d3.geoGraticule10())}" fill="none" stroke="rgba(0,0,0,.08)"/>`;
    s += `<path d="${path(land)}" fill="#ede6d2" stroke="#a99e84" stroke-width=".6"/>`;
    countries.forEach(c => { s += `<path d="${path(c)}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width=".5"/>`; });
    s += '<g clip-path="url(#land)">';
    spheresAt(year).forEach(f => { const p = f.properties.p; s += `<path d="${path(f)}" fill="${p.color}" fill-opacity=".18" stroke="${p.color}" stroke-width="1.2" stroke-dasharray="6 3"/>`; });
    feats.forEach(f => { const p = f.properties.p; s += `<path d="${path(f)}" fill="${p.color}" fill-opacity=".55" stroke="${p.color}" stroke-width="1.5"/>`; });
    s += '</g>';
    feats.forEach(f => { const p = f.properties.p; s += `<path d="${path(f)}" fill="none" stroke="${p.color}" stroke-width="1" stroke-dasharray="3 3"/>`; });
    feats.forEach(f => {
      const p = f.properties.p; const c = pr(p.label || d3.geoCentroid(f));
      if (c) s += `<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="15" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${p.name}</text>`;
      const cap = capitalAt(p, year); const cp = cap && pr([cap.lon, cap.lat]);
      if (cp) s += `<circle cx="${cp[0]}" cy="${cp[1]}" r="4" fill="#fff" stroke="#000"/><text x="${cp[0] + 6}" y="${cp[1] - 4}" font-size="11">${cap.name}</text>`;
    });
    s += `<text x="12" y="30" font-size="24" font-weight="700">${yearLabel(year)}（${VIEWS[view] ? VIEWS[view].name : view}）</text></svg>`;
    return s;
  }

  W.GEO = { VIEWS, world, shapeAt, politiesAt, spheresAt, capitalAt, placeAt, projection, yearLabel, previewSVG, fixRings, isoGeometry };
})();
