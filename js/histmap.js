/* 歴史地図（年代のツマミつき）
   createHistMap(host, opts) で、どの画面にも置ける。
   opts: year, view, onYear(y), onSelect({type, id}), onView(v), bar(false で下のツマミを出さない), mini(小さい地図) */
function createHistMap(host, opts = {}) {
  const st = {
    year: fixYear(opts.year != null ? opts.year : 750),
    view: GEO.VIEWS[opts.view] ? opts.view : 'world',
    layers: Object.assign({ cap: true, people: true, events: true, modern: false }, store.get('layers', {}), opts.layers || {}),
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
  const gPol = gZoom.append('g');
  const gModern = gZoom.append('g');
  const gEdge = gZoom.append('g');
  const gOver = svg.append('g');   // 名前・点（拡大しても大きさが変わらない）
  const gTrail = gOver.append('g'), gLab = gOver.append('g'), gCap = gOver.append('g'), gEv = gOver.append('g'), gPeo = gOver.append('g');
  const uid = 'hm' + Math.random().toString(36).slice(2, 8);
  let pr, path, landPath;

  // --- 見る範囲のボタン ---
  const viewsBox = $('.hm-views', root);
  Object.entries(GEO.VIEWS).forEach(([k, v]) => {
    const b = el(`<button type="button" class="chip" data-v="${k}">${v.name}</button>`);
    b.addEventListener('click', () => setView(k));
    viewsBox.appendChild(b);
  });

  // --- 拡大・移動 ---
  const zoom = d3.zoom().scaleExtent([1, 12]).on('zoom', ev => {
    st.t = ev.transform; st.k = ev.transform.k;
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
    zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.5, -h * 0.5], [w * 1.5, h * 1.5]]);
    buildBase();
    draw();
  }

  function buildBase() {
    pr = GEO.projection(st.view, st.w, st.h);
    path = d3.geoPath(pr);
    const { land, countries } = GEO.world();
    landPath = path(land);
    gBase.selectAll('*').remove();
    gBase.append('rect').attr('class', 'hm-sea').attr('x', -st.w).attr('y', -st.h).attr('width', st.w * 3).attr('height', st.h * 3);
    gBase.append('path').attr('class', 'hm-grat').attr('d', path(d3.geoGraticule10()));
    gBase.append('clipPath').attr('id', uid + 'land').append('path').attr('d', landPath);
    gBase.append('path').attr('class', 'hm-land').attr('d', landPath);
    gPol.attr('clip-path', `url(#${uid}land)`);
    gModern.selectAll('*').remove();
    gModern.append('path').attr('class', 'hm-modern').attr('d', path(topojson.mesh(window.WORLD_TOPO, window.WORLD_TOPO.objects.countries, (a, b) => a !== b)));
    $$('.hm-views .chip', root).forEach(b => b.classList.toggle('on', b.dataset.v === st.view));
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
    const pt = best ? path.centroid(best) : null;
    const out = pt && isFinite(pt[0]) ? pt : null;
    labelCache.set(key, out);
    return out;
  }

  let feats = [], shownPeople = [], shownEvents = [];
  function draw() {
    if (!pr) return;
    const y = st.year;
    feats = GEO.politiesAt(y);
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
      .classed('sel', f => sel && sel.type === 'polity' && sel.id === f.properties.p.id)
      .order();
    const es = gEdge.selectAll('path').data(feats, f => f.properties.p.id + '|' + f.properties.s.from);
    es.exit().remove();
    es.enter().append('path').attr('class', 'hm-edge').merge(es).attr('d', path).attr('stroke', f => f.properties.p.color || '#888');
    gModern.style('display', st.layers.modern ? null : 'none');

    // 人物
    shownPeople = st.layers.people ? PEOPLE.map(p => ({ p, pl: GEO.placeAt(p, y) })).filter(x => x.pl) : [];
    if (sel && sel.type === 'person' && !shownPeople.some(x => x.p.id === sel.id)) {
      const p = PERSON[sel.id];
      if (p) { const pl = GEO.placeAt(p, clamp(y, p.born, p.died)); if (pl) shownPeople.push({ p, pl, ghost: true }); }
    }
    // 出来事（少し前までのものを、古いほどうすく）
    const win = y < -500 ? 60 : y < 1000 ? 25 : y < 1500 ? 15 : y < 1800 ? 8 : 4;
    shownEvents = st.layers.events ? EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => {
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

  // 重ならないように名前を置く（だいたいの四角で判定）
  function placeOverlay() {
    if (!pr) return;
    if (opts.mini) { gLab.selectAll('*').remove(); gCap.selectAll('*').remove(); gEv.selectAll('*').remove(); gPeo.selectAll('*').remove(); gTrail.selectAll('*').remove(); return; }
    const t = st.t, W = st.w, H = st.h, sel = st.sel;
    const boxes = [];
    const hit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const inView = (x, y) => x > -40 && x < W + 40 && y > -20 && y < H + 20;

    // 人物の点を先に（名前の場所取りを優先）
    const ppl = shownPeople.map(x => {
      const q = pr([x.pl.lon, x.pl.lat]); if (!q) return null;
      const [sx, sy] = t.apply(q); return Object.assign({ sx, sy }, x);
    }).filter(x => x && inView(x.sx, x.sy));
    ppl.forEach(x => boxes.push([x.sx - 6, x.sy - 6, x.sx + 6, x.sy + 6]));

    // 国・王朝の名前
    const labs = [];
    const order = feats.slice().sort((a, b) => (a.properties.p.rank || 2) - (b.properties.p.rank || 2) || d3.geoArea(b) - d3.geoArea(a));
    order.forEach(f => {
      const p = f.properties.p, rank = p.rank || 2;
      const c = labelPoint(f); if (!c) return;
      const [x, y] = t.apply(c);
      if (!inView(x, y)) return;
      const bounds = path.bounds(f); const wpx = (bounds[1][0] - bounds[0][0]) * t.k;
      const isSel = sel && sel.type === 'polity' && sel.id === p.id;
      if (!isSel && wpx < 18) return;
      let fs = rank === 1 ? 17 : rank === 2 ? 14 : 12;
      if (wpx < 70) fs = Math.max(11, fs - 3);
      if (st.view === 'world' && t.k < 1.6 && rank >= 3 && !isSel) return;
      const tw = p.name.length * fs * 0.98, b = [x - tw / 2, y - fs * 0.6, x + tw / 2, y + fs * 0.6];
      if (!isSel && hit(b)) return;
      boxes.push(b); labs.push({ p, x, y, fs });
    });
    const ls = gLab.selectAll('text').data(labs, d => d.p.id);
    ls.exit().remove();
    ls.enter().append('text').attr('class', 'hm-lab').merge(ls)
      .attr('x', d => d.x).attr('y', d => d.y).attr('font-size', d => d.fs).text(d => d.p.name);

    // 都
    const caps = [];
    if (st.layers.cap) feats.forEach(f => {
      const p = f.properties.p, c = GEO.capitalAt(p, st.year); if (!c) return;
      if ((p.rank || 2) >= 3 && t.k < 2 && !(sel && sel.id === p.id)) return;
      const q = pr([c.lon, c.lat]); if (!q) return;
      const [x, y] = t.apply(q); if (!inView(x, y)) return;
      const tw = c.name.length * 11 + 8, b = [x + 5, y - 13, x + 5 + tw, y];
      const showName = !hit(b) && (t.k >= 1.4 || st.view !== 'world' || (p.rank || 2) === 1);
      if (showName) boxes.push(b);
      caps.push({ id: p.id + c.name, name: c.name, x, y, showName });
    });
    const cs = gCap.selectAll('g').data(caps, d => d.id);
    cs.exit().remove();
    const ce = cs.enter().append('g').attr('class', 'hm-cap');
    ce.append('rect').attr('x', -3.5).attr('y', -3.5).attr('width', 7).attr('height', 7);
    ce.append('text').attr('x', 6).attr('y', -5);
    ce.merge(cs).attr('transform', d => `translate(${d.x},${d.y})`).select('text').text(d => d.showName ? d.name : '');

    // 出来事
    const evs = shownEvents.map(x => {
      const q = pr([x.e.lon, x.e.lat]); if (!q) return null;
      const [sx, sy] = t.apply(q); return Object.assign({ sx, sy }, x);
    }).filter(x => x && inView(x.sx, x.sy));
    evs.forEach(x => {
      const isSel = sel && sel.type === 'event' && sel.id === x.i;
      const tw = x.e.title.length * 11, b = [x.sx + 8, x.sy - 7, x.sx + 8 + tw, x.sy + 7];
      x.showName = isSel || (x.age <= x.win / 3 && !hit(b));
      if (x.showName) boxes.push(b);
    });
    const vs = gEv.selectAll('g').data(evs, d => d.i);
    vs.exit().remove();
    const ve = vs.enter().append('g').attr('class', 'hm-ev')
      .on('click', (ev, d) => { ev.stopPropagation(); select({ type: 'event', id: d.i }); })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.e.title)}</b> <span class="muted num">${esc(yearLabel(d.e.year))}</span><br><span style="font-size:12px">${esc(d.e.text || '')}</span>`))
      .on('mouseleave', hideTip);
    ve.append('path').attr('d', 'M0,-7L7,0L0,7L-7,0Z');
    ve.append('text').attr('x', 9).attr('y', 4);
    ve.merge(vs).attr('transform', d => `translate(${d.sx},${d.sy})`)
      .style('opacity', d => d.age === 0 ? 1 : Math.max(0.35, 1 - d.age / (d.win + 1)))
      .select('path').attr('fill', d => KIND_COLOR[d.e.kind] || '#555');
    gEv.selectAll('g').select('text').text(d => d.showName ? d.e.title : '');

    // 人物の名前
    ppl.forEach(x => {
      const isSel = sel && sel.type === 'person' && sel.id === x.p.id;
      const tw = x.p.name.length * 12.5;
      const cand = [[9, 4, 'start'], [-9, 4, 'end'], [0, -10, 'middle'], [0, 18, 'middle']];
      x.lab = null;
      for (const [dx, dy, a] of cand) {
        const x0 = a === 'start' ? x.sx + dx : a === 'end' ? x.sx + dx - tw : x.sx - tw / 2;
        const b = [x0, x.sy + dy - 11, x0 + tw, x.sy + dy + 2];
        if (isSel || !hit(b)) { boxes.push(b); x.lab = { dx, dy, a }; break; }
      }
    });
    const pp = gPeo.selectAll('g').data(ppl, d => d.p.id);
    pp.exit().remove();
    const pe = pp.enter().append('g').attr('class', 'hm-person')
      .on('click', (ev, d) => { ev.stopPropagation(); select({ type: 'person', id: d.p.id }); })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.p.name)}</b>（${esc(d.p.role || '')}）<br><span class="muted">${esc(d.pl.name)}${d.pl.note ? '：' + esc(d.pl.note) : ''}</span>`))
      .on('mouseleave', hideTip);
    pe.append('circle').attr('r', 6);
    pe.append('text');
    const pm = pe.merge(pp);
    pm.attr('transform', d => `translate(${d.sx},${d.sy})`)
      .classed('sel', d => sel && sel.type === 'person' && sel.id === d.p.id)
      .style('opacity', d => d.ghost ? 0.45 : 1);
    pm.select('circle').attr('fill', d => (REGION[d.p.region] || {}).color || '#555');
    pm.select('text').each(function (d) {
      const s = d3.select(this);
      if (!d.lab) { s.text(''); return; }
      s.attr('x', d.lab.dx).attr('y', d.lab.dy).attr('text-anchor', d.lab.a).text(d.p.name);
    });
    pm.filter(d => sel && sel.type === 'person' && sel.id === d.p.id).raise();

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
    setYear, setView, select, focusOn, stop,
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
