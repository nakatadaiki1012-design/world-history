/* 地図の計算（ブラウザとプレビュー用ツールの両方で使う）
   - 見る範囲（view）
   - その年の国・王朝の形を取り出す
   - 点の回る向きを直す（d3 は球面で考えるので、向きが逆だと「地球全体から形を引いた範囲」になってしまう） */
(function () {
  const W = window;
  // bbox: [西, 南, 東, 北]（この四角がちょうど画面に入る）
  const VIEWS = {
    world:    { name: '世界', bbox: [-180, -58, 180, 80] },
    eastasia: { name: '東アジア', bbox: [92, 16, 146, 50] },
    inner:    { name: '内陸アジア', bbox: [45, 28, 125, 56] },
    southasia:{ name: '南アジア', bbox: [60, 5, 96, 37] },
    seasia:   { name: '東南アジア', bbox: [90, -11, 130, 26] },
    westasia: { name: '西アジア', bbox: [24, 12, 72, 45] },
    med:      { name: '地中海', bbox: [-10, 28, 42, 48] },
    europe:   { name: 'ヨーロッパ', bbox: [-12, 35, 45, 64] },
    africa:   { name: 'アフリカ', bbox: [-20, -36, 52, 37] },
    america:  { name: 'アメリカ', bbox: [-125, -56, -32, 55] },
    atlantic: { name: '大西洋世界', bbox: [-100, -38, 40, 62] }
  };
  Object.values(VIEWS).forEach(v => { const [w, s, e, n] = v.bbox; v.center = [(w + e) / 2, (s + n) / 2]; v.span = e - w; });


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
  function shapeAt(p, year) {
    if (year < p.start || year > p.end || !p.shapes) return null;
    const s = p.shapes.find(s => year >= s.from && year <= s.to) || null;
    if (!s) return null;
    let geometry;
    if (s.iso) geometry = isoGeometry(s.iso);
    else geometry = { type: 'MultiPolygon', coordinates: fixRings(s.rings).map(r => [r]) };
    return { type: 'Feature', id: p.id, properties: { p, s }, geometry };
  }
  function politiesAt(year) {
    return (W.POLITIES || []).map(p => shapeAt(p, year)).filter(Boolean)
      .sort((a, b) => (b.properties.p.rank || 2) - (a.properties.p.rank || 2) || d3.geoArea(b) - d3.geoArea(a));
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

  W.GEO = { VIEWS, world, shapeAt, politiesAt, capitalAt, placeAt, projection, yearLabel, previewSVG, fixRings, isoGeometry };
})();
