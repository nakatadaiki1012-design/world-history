/* 歴史地図（年代のツマミつき）
   createHistMap(host, opts) で、どの画面にも置ける。
   opts: year, view, onYear(y), onSelect({type, id}), onView(v), bar(false で下のツマミを出さない), mini(小さい地図) */
function createHistMap(host, opts = {}) {
  const st = {
    year: fixYear(opts.year != null ? opts.year : 750),
    view: GEO.VIEWS[opts.view] ? opts.view : 'world',
    layers: Object.assign({ cap: true, people: true, events: true, modern: false, sphere: true }, store.get('layers', {}), opts.layers || {}),
    sel: null,          // { type: 'polity' | 'person' | 'event', id }
    playing: null, speed: 1, w: 0, h: 0, k: 1, t: d3.zoomIdentity
  };
  const root = el(`<div class="hm${opts.mini ? ' mini' : ''}">
    <div class="hm-stage">
      <svg role="img" aria-label="歴史地図"></svg>
      <div class="hm-yearbig"></div>
      <div class="hm-tools">
        <button type="button" data-z="in" aria-label="拡大">＋</button>
        <button type="button" data-z="out" aria-label="縮小">－</button>
        <button type="button" data-z="reset" aria-label="元の大きさ">⟲</button>
      </div>
      <div class="hm-views"></div>
      <div class="hm-tip" hidden></div>
    </div>
    ${opts.bar === false ? '' : `<div class="hm-bar">
      <div class="hm-row">
        <button type="button" class="hm-play" aria-label="再生">▶</button>
        <div class="hm-steps"><button type="button" class="far" data-d="-100">−100</button><button type="button" data-d="-10">−10</button><button type="button" data-d="-1">−1</button></div>
        <div class="hm-slider"><div class="hm-ruler"></div><input type="range" min="0" max="1000" step="1" aria-label="年代"></div>
        <div class="hm-steps"><button type="button" data-d="1">+1</button><button type="button" data-d="10">+10</button><button type="button" class="far" data-d="100">+100</button></div>
        <button type="button" class="yr" title="クリックで年を入力"></button>
      </div>
      <div class="hm-eras"></div>
      <div class="hm-layers">
        <span class="muted">表示：</span>
        <button type="button" class="chip" data-l="cap">■ 都</button>
        <button type="button" class="chip" data-l="people">● 人物</button>
        <button type="button" class="chip" data-l="events">◆ 出来事</button>
        <button type="button" class="chip" data-l="sphere">▨ 勢力圏</button>
        <button type="button" class="chip" data-l="modern">┄ 現在の国境</button>
        <button type="button" class="chip" data-speed>速さ ×1</button>
      </div>
    </div>`}
  </div>`);
  host.appendChild(root);
  const stage = $('.hm-stage', root), svgEl = $('svg', root), tip = $('.hm-tip', root);
  const svg = d3.select(svgEl);
  const gZoom = svg.append('g');
  const gBase = gZoom.append('g');
  const gSph = gZoom.append('g');
  const gPol = gZoom.append('g');
  const gModern = gZoom.append('g');
  const gEdge = gZoom.append('g');
  const gOver = svg.append('g');   // 名前・点（拡大しても大きさが変わらない）
  const gStory = gOver.append('g');
  const gTrail = gOver.append('g'), gLab = gOver.append('g'), gCap = gOver.append('g'), gEv = gOver.append('g'), gPeo = gOver.append('g');
  const uid = 'hm' + Math.random().toString(36).slice(2, 8);
  svg.append('defs').append('clipPath').attr('id', uid + 'pc').append('circle').attr('r', 11);
  let pr, path, landPath;

  // --- 見る範囲のボタン（大きな地域。えらぶと、その中のくわしい範囲も出る） ---
  const viewsBox = $('.hm-views', root);
  const topOf = v => (GEO.VIEWS[v] && GEO.VIEWS[v].parent) || v;
  function renderViews() {
    viewsBox.innerHTML = '';
    const cur = topOf(st.view);
    Object.entries(GEO.VIEWS).filter(([, v]) => !v.parent).forEach(([k, v]) => {
      const b = el(`<button type="button" class="chip${k === cur ? ' on' : ''}">${v.name}</button>`);
      b.addEventListener('click', () => setView(k));
      viewsBox.appendChild(b);
      if (k !== cur) return;
      const subs = Object.entries(GEO.VIEWS).filter(([, x]) => x.parent === k);
      subs.forEach(([sk, sv]) => {
        const sb = el(`<button type="button" class="chip sub${sk === st.view ? ' on' : ''}">${sv.name}</button>`);
        sb.addEventListener('click', () => setView(sk === st.view ? k : sk));
        viewsBox.appendChild(sb);
      });
    });
    const on = $('.chip.sub.on', viewsBox) || $('.chip.on', viewsBox);
    if (on) requestAnimationFrame(() => { viewsBox.scrollLeft = Math.max(0, on.offsetLeft - 60); });
  }

  // --- 拡大・移動 ---
  const zoom = d3.zoom().scaleExtent([1, 400]).on('zoom', ev => {
    st.t = ev.transform; st.k = ev.transform.k;
    if (ev.sourceEvent) st.cam = null;   // 自分で動かしたら、物語のカメラの目標は忘れる
    // 都市の大きさまで拡大したら、国の色をうすくして地形の線を見やすく
    gPol.style('opacity', st.k > 25 ? 0.22 : st.k > 12 ? 0.6 : null); gEdge.style('opacity', st.k > 25 ? 0.3 : null);
    gZoom.attr('transform', ev.transform);
    placeOverlay();
  });
  svg.call(zoom).on('dblclick.zoom', null);
  $$('.hm-tools button', root).forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'reset') svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
    else svg.transition().duration(250).call(zoom.scaleBy, z === 'in' ? 1.6 : 1 / 1.6);
  }));

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width)), h = Math.max(160, Math.round(r.height));
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h;
    svg.attr('viewBox', `0 0 ${w} ${h}`);
    zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.6, -h * 0.6], [w * 1.6, h * 1.6]]);
    buildBase();
    if (st.cam) { svg.interrupt(); flyTo(st.cam.lon, st.cam.lat, st.cam.span, null, 0); }
    draw();
  }

  function buildBase() {
    pr = GEO.projection(st.view, st.w, st.h);
    labelCache.clear();
    path = d3.geoPath(pr);
    const { land, countries } = GEO.world();
    landPath = path(land);
    gBase.selectAll('*').remove();
    gBase.append('rect').attr('class', 'hm-sea').attr('x', -st.w).attr('y', -st.h).attr('width', st.w * 3).attr('height', st.h * 3);
    gBase.append('path').attr('class', 'hm-grat').attr('d', path(d3.geoGraticule10()));
    gBase.append('clipPath').attr('id', uid + 'land').append('path').attr('d', landPath);
    gBase.append('path').attr('class', 'hm-land').attr('d', landPath);
    gPol.attr('clip-path', `url(#${uid}land)`);
    gSph.attr('clip-path', `url(#${uid}land)`);
    gModern.selectAll('*').remove();
    gModern.append('path').attr('class', 'hm-modern').attr('d', path(topojson.mesh(window.WORLD_TOPO, window.WORLD_TOPO.objects.countries, (a, b) => a !== b)));
    renderViews();
  }

  // --- 名前の位置（いちばん大きい部分のまん中） ---
  const labelCache = new Map();
  function labelPoint(f) {
    const p = f.properties.p;
    if (p.label) return pr(p.label);
    const key = st.view + '|' + p.id + '|' + f.properties.s.from;
    if (labelCache.has(key)) return labelCache.get(key);
    let best = null, bestA = -1;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(c => { const g = { type: 'Polygon', coordinates: c }; const a = d3.geoArea(g); if (a > bestA) { bestA = a; best = g; } });
    // 陸地の部分を優先：輪全体の中心が海のときもあるので、陸地にかかるいちばん大きい国の中心も候補に
    // 地図の端で切れた形でも位置がずれないように、球面上の中心を投影する
    let pt = best ? pr(d3.geoCentroid(best)) : null;
    if (pt && best && !d3.geoContains(best, d3.geoCentroid(best))) { const c = path.centroid(best); if (isFinite(c[0])) pt = c; }
    const out = pt && isFinite(pt[0]) && isFinite(pt[1]) ? pt : null;
    labelCache.set(key, out);
    return out;
  }

  let feats = [], shownPeople = [], shownEvents = [];
  function draw() {
    if (!pr) return;
    const y = st.year;
    feats = GEO.politiesAt(y);
    // 勢力圏（斜線）
    const sph = st.layers.sphere && !opts.mini ? GEO.spheresAt(y) : [];
    const defs = svg.select('defs').empty() ? svg.insert('defs', ':first-child') : svg.select('defs');
    sph.forEach(f => {
      const c = f.properties.p.color || '#888', id = uid + 'h' + c.replace(/[^0-9a-z]/gi, '');
      if (defs.select('#' + id).empty()) {
        const pt = defs.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse').attr('width', 7).attr('height', 7).attr('patternTransform', 'rotate(45)');
        pt.append('rect').attr('width', 7).attr('height', 7).attr('fill', c).attr('fill-opacity', 0.1);
        pt.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 7).attr('stroke', c).attr('stroke-width', 2.2).attr('stroke-opacity', 0.55);
      }
      f.pat = id;
    });
    const ss = gSph.selectAll('path').data(sph, f => f.id);
    ss.exit().remove();
    ss.enter().append('path').attr('class', 'hm-sph')
      .on('click', (ev, f) => { ev.stopPropagation(); select({ type: 'polity', id: f.properties.p.id }); })
      .on('mousemove', (ev, f) => showTip(ev, `<b>${esc(f.properties.p.name)}</b>の${esc(SPHERE_KIND[f.properties.s.kind] || '勢力圏')}<br><span style="font-size:12px">${esc(f.properties.s.name || '')}</span>`))
      .on('mouseleave', hideTip)
      .merge(ss).attr('d', path).attr('fill', f => `url(#${f.pat})`).attr('stroke', f => f.properties.p.color || '#888');
    if (opts.only) feats = feats.filter(f => opts.only.includes(f.properties.p.id));
    const sel = st.sel;
    const ps = gPol.selectAll('path.hm-pol').data(feats, f => f.properties.p.id + '|' + f.properties.s.from);
    ps.exit().remove();
    ps.enter().append('path').attr('class', 'hm-pol')
      .on('click', (ev, f) => { ev.stopPropagation(); select({ type: 'polity', id: f.properties.p.id }); })
      .on('mousemove', (ev, f) => showTip(ev, `<b>${esc(f.properties.p.name)}</b> <span class="muted num">${span(f.properties.p.start, f.properties.p.end)}</span>`))
      .on('mouseleave', hideTip)
      .merge(ps)
      .attr('d', path)
      .attr('fill', f => f.properties.p.color || '#888')
      .attr('stroke', f => f.properties.p.color || '#888')
      .classed('sel', f => (sel && sel.type === 'polity' && sel.id === f.properties.p.id) || (st.story && st.story.polities.includes(f.properties.p.id)))
      .classed('dim', f => !!(st.story && st.story.polities.length && !st.story.polities.includes(f.properties.p.id)))
      .order();
    const es = gEdge.selectAll('path').data(feats, f => f.properties.p.id + '|' + f.properties.s.from);
    es.exit().remove();
    es.enter().append('path').attr('class', 'hm-edge').merge(es).attr('d', path).attr('stroke', f => f.properties.p.color || '#888');
    gModern.style('display', st.layers.modern ? null : 'none');

    // 人物
    shownPeople = st.story ? st.story.people.map(id => PERSON[id]).filter(Boolean).map(p => ({ p, pl: GEO.placeAt(p, clamp(y, p.born, p.died)) })).filter(x => x.pl)
      : st.layers.people ? PEOPLE.map(p => ({ p, pl: GEO.placeAt(p, y) })).filter(x => x.pl) : [];
    if (sel && sel.type === 'person' && !shownPeople.some(x => x.p.id === sel.id)) {
      const p = PERSON[sel.id];
      if (p) { const pl = GEO.placeAt(p, clamp(y, p.born, p.died)); if (pl) shownPeople.push({ p, pl, ghost: true }); }
    }
    // 出来事（少し前までのものを、古いほどうすく）
    const win = y < -500 ? 60 : y < 1000 ? 25 : y < 1500 ? 15 : y < 1800 ? 8 : 4;
    shownEvents = st.layers.events && !st.story ? EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => {
      const end = e.end || e.year; return (y >= e.year && y <= end) || (y >= end && y - end <= win) || (y >= e.year && y - e.year <= win);
    }) : [];
    if (sel && sel.type === 'event' && !shownEvents.some(x => x.i === sel.id) && EVENTS[sel.id]) shownEvents.push({ e: EVENTS[sel.id], i: sel.id });
    shownEvents.forEach(x => { const end = x.e.end || x.e.year; x.age = y >= x.e.year && y <= end ? 0 : Math.max(0, y - end); x.win = win; });

    placeOverlay();
    // 年の表示
    $('.hm-yearbig', root).innerHTML = `${esc(yearLabel(y))}<small>${esc(eraName(y))}</small>`;
    if (opts.bar !== false) {
      $('.yr', root).textContent = yearLabel(y);
      const r = $('input[type=range]', root);
      if (document.activeElement !== r) r.value = Math.round(yearToPos(y) * 10);
      $$('.hm-eras button', root).forEach(b => b.classList.toggle('on', +b.dataset.y === y));
    }
  }

  // --- 文字の幅をはかる（だいたいではなく、実際のフォントで） ---
  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  function textW(str, px, display) {
    const key = str + '|' + px + '|' + (display ? 1 : 0);
    if (!mcache.has(key)) {
      const ff = getComputedStyle(document.documentElement).getPropertyValue(display ? '--font-display' : '--font-body');
      mctx.font = `${display ? 800 : 700} ${px}px ${ff || 'sans-serif'}`;
      mcache.set(key, mctx.measureText(str).width + (display ? str.length * px * 0.04 : 0));
    }
    return mcache.get(key);
  }

  // 重ならないように名前を置く。
  // 1) 点（人物・都・出来事）を先に置き、同じ場所に集まった人物は輪のように広げる
  // 2) 名前は大事なものから順に、候補の位置を試して、何とも重ならない所にだけ出す
  function placeOverlay() {
    if (!pr) return;
    if (opts.mini) { gLab.selectAll('*').remove(); gCap.selectAll('*').remove(); gEv.selectAll('*').remove(); gPeo.selectAll('*').remove(); gTrail.selectAll('*').remove(); return; }
    const t = st.t, W = st.w, H = st.h, sel = st.sel;
    const PAD = 2;
    const boxes = [];
    const hit = b => b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > H - 2 || boxes.some(o => b[0] - PAD < o[2] && b[2] + PAD > o[0] && b[1] - PAD < o[3] && b[3] + PAD > o[1]);
    const inView = (x, y) => x > -10 && x < W + 10 && y > -10 && y < H + 10;
    const isSelP = id => sel && sel.type === 'person' && sel.id === id;
    // 左上の大きな年と、右上のボタンの場所はあけておく
    boxes.push([0, 0, 190, 70], [W - 52, 0, W, 150], [0, H - 40, W, H]);

    // 物語の地点・進路（名前の場所取りより先に）
    const storyLabels = drawStory(boxes);

    // 人物の点（近すぎるものは輪のように広げる）
    const ppl = shownPeople.map(x => {
      const q = pr([x.pl.lon, x.pl.lat]); if (!q) return null;
      const [sx, sy] = t.apply(q); return Object.assign({ sx, sy, ox: sx, oy: sy, r: PORTRAITS[x.p.id] ? 12.5 : 6 }, x);
    }).filter(x => x && inView(x.sx, x.sy));
    const used = new Set();
    ppl.forEach((x, i) => {
      if (used.has(i)) return;
      const grp = [i];
      ppl.forEach((y, j) => { if (j > i && !used.has(j) && Math.hypot(x.ox - y.ox, x.oy - y.oy) < 18) grp.push(j); });
      if (grp.length < 2) return;
      grp.forEach(j => used.add(j));
      const n = grp.length, rr = Math.max(16, 14 / Math.sin(Math.PI / n));
      const cx = d3.mean(grp, j => ppl[j].ox), cy = d3.mean(grp, j => ppl[j].oy);
      grp.forEach((j, k) => { const a = -Math.PI / 2 + 2 * Math.PI * k / n; ppl[j].sx = cx + rr * Math.cos(a); ppl[j].sy = cy + rr * Math.sin(a); ppl[j].spread = true; });
    });
    ppl.forEach(x => boxes.push([x.sx - x.r, x.sy - x.r, x.sx + x.r, x.sy + x.r]));

    // 都の点
    const caps = [];
    if (st.layers.cap) feats.forEach(f => {
      const p = f.properties.p, c = GEO.capitalAt(p, st.year); if (!c) return;
      if ((p.rank || 2) >= 3 && t.k < 2 && !(sel && sel.id === p.id)) return;
      const q = pr([c.lon, c.lat]); if (!q) return;
      const [x, y] = t.apply(q); if (!inView(x, y)) return;
      if (caps.some(o => Math.hypot(o.x - x, o.y - y) < 5)) return;
      if (storyLabels.some(m => Math.hypot(m.x - x, m.y - y) < 14)) return;   // 物語の地点と同じ場所の都は出さない
      caps.push({ id: p.id + c.name, name: c.name, x, y, rank: p.rank || 2, lab: null });
      boxes.push([x - 4, y - 4, x + 4, y + 4]);
    });
    // 出来事の点
    const evs = shownEvents.map(x => {
      const q = pr([x.e.lon, x.e.lat]); if (!q) return null;
      const [sx, sy] = t.apply(q); return Object.assign({ sx, sy, lab: null }, x);
    }).filter(x => x && inView(x.sx, x.sy));
    evs.forEach(x => boxes.push([x.sx - 7, x.sy - 7, x.sx + 7, x.sy + 7]));

    // 名前の候補を試す
    function tryPlace(cands) {
      for (const c of cands) if (c.force || !hit(c.b)) { boxes.push(c.b); return c; }
      return null;
    }
    const side = (x, y, r, w, h, force) => [
      { b: [x + r, y - h / 2, x + r + w, y + h / 2], dx: r, dy: 0, a: 'start' },
      { b: [x - r - w, y - h / 2, x - r, y + h / 2], dx: -r, dy: 0, a: 'end' },
      { b: [x - w / 2, y - r - h, x + w / 2, y - r], dx: 0, dy: -r - h / 2, a: 'middle' },
      { b: [x - w / 2, y + r, x + w / 2, y + r + h], dx: 0, dy: r + h / 2, a: 'middle' },
      { b: [x + r * .7, y - r * .7 - h, x + r * .7 + w, y - r * .7], dx: r * .7, dy: -r * .7 - h / 2, a: 'start' },
      { b: [x + r * .7, y + r * .7, x + r * .7 + w, y + r * .7 + h], dx: r * .7, dy: r * .7 + h / 2, a: 'start' }
    ].map((c, i) => Object.assign(c, { force: force && i === 0 }));

    // 国・王朝の名前の候補
    const labs = [];
    const polCands = feats.map(f => {
      const p = f.properties.p, rank = p.rank || 2;
      const c = labelPoint(f); if (!c) return null;
      const [x, y] = t.apply(c);
      if (!inView(x, y)) return null;
      const bounds = path.bounds(f); const wpx = (bounds[1][0] - bounds[0][0]) * t.k, hpx = (bounds[1][1] - bounds[0][1]) * t.k;
      const isSel = sel && sel.type === 'polity' && sel.id === p.id;
      if (!isSel && wpx < 22) return null;
      if (st.view === 'world' && t.k < 1.6 && rank >= 3 && !isSel) return null;
      let fs = rank === 1 ? 17 : rank === 2 ? 14 : 12;
      if (wpx < 80) fs = Math.max(11, fs - 3);
      const w = textW(p.name, fs, true), h = fs * 1.15;
      if (!isSel && w > wpx * 1.6 && rank > 1) return null;   // 小さな国に長い名前は出さない
      const dy = Math.min(hpx / 3, fs * 1.3);
      const cands = [0, -dy, dy, -2 * dy, 2 * dy].map((d, i) => ({ b: [x - w / 2, y + d - h / 2, x + w / 2, y + d + h / 2], x, y: y + d, force: isSel && i === 0 }));
      return { p, fs, cands, pri: isSel ? 0 : rank === 1 ? 1 : rank === 2 ? 3 : 6, area: wpx * hpx };
    }).filter(Boolean);

    // 優先順位：えらんだもの → 大帝国 → 人物（肖像あり）→ ふつうの国 → 人物 → 都 → 小国 → 出来事
    const jobs = [];
    polCands.forEach(c => jobs.push({ pri: c.pri, sub: -c.area, run: () => { const r = tryPlace(c.cands); if (r) labs.push({ p: c.p, x: r.x, y: r.y, fs: c.fs }); } }));
    ppl.forEach(x => {
      const s = isSelP(x.p.id), w = textW(x.p.name, 12, false), h = 14;
      jobs.push({ pri: s ? 0 : PORTRAITS[x.p.id] ? 2 : 4, sub: 0, run: () => { x.lab = tryPlace(side(x.sx, x.sy, x.r + 3, w, h, s)); } });
    });
    caps.forEach(c => {
      const w = textW(c.name, 11, false), h = 13;
      if (!(t.k >= 1.4 || st.view !== 'world' || c.rank === 1)) return;
      jobs.push({ pri: 5, sub: c.rank, run: () => { c.lab = tryPlace(side(c.x, c.y, 6, w, h, false)); } });
    });
    evs.forEach(x => {
      const s = sel && sel.type === 'event' && sel.id === x.i;
      if (!s && x.age > x.win / 3) return;
      const w = textW(x.e.title, 11, false), h = 13;
      jobs.push({ pri: s ? 0 : 7, sub: x.age, run: () => { x.lab = tryPlace(side(x.sx, x.sy, 9, w, h, s)); } });
    });
    storyLabels.forEach(m => jobs.push({ pri: m.main ? 0 : 1, sub: 0, run: () => { m.lab = tryPlace(side(m.x, m.y, m.main ? 13 : 7, textW(m.name, m.main ? 14 : 12, false), m.main ? 17 : 14, m.main)); } }));
    jobs.sort((a, b) => a.pri - b.pri || a.sub - b.sub).forEach(j => j.run());
    gStory.selectAll('text.st-lab').data(storyLabels.filter(m => m.lab)).join('text').attr('class', d => 'st-lab' + (d.main ? ' main' : ''))
      .attr('dominant-baseline', 'central').attr('x', d => d.x + d.lab.dx).attr('y', d => d.y + d.lab.dy).attr('text-anchor', d => d.lab.a).text(d => d.name);

    // --- 描く ---
    const ls = gLab.selectAll('text').data(labs, d => d.p.id);
    ls.exit().remove();
    ls.enter().append('text').attr('class', 'hm-lab').merge(ls)
      .attr('x', d => d.x).attr('y', d => d.y).attr('font-size', d => d.fs).text(d => d.p.name);

    const cs = gCap.selectAll('g').data(caps, d => d.id);
    cs.exit().remove();
    const ce = cs.enter().append('g').attr('class', 'hm-cap');
    ce.append('rect').attr('x', -3.5).attr('y', -3.5).attr('width', 7).attr('height', 7);
    ce.append('text').attr('dominant-baseline', 'central');
    const cm = ce.merge(cs).attr('transform', d => `translate(${d.x},${d.y})`);
    cm.select('text').each(function (d) {
      const s = d3.select(this);
      if (!d.lab) { s.text(''); return; }
      s.attr('x', d.lab.dx).attr('y', d.lab.dy).attr('text-anchor', d.lab.a).text(d.name);
    });

    const vs = gEv.selectAll('g').data(evs, d => d.i);
    vs.exit().remove();
    const ve = vs.enter().append('g').attr('class', 'hm-ev')
      .on('click', (ev, d) => { ev.stopPropagation(); select({ type: 'event', id: d.i }); })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.e.title)}</b> <span class="muted num">${esc(yearLabel(d.e.year))}</span><br><span style="font-size:12px">${esc(d.e.text || '')}</span>`))
      .on('mouseleave', hideTip);
    ve.append('path').attr('d', 'M0,-7L7,0L0,7L-7,0Z');
    ve.append('text').attr('dominant-baseline', 'central');
    const vm = ve.merge(vs);
    vm.attr('transform', d => `translate(${d.sx},${d.sy})`)
      .style('opacity', d => d.age === 0 ? 1 : Math.max(0.35, 1 - d.age / (d.win + 1)))
      .select('path').attr('fill', d => KIND_COLOR[d.e.kind] || '#555');
    vm.select('text').each(function (d) {
      const s = d3.select(this);
      if (!d.lab) { s.text(''); return; }
      s.attr('x', d.lab.dx).attr('y', d.lab.dy).attr('text-anchor', d.lab.a).text(d.e.title);
    });

    const pp = gPeo.selectAll('g').data(ppl, d => d.p.id);
    pp.exit().remove();
    const pe = pp.enter().append('g').attr('class', 'hm-person')
      .on('click', (ev, d) => { ev.stopPropagation(); select({ type: 'person', id: d.p.id }); })
      .on('mousemove', (ev, d) => showTip(ev, `${portraitImg(d.p, 'tipimg')}<b>${esc(d.p.name)}</b>（${esc(d.p.role || '')}）<br><span class="muted">${esc(d.pl.name)}${d.pl.note ? '：' + esc(d.pl.note) : ''}</span>`))
      .on('mouseleave', hideTip);
    pe.append('line').attr('class', 'leg');
    pe.append('circle').attr('class', 'ring');
    pe.each(function (d) {
      const ph = PORTRAITS[d.p.id];
      if (ph) d3.select(this).append('image').attr('href', ph.src).attr('x', -11).attr('y', -11).attr('width', 22).attr('height', 22)
        .attr('preserveAspectRatio', 'xMidYMin slice').attr('clip-path', `url(#${uid}pc)`);
    });
    pe.append('text').attr('dominant-baseline', 'central');
    const pm = pe.merge(pp);
    pm.attr('transform', d => `translate(${d.sx},${d.sy})`)
      .classed('sel', d => isSelP(d.p.id))
      .style('opacity', d => d.ghost ? 0.45 : 1);
    // 広げた点は、もとの場所へ細い線
    pm.select('line').attr('x1', 0).attr('y1', 0).attr('x2', d => d.spread ? d.ox - d.sx : 0).attr('y2', d => d.spread ? d.oy - d.sy : 0);
    pm.select('circle').attr('r', d => d.r).attr('fill', d => (REGION[d.p.region] || {}).color || '#555');
    pm.select('text').each(function (d) {
      const s = d3.select(this);
      if (!d.lab) { s.text(''); return; }
      s.attr('x', d.lab.dx).attr('y', d.lab.dy).attr('text-anchor', d.lab.a).text(d.p.name);
    });
    pm.filter(d => isSelP(d.p.id)).raise();

    drawTrail();
  }

  // えらんだ人物の足あと
  function drawTrail() {
    gTrail.selectAll('*').remove();
    const sel = st.sel;
    if (!sel || sel.type !== 'person' || !PERSON[sel.id]) return;
    const p = PERSON[sel.id];
    const stops = [];
    p.places.forEach((pl, i) => {
      const last = stops[stops.length - 1];
      if (last && Math.abs(last.pl.lon - pl.lon) < 0.05 && Math.abs(last.pl.lat - pl.lat) < 0.05) { last.idx.push(i); last.to = pl.to; return; }
      const q = pr([pl.lon, pl.lat]); if (!q) return;
      stops.push({ pl, idx: [i], from: pl.from, to: pl.to, xy: st.t.apply(q) });
    });
    if (stops.length >= 2) {
      gTrail.append('path').attr('class', 'hm-trail').attr('d', d3.line().curve(d3.curveCatmullRom.alpha(0.5))(stops.map(s => s.xy)));
    }
    const cur = GEO.placeAt(p, clamp(st.year, p.born, p.died));
    stops.forEach((s, n) => {
      const now = cur && s.idx.some(i => p.places[i] === cur);
      const g = gTrail.append('g').attr('class', 'hm-stop' + (now ? ' now' : '')).attr('transform', `translate(${s.xy[0]},${s.xy[1]})`);
      g.append('circle').attr('r', 4.5);
      if (stops.length > 1) g.append('text').attr('x', 7).attr('y', -6).text(`${n + 1} ${s.pl.name}`.slice(0, 18));
    });
  }

  function showTip(ev, html) {
    if (opts.mini) return;
    const r = stage.getBoundingClientRect();
    tip.innerHTML = html; tip.hidden = false;
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 6) + 'px';
    tip.style.top = Math.max(4, y - tip.offsetHeight - 10) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  svg.on('click', () => { if (st.sel) select(null); });

  // --- 物語：地点・進路・川などを描く（画面の座標で。拡大しても線の太さは同じ） ---
  function drawStory(boxes) {
    gStory.selectAll('*').remove();
    const S = st.story; if (!S) return [];
    const P = ll => { const q = pr(ll); return q ? st.t.apply(q) : null; };
    const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
    (S.lines || []).forEach(l => {
      const pts = l.pts.map(P).filter(Boolean); if (pts.length < 2) return;
      gStory.append('path').attr('class', 'st-line').attr('d', line(pts));
    });
    (S.routes || []).forEach((r, i) => {
      // 地図の端（日付変更線のあたり）をまたぐ線は、そこで切る
      let pts = r.pts.map(P).filter(Boolean); if (pts.length < 2) return;
      const segs = [[pts[0]]];
      for (let k = 1; k < pts.length; k++) {
        if (Math.abs(pts[k][0] - pts[k - 1][0]) > st.w * st.t.k * 0.5) segs.push([]);
        segs[segs.length - 1].push(pts[k]);
      }
      segs.slice(0, -1).forEach(sg => { if (sg.length > 1) gStory.append('path').attr('class', 'st-route').attr('d', line(sg)).attr('stroke', r.color || '#8c2f39'); });
      pts = segs[segs.length - 1];
      if (pts.length < 2) return;
      const c = r.color || '#8c2f39';
      const mid = uid + 'ar' + i;
      gStory.append('marker').attr('id', mid).attr('viewBox', '0 0 10 10').attr('refX', 7).attr('refY', 5).attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto-start-reverse')
        .append('path').attr('d', 'M0,0L10,5L0,10z').attr('fill', c);
      const pth = gStory.append('path').attr('class', 'st-route').attr('d', line(pts)).attr('stroke', c).attr('marker-end', `url(#${mid})`);
      // 進路は少しずつのびる（地図が動いている間も続くように、時間で計算）
      const pr0 = clamp((performance.now() - S.t0 - 700) / 2200, 0, 1);
      if (pr0 < 1) {
        const L = pth.node().getTotalLength();
        pth.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L * (1 - d3.easeCubicInOut(pr0)));
        if (pr0 === 0) pth.attr('marker-end', null);
      }
    });
    const labels = [];
    (S.marks || []).forEach(m => {
      const q = P([m.lon, m.lat]); if (!q) return;
      gStory.append('circle').attr('class', 'st-mark').attr('cx', q[0]).attr('cy', q[1]).attr('r', 5);
      boxes.push([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5]);
      labels.push({ name: m.name, x: q[0], y: q[1] });
    });
    if (S.center) {
      const q = P([S.center.lon, S.center.lat]);
      if (q) {
        gStory.append('circle').attr('class', 'st-pulse').attr('cx', q[0]).attr('cy', q[1]).attr('r', 10);
        gStory.append('path').attr('class', 'st-star').attr('transform', `translate(${q[0]},${q[1]})`)
          .attr('d', d3.symbol(d3.symbolStar, 260)());
        boxes.push([q[0] - 10, q[1] - 10, q[0] + 10, q[1] + 10]);
        if (S.center.name) labels.push({ name: S.center.name, x: q[0], y: q[1], main: true });
      }
    }
    return labels;
  }
  function setStory(step) {
    if (!step) { st.story = null; draw(); return; }
    st.story = {
      center: { lon: step.lon, lat: step.lat, name: step.place },
      marks: step.marks || [], routes: step.routes || [], lines: step.lines || [],
      people: step.people || [], polities: step.polities || [], t0: performance.now()
    };
    draw();
    const S = st.story;
    (function tick() { if (st.story !== S) return; placeOverlay(); if (performance.now() - S.t0 < 3000) requestAnimationFrame(tick); })();
  }
  // その地点を中心に、横 span 度ぶんが入るように拡大して移動
  function flyTo(lon, lat, span, view, dur = 1500) {
    if (view && GEO.VIEWS[view] && view !== st.view) setView(view);
    st.cam = { lon, lat, span };
    const q = pr([lon, lat]);
    if (!q) { setView('world'); return; }
    const a = pr([lon - span / 2, lat]), b = pr([lon + span / 2, lat]);
    const d = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : st.w;
    const k = clamp(st.w * 0.85 / Math.max(d, 1e-6), 1, 400);
    const tt = d3.zoomIdentity.translate(st.w / 2 - k * q[0], st.h / 2 - k * q[1]).scale(k);
    // 大きく動くときは、いったん引いてから寄る（どこへ動いたかわかるように）
    const far = Math.abs(Math.log(k / st.t.k)) > 1.5 || Math.hypot(st.t.applyX(q[0]) - st.w / 2, st.t.applyY(q[1]) - st.h / 2) > st.w * 0.6;
    if (far && dur > 0) {
      const k1 = Math.max(1, Math.min(st.t.k, k) / 3);
      const mid = [ (st.t.invertX(st.w / 2) + q[0]) / 2, (st.t.invertY(st.h / 2) + q[1]) / 2 ];
      const t1 = d3.zoomIdentity.translate(st.w / 2 - k1 * mid[0], st.h / 2 - k1 * mid[1]).scale(k1);
      svg.interrupt().transition().duration(dur * 0.45).ease(d3.easeCubicInOut).call(zoom.transform, t1)
        .transition().duration(dur * 0.55).ease(d3.easeCubicInOut).call(zoom.transform, tt);
    } else if (dur > 0) svg.interrupt().transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, tt);
    else svg.call(zoom.transform, tt);
  }

  function select(s) {
    st.sel = s;
    draw();
    if (opts.onSelect) opts.onSelect(s);
  }

  // --- 年のツマミ ---
  if (opts.bar !== false) {
    const range = $('input[type=range]', root);
    range.addEventListener('input', () => setYear(posToYear(range.value / 10)));
    $$('.hm-steps button', root).forEach(b => b.addEventListener('click', () => setYear(addYear(st.year, +b.dataset.d))));
    // 目盛り（時代の色の帯と、年の数字）
    const ruler = $('.hm-ruler', root);
    const cols = ['#c9b38a', '#b9a37a'];
    ERAS.forEach((e, i) => {
      const a = yearToPos(e[0]), b = yearToPos(Math.min(e[1], YEAR_MAX));
      ruler.appendChild(el(`<div class="seg" title="${esc(e[2])}" style="left:${a}%;width:${b - a}%;background:${i % 2 ? 'color-mix(in srgb, var(--accent) 22%, var(--chip))' : 'var(--chip)'}"></div>`));
    });
    [-1000, 1, 1000, 1500, 1800, 1900].forEach(y => {
      ruler.appendChild(el(`<div class="tick" style="left:${yearToPos(y)}%">${y < 0 ? '前' + (-y) : y === 1 ? '1' : y}</div>`));
    });
    // 時代のジャンプ
    const eras = [[-2500, '前2500'], [-1300, '前1300'], [-500, '前500'], [-330, '前330'], [-200, '前200'], [100, '100'], [400, '400'], [560, '560'], [750, '750'], [1000, '1000'], [1100, '1100'], [1280, '1280'], [1400, '1400'], [1550, '1550'], [1650, '1650'], [1750, '1750'], [1815, '1815'], [1880, '1880'], [1914, '1914'], [1939, '1939'], [1950, '1950'], [1975, '1975'], [2000, '2000']];
    const eb = $('.hm-eras', root);
    eras.forEach(([y, t]) => { const b = el(`<button type="button" data-y="${y}">${t}</button>`); b.addEventListener('click', () => setYear(y)); eb.appendChild(b); });
    // 年を入力
    const yr = $('.yr', root);
    yr.addEventListener('click', () => {
      const inp = el(`<input type="text" inputmode="numeric" style="width:92px;text-align:center;border:1px solid var(--accent);border-radius:8px;padding:3px" placeholder="例 前221 / 1453">`);
      inp.value = st.year < 0 ? '前' + (-st.year) : String(st.year);
      yr.replaceWith(inp); inp.focus(); inp.select();
      const done = () => {
        const s = inp.value.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/年/g, '');
        const m = s.match(/^(前|BC|-|−)?\s*(\d{1,4})$/i);
        inp.replaceWith(yr);
        if (m) setYear(m[1] ? -(+m[2]) : +m[2]);
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = ''; inp.blur(); } });
      inp.addEventListener('blur', done, { once: true });
    });
    // 再生
    const playBtn = $('.hm-play', root);
    playBtn.addEventListener('click', () => (st.playing ? stop() : play()));
    $('[data-speed]', root).addEventListener('click', e => { st.speed = st.speed === 4 ? 1 : st.speed * 2; e.currentTarget.textContent = `速さ ×${st.speed}`; });
    // 表示の切りかえ
    $$('.hm-layers [data-l]', root).forEach(b => {
      const k = b.dataset.l;
      b.setAttribute('aria-pressed', String(!!st.layers[k]));
      b.addEventListener('click', () => {
        st.layers[k] = !st.layers[k]; b.setAttribute('aria-pressed', String(st.layers[k]));
        store.set('layers', st.layers); draw();
      });
    });
  }
  function play() {
    if (st.year >= YEAR_MAX) setYear(YEAR_MIN);
    st.playing = setInterval(() => {
      const y = st.year;
      const step = (y < -1000 ? 10 : y < 0 ? 4 : y < 1500 ? 2 : 1) * st.speed;
      const n = addYear(y, step);
      setYear(n);
      if (n >= YEAR_MAX) stop();
    }, 110);
    $('.hm-play', root).textContent = '❚❚';
  }
  function stop() { clearInterval(st.playing); st.playing = null; const b = $('.hm-play', root); if (b) b.textContent = '▶'; }

  function setYear(y) {
    y = fixYear(y);
    if (y === st.year && pr) return;
    st.year = y;
    draw();
    if (opts.onYear) opts.onYear(y);
  }
  function setView(v, keepZoom) {
    if (!GEO.VIEWS[v]) return;
    st.view = v;
    labelCache.clear();
    buildBase();
    if (!keepZoom) { st.t = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity); }
    draw();
    if (opts.onView) opts.onView(v);
  }
  // 点が見えるところへ（範囲の外なら、その点が入るいちばんせまい範囲に切りかえ）
  function focusOn(lon, lat) {
    const t = st.t, q = pr([lon, lat]);
    if (q) { const [x, y] = t.apply(q); if (x > 20 && x < st.w - 20 && y > 20 && y < st.h - 20) return; }
    const cands = Object.entries(GEO.VIEWS).filter(([k]) => k !== 'world').sort((a, b) => a[1].span - b[1].span);
    const hit = cands.find(([k]) => { const p2 = GEO.projection(k, st.w, st.h)([lon, lat]); return p2 && p2[0] > st.w * 0.12 && p2[0] < st.w * 0.88 && p2[1] > st.h * 0.12 && p2[1] < st.h * 0.88; });
    setView(hit ? hit[0] : 'world');
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);
  resize();
  draw();

  return {
    root,
    get year() { return st.year; },
    get view() { return st.view; },
    get sel() { return st.sel; },
    setYear, setView, select, focusOn, stop, setStory, flyTo,
    polities: () => feats.map(f => f.properties.p),
    visiblePolities() {
      if (!pr) return [];
      return feats.map(f => { const c = labelPoint(f); if (!c) return null; const [x, y] = st.t.apply(c); return x > 0 && x < st.w && y > 0 && y < st.h ? f.properties.p : null; }).filter(Boolean);
    },
    people: () => shownPeople.filter(x => !x.ghost),
    events: () => shownEvents,
    destroy() { stop(); ro.disconnect(); root.remove(); }
  };
}
