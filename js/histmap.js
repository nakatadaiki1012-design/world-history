/* 歴史地図（年代のツマミつき）
   createHistMap(host, opts) で、どの画面にも置ける。
   opts: year, view, onYear(y), onSelect({type, id}), onView(v), bar(false で下のツマミを出さない), mini(小さい地図) */
function createHistMap(host, opts = {}) {
  const st = {
    year: fixYear(opts.year != null ? opts.year : 750),
    view: GEO.VIEWS[opts.view] ? opts.view : 'world',
    layers: Object.assign({ cap: true, people: true, events: true, modern: false, sphere: true, terrain: true, cities: true, places: true }, store.get('layers', {}), opts.layers || {}),
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
        <button type="button" class="regbtn" aria-label="見る地域を変える" title="見る地域を変える">🌐</button>
        <button type="button" class="gear" aria-label="表示の設定" aria-expanded="false">⚙</button>
      </div>
      <div class="hm-set" hidden>
        <div class="hm-set-h">表示の設定 <button type="button" class="x" aria-label="とじる">✕</button></div>
        <div class="hm-set-g"><b>地図に出すもの</b>
          <label><input type="checkbox" data-l="cap"> ■ 都</label>
          <label><input type="checkbox" data-l="people"> ● 人物</label>
          <label><input type="checkbox" data-l="events"> ◆ 出来事</label>
          <label><input type="checkbox" data-l="sphere"> ▨ 勢力圏（斜線）</label>
          <label><input type="checkbox" data-l="modern"> ┄ 現在の国境</label>
          <label><input type="checkbox" data-l="terrain"> ⛰ 地形（山脈・砂漠・川・湖）</label>
          <label><input type="checkbox" data-l="places"> ◇ 歴史的な地名（その時代の名前）</label>
          <label><input type="checkbox" data-l="cities"> ・ 今の町の名前（拡大したとき）</label>
        </div>
        <div class="hm-set-g"><b>画面</b>
          <label><input type="checkbox" data-u="views"> 地域のボタン</label>
          ${opts.bar === false ? '' : '<label><input type="checkbox" data-u="eras"> 年のジャンプボタン</label>'}
          <label><input type="checkbox" class="big-ck"> 大きな文字（教室のスクリーン用）</label>
          <button type="button" class="chip print-btn" style="margin-top:4px">🖨 この地図を印刷</button>
        </div>
        <div class="hm-set-g"><b>🔊 読み上げ</b>
          <label style="display:grid;gap:2px">声<select class="tts-voice"></select></label>
          <label style="display:grid;gap:2px">速さ <span class="tts-rv num"></span><input type="range" class="tts-rate" min="0.7" max="1.5" step="0.05"></label>
          <button type="button" class="chip tts-test">▶ ためしに聞く</button>
          <label><input type="checkbox" class="furi-ck"> ふりがなを表示（むずかしい語）</label>
          <details class="myyomi"><summary>読みまちがいを直す</summary>
            <div class="muted" style="font-size:11.5px">まちがえた語と、正しい読み（ひらがな）を登録すると、次から正しく読みます（このブラウザに保存）。</div>
            <div class="my-add"><input class="my-w" placeholder="語（例：関中）"><input class="my-r" placeholder="よみ（かんちゅう）"><button type="button" class="chip my-ok">登録</button></div>
            <div><button type="button" class="chip my-play">▶ 聞いてみる</button></div>
            <ul class="my-list"></ul>
          </details>
        </div>
        ${opts.bar === false ? '' : `<div class="hm-set-g"><b>▶ 再生の速さ</b>
          <div class="hm-speed"><button type="button" data-sp="1">×1</button><button type="button" data-sp="2">×2</button><button type="button" data-sp="4">×4</button><button type="button" data-sp="8">×8</button></div>
        </div>`}
      </div>
      <div class="hm-views"></div>
      <div class="hm-caption" hidden></div>
      <div class="hm-inset" hidden title="おすと引きの地図にもどる"><svg></svg></div>
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
    </div>`}
  </div>`);
  host.appendChild(root);
  const stage = $('.hm-stage', root), svgEl = $('svg', root), tip = $('.hm-tip', root);
  const svg = d3.select(svgEl);
  const gZoom = svg.append('g');
  const gBase = gZoom.append('g');
  const gTerr = gZoom.append('g');   // 山脈・砂漠などの地形
  const gSph = gZoom.append('g');
  const gPol = gZoom.append('g');
  const gModern = gZoom.append('g');
  const gEdge = gZoom.append('g');
  const gRel = gZoom.append('g').attr('class', 'hm-relief');   // 陰影起伏（国の色の上に乗算でかさねる）
  const gMask = gZoom.append('g');   // 海のふた
  const gWater = gZoom.append('g');  // 川と湖
  const gOver = svg.append('g');   // 名前・点（拡大しても大きさが変わらない）
  const gTlab = gOver.append('g');   // 地形・町の名前（いちばん下）
  const gStory = gOver.append('g');
  const gPlc = gOver.append('g');
  const gTrail = gOver.append('g'), gLab = gOver.append('g'), gCap = gOver.append('g'), gEv = gOver.append('g'), gPeo = gOver.append('g');
  const uid = 'hm' + Math.random().toString(36).slice(2, 8);
  svg.append('defs').append('clipPath').attr('id', uid + 'pc').append('circle').attr('r', 11);
  let pr, path, landPath;

  // --- 見る範囲のボタン（大きな地域。えらぶと、その中のくわしい範囲も出る） ---
  const viewsBox = $('.hm-views', root);
  const topOf = v => (GEO.VIEWS[v] && GEO.VIEWS[v].parent) || v;
  // 地域のボタンは、ふだんはかくしておく。地図を動かしたときや 🌐 をおしたときだけ、うすく出して、しばらくしたら消す
  let viewsTimer = null, viewsHover = false;
  function showViews(ms) {
    if (opts.mini) return;
    root.classList.add('views-show');
    clearTimeout(viewsTimer);
    viewsTimer = setTimeout(() => { if (!viewsHover) root.classList.remove('views-show'); }, ms || 4000);
  }
  function hideViews() { clearTimeout(viewsTimer); root.classList.remove('views-show'); }
  viewsBox.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { viewsHover = true; clearTimeout(viewsTimer); } });
  viewsBox.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { viewsHover = false; showViews(2500); } });
  viewsBox.addEventListener('pointerdown', () => showViews(5000));
  viewsBox.addEventListener('scroll', () => { if (root.classList.contains('views-show')) showViews(4000); }, { passive: true });
  $('.regbtn', root).addEventListener('click', e => { e.stopPropagation(); if (root.classList.contains('views-show')) hideViews(); else { markNear(); showViews(7000); } });
  // いま見ている場所にいちばん合う地域のボタンに、印をつける
  function markNear() {
    $$('.chip.near', viewsBox).forEach(b => b.classList.remove('near'));
    if (!pr || st.k < 1.6) return;
    const c = pr.invert(st.t.invert([st.w / 2, st.h / 2])); if (!c) return;
    let best = null, bestA = Infinity;
    Object.entries(GEO.VIEWS).forEach(([k, v]) => {
      if (k === 'world' || !v.bbox) return;
      const [x0, y0, x1, y1] = v.bbox, lon = c[0] < x0 ? c[0] + 360 : c[0];
      if (lon < x0 || lon > x1 || c[1] < y0 || c[1] > y1) return;
      const a = (x1 - x0) * (y1 - y0); if (a < bestA) { bestA = a; best = k; }
    });
    if (!best || best === st.view) return;
    const b = $(`.chip[data-k="${best}"]`, viewsBox) || $(`.chip[data-k="${topOf(best)}"]`, viewsBox);
    if (!b || b.classList.contains('on')) return;
    b.classList.add('near');
    viewsBox.scrollLeft = Math.max(0, b.offsetLeft - 60);
  }
  function renderViews() {
    viewsBox.innerHTML = '';
    const cur = topOf(st.view);
    Object.entries(GEO.VIEWS).filter(([, v]) => !v.parent).forEach(([k, v]) => {
      const b = el(`<button type="button" class="chip${k === cur ? ' on' : ''}" data-k="${k}">${v.name}</button>`);
      b.addEventListener('click', () => { setView(k); showViews(2500); });
      viewsBox.appendChild(b);
      if (k !== cur) return;
      const subs = Object.entries(GEO.VIEWS).filter(([, x]) => x.parent === k);
      subs.forEach(([sk, sv]) => {
        const sb = el(`<button type="button" class="chip sub${sk === st.view ? ' on' : ''}" data-k="${sk}">${sv.name}</button>`);
        sb.addEventListener('click', () => { setView(sk === st.view ? k : sk); showViews(2500); });
        viewsBox.appendChild(sb);
      });
    });
    const on = $('.chip.sub.on', viewsBox) || $('.chip.on', viewsBox);
    if (on) requestAnimationFrame(() => { viewsBox.scrollLeft = Math.max(0, on.offsetLeft - 60); });
  }

  // --- 拡大・移動 ---
  // 指やマウスで動かしているあいだは、地図を「1枚の絵」としてずらす・拡大するだけにする（とても軽い）。
  // はなしたら、その位置でくっきり描きなおす。物語のカメラなど、自動の動きはこれまでどおり
  let gest = null, startT = null;
  const zsel = d3.select(stage);
  const zoom = d3.zoom().scaleExtent([1, 400])
    .filter(ev => (!ev.ctrlKey || ev.type === 'wheel') && !ev.button && svgEl.contains(ev.target))
    .on('start.moved', () => { startT = st.t; })
    .on('start.fast', ev => {
      if (!ev.sourceEvent || opts.mini || gest) return;
      gest = { t0: st.t };
      svgEl.style.willChange = 'transform'; hideTip();
    })
    .on('zoom', ev => {
    st.t = ev.transform; st.k = ev.transform.k;
    if (ev.sourceEvent) st.cam = null;   // 自分で動かしたら、物語のカメラの目標は忘れる
    if (gest) {
      if (ev.sourceEvent) {
        const t0 = gest.t0, t1 = ev.transform, r = t1.k / t0.k;
        svgEl.style.transform = `translate(${t1.x - t0.x * r}px, ${t1.y - t0.y * r}px) scale(${r})`;
        if (!zoomRaf) zoomRaf = requestAnimationFrame(() => { zoomRaf = 0; drawInset(true); });
        return;
      }
      endGest();   // 動かしているとちゅうで自動の動きが始まったら、ふつうの描き方にもどす
    }
    // 都市の大きさまで拡大したら、国の色をうすくして地形の線を見やすく
    gPol.style('opacity', st.k > 25 ? 0.22 : st.k > 12 ? 0.6 : null); gEdge.style('opacity', st.k > 25 ? 0.3 : null);
    gZoom.attr('transform', ev.transform);
    // 名前や点の置きなおしは、1コマに1回だけ（ホイールやピンチで何回よばれても）
    if (!zoomRaf) zoomRaf = requestAnimationFrame(() => { zoomRaf = 0; updateTerrain(); placeOverlay(); drawInset(true); });
  });
  let zoomRaf = 0;
  function endGest() {
    if (!gest) return;
    gest = null;
    svgEl.style.transform = ''; svgEl.style.willChange = '';
    gPol.style('opacity', st.k > 25 ? 0.22 : st.k > 12 ? 0.6 : null); gEdge.style('opacity', st.k > 25 ? 0.3 : null);
    gZoom.attr('transform', st.t);
    updateTerrain(); placeOverlay();
  }
  zoom.on('end.relief', ev => { endGest(); updateDetail(); drawInset(); scheduleRelief(); if (ev.sourceEvent && startT && (Math.abs(startT.x - st.t.x) + Math.abs(startT.y - st.t.y) > 4 || Math.abs(startT.k - st.t.k) > 0.01)) { markNear(); showViews(4000); } });
  zsel.call(zoom).on('dblclick.zoom', null);
  // 最初に少しだけ見せて、ここにあることを知らせる
  setTimeout(() => showViews(3500), 300);
  $$('.hm-tools button[data-z]', root).forEach(b => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'reset') zsel.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
    else zsel.transition().duration(250).call(zoom.scaleBy, z === 'in' ? 1.6 : 1 / 1.6);
  }));

  function resize() {
    const r = stage.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;   // まだ画面に並んでいない（大きさが決まったら、もう一度よばれる）
    const w = Math.max(200, Math.round(r.width)), h = Math.max(160, Math.round(r.height));
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h;
    // 文字の大きさを地図の大きさに合わせる（スマホは小さめ、プロジェクターや大きな画面では大きく）
    st.ls = clamp(Math.min(w / 1000, h / 620), 0.82, 1.7) * (document.documentElement.classList.contains('big') ? 1.35 : 1);   // 教室用の大きな文字なら、さらに大きく
    root.style.setProperty('--ls', st.ls.toFixed(3));
    mcache.clear();
    svg.attr('viewBox', `0 0 ${w} ${h}`);
    zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.6, -h * 0.6], [w * 1.6, h * 1.6]]);
    buildBase();
    if (st.cam) { zsel.interrupt(); flyTo(st.cam.lon, st.cam.lat, st.cam.span, null, 0); }
    requestDraw();
  }

  // 画面上の形（SVG の d）を覚えておく：年を変えても、同じ形は計算しなおさない
  let pathCache = new WeakMap(), boundsCache = new WeakMap();
  const pathOf = f => { let d = pathCache.get(f); if (d === undefined) { d = path(f) || ''; pathCache.set(f, d); } return d; };
  const boundsOf = f => { let b = boundsCache.get(f); if (!b) { b = path.bounds(f); boundsCache.set(f, b); } return b; };
  // 画面に合った細かさの形を作る：1ピクセルより近い点はとばす（遠くから見るときは軽く、拡大したら細かく）
  let detailK = 1;
  function makePath(k) {
    const tol = 0.7 / k;
    return d3.geoPath({ stream: out => pr.stream({
      _x: NaN, _y: NaN, _n: 0,
      point(x, y) { if (this._n === 0 || Math.abs(x - this._x) + Math.abs(y - this._y) >= tol) { this._x = x; this._y = y; out.point(x, y); } this._n++; },
      lineStart() { this._n = 0; out.lineStart(); }, lineEnd() { out.lineEnd(); },
      polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); }, sphere() { out.sphere && out.sphere(); }
    }) });
  }
  // 拡大のしかたが大きく変わったら、形を細かさに合わせて作りなおす
  // 一度計算した細かさの形はとっておく（拡大・縮小を行ったり来たりしても、すぐ出る）
  let pathCaches = new Map(), detailJob = 0;
  function updateDetail() {
    const k = Math.pow(2, Math.max(0, Math.floor(Math.log2(st.k || 1))));
    if (k === detailK) return;
    detailK = k;
    path = makePath(detailK);
    if (!pathCaches.has(k)) { if (pathCaches.size > 5) pathCaches.delete(pathCaches.keys().next().value); pathCaches.set(k, [new WeakMap(), new WeakMap()]); }
    [pathCache, boundsCache] = pathCaches.get(k);
    // 形の作りなおしは、1コマに 8 ミリ秒ずつ。指で動かすのをじゃましない
    const job = ++detailJob, P = path, tasks = [];
    // 計算は少しずつ、書きかえは最後に1回で（書きかえのたびに地図全体を描きなおさないように）
    const out = [];
    const each = (sel, fn) => sel.each(function (d) { const n = this; tasks.push(() => out.push([n, fn(d) || ''])); });
    each(gPol.selectAll('path.hm-pol'), pathOf);
    each(gEdge.selectAll('path'), pathOf);
    each(gSph.selectAll('path'), pathOf);
    let newLand = null, newGrat = null, newMesh = null;
    tasks.push(() => { newLand = P(GEO.world().land); });
    tasks.push(() => { newGrat = P(d3.geoGraticule10()); });
    tasks.push(() => { if (drawStatic.mesh) newMesh = P(drawStatic.mesh); });
    each(gTerr.selectAll('path'), d => P(d));
    each(gWater.selectAll('path'), d => P(d));
    let i = 0;
    (function run() {
      if (job !== detailJob) return;
      const t0 = performance.now();
      while (i < tasks.length && performance.now() - t0 < 8) tasks[i++]();
      if (i < tasks.length) { requestAnimationFrame(run); return; }
      if (gest) { requestAnimationFrame(run); return; }   // 動かしているあいだは待つ
      out.forEach(([n, d]) => n.setAttribute('d', d));
      landPath = newLand;
      gBase.select('.hm-land').attr('d', landPath);
      gBase.select('.hm-grat').attr('d', newGrat);
      const W3 = st.w * 4, H3 = st.h * 4;
      gMask.select('.hm-seamask').attr('d', `M${-W3},${-H3}H${W3 + st.w}V${H3 + st.h}H${-W3}Z` + landPath);
      if (newMesh) gModern.select('path').attr('d', newMesh);
    })();
  }
  // 地形などのデータがあとから届いたら、かき直す
  function onLate() { if (pr) { drawStatic(); requestDraw(); } }
  window.addEventListener('lateready', onLate);
  function buildBase() {
    pr = GEO.projection(st.view, st.w, st.h);
    labelCache.clear();
    detailK = Math.pow(2, Math.max(0, Math.floor(Math.log2(st.k || 1))));
    path = makePath(detailK);
    detailJob++; pathCaches = new Map([[detailK, [new WeakMap(), new WeakMap()]]]);
    [pathCache, boundsCache] = pathCaches.get(detailK);
    drawStatic();
    renderViews();
    scheduleRelief(true);
  }
  // 年によって変わらないもの（海・陸・経緯線・今の国境・地形）
  function drawStatic() {
    const { land, countries } = GEO.world();
    landPath = path(land);
    gBase.selectAll('*').remove();
    gBase.append('rect').attr('class', 'hm-sea').attr('x', -st.w).attr('y', -st.h).attr('width', st.w * 3).attr('height', st.h * 3);
    gBase.append('path').attr('class', 'hm-grat').attr('d', path(d3.geoGraticule10()));
    gBase.append('path').attr('class', 'hm-land').attr('d', landPath);
    // 海の「ふた」：国の色や影は海の上にもはみ出して描き、上から海の色でかくす（切り抜きより、ずっと軽い）
    gMask.selectAll('*').remove();
    const W3 = st.w * 4, H3 = st.h * 4;
    gMask.append('path').attr('class', 'hm-seamask').attr('fill-rule', 'evenodd')
      .attr('d', `M${-W3},${-H3}H${W3 + st.w}V${H3 + st.h}H${-W3}Z` + landPath);
    gModern.selectAll('*').remove();
    if (!drawStatic.mesh) drawStatic.mesh = topojson.mesh(window.WORLD_TOPO, window.WORLD_TOPO.objects.countries, (a, b) => a !== b);
    gModern.append('path').attr('class', 'hm-modern').attr('d', path(drawStatic.mesh));
    buildTerrain();
  }

  // --- 陰影起伏を、今の見え方で描きなおす（動かし終わってから） ---
  let relTok = 0, relTimer = null, relUrl = null;
  function scheduleRelief(now) {
    clearTimeout(relTimer);
    relTimer = setTimeout(renderRelief, now ? (drawnOnce ? 30 : 700) : 160);   // 最初は、地図を出してから影をつける
  }
  async function renderRelief() {
    if (opts.mini || !st.layers.terrain || typeof RELIEF === 'undefined' || !pr) { gRel.selectAll('*').remove(); return; }
    const tok = ++relTok, t = st.t, W = st.w, H = st.h;
    // 細かさ：画面の1ピクセルが何度か
    const a = pr.invert(t.invert([W / 2, H / 2])), b = pr.invert(t.invert([W / 2 + 20, H / 2]));
    const dpp = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) / 20 : 1;
    const scale = dpp > 0.15 ? 0.5 : 0.75;   // 影はぼんやりしたものなので、画面より少しあらくて十分   // 世界全体のときは、半分の細かさで十分
    const RW = Math.round(W * scale), RH = Math.round(H * scale);
    const inv = (x, y) => { const q = t.invert([x / scale, y / scale]); const ll = pr.invert(q); if (!ll || !isFinite(ll[0])) return null; const back = pr(ll); return back && Math.abs(back[0] - q[0]) < 2 && Math.abs(back[1] - q[1]) < 2 ? ll : null; };
    const c = await RELIEF.render(RW, RH, inv, dpp < 0.07, () => tok !== relTok);
    if (!c || tok !== relTok) return;
    const x0 = t.invert([0, 0]), x1 = t.invert([W, H]);
    // 画像にするのも、待ち時間に（toDataURL より軽い）
    const url = await new Promise(r => c.toBlob(b => r(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.85));
    if (!url || tok !== relTok) { if (url) URL.revokeObjectURL(url); return; }
    if (relUrl) URL.revokeObjectURL(relUrl); relUrl = url;
    gRel.selectAll('*').remove();
    gRel.append('image').attr('href', url).attr('x', x0[0]).attr('y', x0[1]).attr('width', x1[0] - x0[0]).attr('height', x1[1] - x0[1]).attr('preserveAspectRatio', 'none');
  }

  // --- 地形（山脈・砂漠・高原）と川・湖 ---
  let terr = null;
  function terrainData() {
    if (terr || !window.TERRAIN) return terr;
    const t = window.TERRAIN;
    terr = {
      regions: topojson.feature(t, t.objects.regions).features,
      rivers: topojson.feature(t, t.objects.rivers_ja).features,
      lakes: topojson.feature(t, t.objects.lakes).features
    };
    return terr;
  }
  const TCLS = { 'Range/mtn': 'mtn', Desert: 'des', Plateau: 'pla', Tundra: 'tun', Foothills: 'mtn' };
  function buildTerrain() {
    gTerr.selectAll('*').remove(); gWater.selectAll('*').remove();
    const T = terrainData(); if (!T) return;
    // 地形も海のふたで隠れる（切り抜きは使わない）
    gTerr.selectAll('path').data(T.regions.filter(f => TCLS[f.properties.c])).join('path')
      .attr('class', f => 'tr-' + TCLS[f.properties.c]).attr('d', path);
    gWater.selectAll('path.tr-lake').data(T.lakes).join('path').attr('class', 'tr-lake').attr('d', path);
    gWater.selectAll('path.tr-riv').data(T.rivers).join('path').attr('class', 'tr-riv').attr('d', path)
      .attr('stroke-width', f => Math.max(0.5, 2.2 - f.properties.r * 0.25));
    // 名前の位置（いちばん長い線のまん中・形のまん中）
    T.rivers.forEach(f => {
      if (!f.properties.n) return;
      const ls = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const l = ls.reduce((a, b) => (b.length > a.length ? b : a), []);
      f.lab = l[Math.floor(l.length / 2)];
    });
    T.regions.forEach(f => { f.lab = d3.geoCentroid(f); });
    updateTerrain();
  }
  function updateTerrain() {
    const on = st.layers.terrain;
    gRel.style('display', on ? null : 'none');
    gTerr.style('display', on ? null : 'none');
    gWater.style('display', on ? null : 'none');
    if (!on) return;
    const k = st.k;
    // 拡大するほど、小さい川も出す
    const maxR = k < 1.5 ? 3 : k < 3 ? 4 : k < 6 ? 5 : k < 12 ? 6 : 7;
    gWater.selectAll('path.tr-riv').style('display', f => f.properties.r <= maxR ? null : 'none');
    gTerr.style('opacity', k > 25 ? 1 : null);
  }

  // --- 引きの地図（強く拡大したときだけ、右上に小さく） ---
  const inset = $('.hm-inset', root), isvg = d3.select($('svg', inset));
  inset.addEventListener('click', e => { e.stopPropagation(); zsel.transition().duration(500).call(zoom.transform, d3.zoomIdentity); });
  inset.addEventListener('pointerdown', e => e.stopPropagation());
  let insetKey = '', insetIp = null, insetTimer = null;
  // 引きの地図は小さいので、形をあらくしたもの（0.2度より近い点は省く）を使う。一度作ったらとっておく
  const liteCache = new WeakMap();
  function lite(f) {
    if (!f) return f;
    let g = liteCache.get(f); if (g) return g;
    if (!f.geometry && f.coordinates) { const w = lite({ type: 'Feature', properties: {}, geometry: f }); liteCache.set(f, w); return w; }
    if (!f.geometry) return f;
    const ring = r => { const o = []; let lx = 1e9, ly = 1e9; r.forEach((p, i) => { if (i === 0 || i === r.length - 1 || Math.abs(p[0] - lx) + Math.abs(p[1] - ly) > 0.2) { o.push(p); lx = p[0]; ly = p[1]; } }); return o.length >= 4 ? o : null; };
    const poly = c => { const o = c.map(ring); return o[0] ? o.filter(Boolean) : null; };
    const G = f.geometry, cs = G.type === 'Polygon' ? [G.coordinates] : G.type === 'MultiPolygon' ? G.coordinates : null;
    if (!cs) { liteCache.set(f, f); return f; }
    // あらくしたら向きが裏返った（地球の半分より大きくなった）形は、元の形のまま使う
    const out = cs.map((c, i) => { const o = poly(c); return o && d3.geoArea({ type: 'Polygon', coordinates: o }) < 2 * Math.PI ? o : c; });
    g = { type: 'Feature', properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: out } };
    liteCache.set(f, g); return g;
  }
  // light：動かしているあいだは、中の地図は作りなおさず、四角だけ動かす（作りなおすのは手をはなしてから）
  function drawInset(light) {
    if (opts.mini || !pr) return;
    const show = st.k >= 3.5, wasHidden = inset.hidden;
    inset.hidden = !show;
    if (!show) return;
    const IW = Math.round(150 * (st.ls || 1)), IH = Math.round(IW * 0.66);
    // 拡大のしかたに合わせて、引きの地図の範囲を決める（とても強い拡大なら地域、そうでなければ今の範囲全体）
    const c = pr.invert(st.t.invert([st.w / 2, st.h / 2]));
    if (!c) return;
    if (light && insetIp && !wasHidden) { insetBox(insetIp, c); return; }
    const spanNow = (() => { const a = pr.invert(st.t.invert([0, st.h / 2])), b = pr.invert(st.t.invert([st.w, st.h / 2])); return a && b ? Math.abs(b[0] - a[0]) || 1 : 10; })();
    const ispan = clamp(spanNow * 9, 16, 80);
    const key = [Math.round(c[0] / (ispan / 6)), Math.round(c[1] / (ispan / 6)), Math.round(ispan), IW, st.year].join(',');
    const ip = d3.geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).clipAngle(90);
    ip.fitExtent([[2, 2], [IW - 2, IH - 2]], { type: 'MultiPoint', coordinates: [[c[0] - ispan / 2, c[1]], [c[0] + ispan / 2, c[1]], [c[0], c[1] - ispan / 3], [c[0], c[1] + ispan / 3]] });
    const ipath = d3.geoPath({ stream: out => ip.stream({ _x: NaN, _y: NaN, _n: 0, point(x, y) { if (this._n++ === 0 || Math.abs(x - this._x) + Math.abs(y - this._y) >= 1) { this._x = x; this._y = y; out.point(x, y); } }, lineStart() { this._n = 0; out.lineStart(); }, lineEnd() { out.lineEnd(); }, polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); }, sphere() { out.sphere && out.sphere(); } }) });   // 小さい地図なので、1ピクセルより細かい点はとばす
    isvg.attr('width', IW).attr('height', IH).attr('viewBox', `0 0 ${IW} ${IH}`);
    if (key !== insetKey) {
      insetKey = key; insetIp = ip;
      isvg.selectAll('*').remove();
      isvg.append('rect').attr('class', 'in-sea').attr('width', IW).attr('height', IH);
      isvg.append('path').attr('class', 'in-land').attr('d', ipath(lite(GEO.world().land)));
      isvg.append('g').selectAll('path').data(feats).join('path').attr('class', 'in-pol').attr('d', f => ipath(lite(f))).attr('fill', f => f.properties.p.color || '#888');
      isvg.append('g').attr('class', 'in-labs');
      isvg.append('path').attr('class', 'in-box');
      isvg.append('circle').attr('class', 'in-dot').attr('r', 3.5);
      // 大きな国の名前を少しだけ（作りなおすときだけ計算する）
      const labs = feats.filter(f => (f.properties.p.rank || 2) <= 2).sort((a, b) => (a.properties.p.rank || 2) - (b.properties.p.rank || 2) || d3.geoArea(lite(b)) - d3.geoArea(lite(a))).map(f => { const q = ip(d3.geoCentroid(lite(f))); return q && q[0] > 8 && q[0] < IW - 8 && q[1] > 6 && q[1] < IH - 4 ? { n: f.properties.p.name, q } : null; }).filter(Boolean).slice(0, 4);
      isvg.select('.in-labs').selectAll('text').data(labs).join('text').attr('x', d => d.q[0]).attr('y', d => d.q[1]).text(d => d.n);
    }
    insetBox(insetIp, c);
  }
  function insetBox(ip, c) {
    // いま見ている範囲の四角
    const pts = [[0, 0], [st.w / 2, 0], [st.w, 0], [st.w, st.h / 2], [st.w, st.h], [st.w / 2, st.h], [0, st.h], [0, st.h / 2]]
      .map(q => pr.invert(st.t.invert(q))).filter(Boolean).map(ll => ip(ll)).filter(Boolean);
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const small = !pts.length || (Math.max(...xs) - Math.min(...xs) < 7 && Math.max(...ys) - Math.min(...ys) < 7);
    isvg.select('.in-box').attr('d', pts.length > 2 && !small ? d3.line()(pts) + 'Z' : null);
    const cc = ip(c);
    isvg.select('.in-dot').attr('cx', cc ? cc[0] : -10).attr('cy', cc ? cc[1] : -10).style('display', small ? null : 'none');
  }

  // --- 名前の位置（いちばん大きい部分のまん中） ---
  const labelCache = new Map();
  function labelPoint(f) {
    const p = f.properties.p;
    // 決めてある名前の位置は、その時代の範囲の中にあるときだけ使う（国が小さくなった時代にずれないように）
    const key = st.view + '|' + p.id + '|' + f.properties.s.from;
    if (labelCache.has(key)) return labelCache.get(key);
    // 名前の位置を決めるだけなので、あらくした形で計算する（細かい形より、ずっと速い。小さすぎて形が消えるときは細かい形で）
    const lf0 = lite(f), lf = lf0 && lf0.geometry && lf0.geometry.coordinates.length ? lf0 : f;
    if (p.label && d3.geoContains(lf, p.label)) { const q = pr(p.label); labelCache.set(key, q); return q; }
    let best = null, bestA = -1;
    const polys = lf.geometry.type === 'Polygon' ? [lf.geometry.coordinates] : lf.geometry.coordinates;
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
  let drawnOnce = false;
  function draw() {
    if (!pr) return;
    if (!drawnOnce) { drawnOnce = true; requestAnimationFrame(() => window.dispatchEvent(new Event('mapdrawn'))); }
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
      .merge(ss).attr('d', pathOf).attr('fill', f => `url(#${f.pat})`).attr('stroke', f => f.properties.p.color || '#888');
    if (opts.only) feats = feats.filter(f => opts.only.includes(f.properties.p.id));
    const sel = st.sel;
    const ps = gPol.selectAll('path.hm-pol').data(feats, f => f.properties.p.id + '|' + f.properties.s.from);
    ps.exit().remove();
    ps.enter().append('path').attr('class', 'hm-pol')
      .on('click', (ev, f) => { ev.stopPropagation(); select({ type: 'polity', id: f.properties.p.id }); })
      .on('mousemove', (ev, f) => showTip(ev, `<b>${esc(f.properties.p.name)}</b> <span class="muted num">${span(f.properties.p.start, f.properties.p.end)}</span>`))
      .on('mouseleave', hideTip)
      .merge(ps)
      .attr('d', pathOf)
      .attr('fill', f => f.properties.p.color || '#888')
      .attr('stroke', f => f.properties.p.color || '#888')
      .classed('sel', f => (sel && sel.type === 'polity' && sel.id === f.properties.p.id) || (st.story && st.story.polities.includes(f.properties.p.id)))
      .classed('dim', f => !!(st.story && st.story.polities.length && !st.story.polities.includes(f.properties.p.id)))
      .order();
    const es = gEdge.selectAll('path').data(feats, f => f.properties.p.id + '|' + f.properties.s.from);
    es.exit().remove();
    es.enter().append('path').attr('class', 'hm-edge').merge(es).attr('d', pathOf).attr('stroke', f => f.properties.p.color || '#888');
    gModern.style('display', st.layers.modern ? null : 'none');

    // 人物
    shownPeople = st.story ? st.story.people.map(id => PERSON[id]).filter(Boolean).map(p => ({ p, pl: GEO.placeAt(p, clamp(y, p.born, p.died)) })).filter(x => x.pl)
      : st.layers.people ? PEOPLE.filter(p => y - p.born >= 15).map(p => ({ p, pl: GEO.placeAt(p, y) })).filter(x => x.pl) : [];   // 子どものころは出さない（活躍する年れいから）
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
    // 引きの地図の国の色は、年が止まってから作りなおす（ツマミを動かしているあいだは四角だけ）
    drawInset(true); clearTimeout(insetTimer); insetTimer = setTimeout(() => drawInset(), 350);
    // 年の表示
    $('.hm-yearbig', root).innerHTML = `${esc(yearLabel(y))}<small>${esc(eraName(y))}</small>`;
    if (opts.bar !== false) {
      $('.yr', root).textContent = yearLabel(y);
      const r = $('.hm-slider input', root);
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
      if (!textW.ff) textW.ff = {}; const kk = display ? 'd' : 'b';
      if (textW.ff[kk] === undefined) textW.ff[kk] = getComputedStyle(document.documentElement).getPropertyValue(display ? '--font-display' : '--font-body');
      const ff = textW.ff[kk];
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
    if (opts.mini) { gPlc.selectAll('*').remove(); gLab.selectAll('*').remove(); gCap.selectAll('*').remove(); gEv.selectAll('*').remove(); gPeo.selectAll('*').remove(); gTrail.selectAll('*').remove(); return; }
    const t = st.t, W = st.w, H = st.h, sel = st.sel;
    const PAD = 2;
    const boxes = [];
    const hit = b => b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > H - 2 || boxes.some(o => b[0] - PAD < o[2] && b[2] + PAD > o[0] && b[1] - PAD < o[3] && b[3] + PAD > o[1]);
    const inView = (x, y) => x > -10 && x < W + 10 && y > -10 && y < H + 10;
    const isSelP = id => sel && sel.type === 'person' && sel.id === id;
    // 左上の大きな年と、右上のボタンの場所はあけておく
    boxes.push([0, 0, 190, 70], [W - 52, 0, W, 150], [0, H - 40, W, H]);
    // 引きの地図が出ているときは、その下に名前を置かない
    if (st.k >= 3.5) { const IW = Math.round(150 * (st.ls || 1)); boxes.push([W - 56 - IW, 0, W, IW * 0.66 + 14]); }

    // 物語の地点・進路（名前の場所取りより先に）
    const storyLabels = drawStory(boxes);

    // えらんだ地名の名前は、人物などより先に場所をとる
    let selPlaceBox = null;
    if (sel && sel.type === 'place' && PLACE[sel.id]) {
      const pl = PLACE[sel.id], nm = placeNameAt(pl, st.year), q = nm && pr([pl.lon, pl.lat]);
      if (q) {
        const [x, y] = t.apply(q), S = st.ls || 1, w = textW(nm.name, 14 * S, true) + 8, h = 17 * S;
        // 点のすぐ上・下・右・左のうち、人物の写真にかからない所に置く（点から離さない）
        const pts = shownPeople.map(o => { const qq = pr([o.pl.lon, o.pl.lat]); return qq ? t.apply(qq) : null; }).filter(Boolean);
        const free = b => !pts.some(([a, c]) => a > b[0] - 13 && a < b[2] + 13 && c > b[1] - 13 && c < b[3] + 13);
        const G = 9;
        const cands = [
          { b: [x - w / 2, y - G - h, x + w / 2, y - G], dx: 0, dy: -G - h / 2, a: 'middle' },
          { b: [x - w / 2, y + G, x + w / 2, y + G + h], dx: 0, dy: G + h / 2, a: 'middle' },
          { b: [x + G, y - h / 2, x + G + w, y + h / 2], dx: G + 4, dy: 0, a: 'start' },
          { b: [x - G - w, y - h / 2, x - G, y + h / 2], dx: -G - 4, dy: 0, a: 'end' }
        ];
        // どこも写真にかかるときは、上に少し離して置き、点まで細い線を引く
        const c = cands.find(c => free(c.b)) || { b: [x - w / 2, y - 46 - h, x + w / 2, y - 46], dx: 0, dy: -46 - h / 2, a: 'middle', leader: 46 };
        selPlaceBox = c.b; selPlaceBox.lab = c; boxes.push(selPlaceBox);
      }
    }
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

    // 歴史的な地名（その年の名前で。都と同じ場所なら、都の名前のかわりにこちらを出す）
    const plc = [];
    if (st.layers.places && PLACES.length && !opts.mini) {
      const lim = t.k < 1.6 && st.view === 'world' ? 1 : t.k < 3 ? 2 : 3;
      PLACES.forEach(pl => {
        if ((pl.rank || 2) > lim) return;
        const nm = placeNameAt(pl, st.year); if (!nm) return;
        const q = pr([pl.lon, pl.lat]); if (!q) return;
        const [x, y] = t.apply(q); if (!inView(x, y)) return;
        if (storyLabels.some(m => Math.hypot(m.x - x, m.y - y) < 7)) return;
        plc.push({ pl, name: nm.name, x, y, lab: null, sel: sel && sel.type === 'place' && sel.id === pl.id });
        boxes.push([x - 4, y - 4, x + 4, y + 4]);
      });
    }
    // 都の点
    const caps = [];
    if (st.layers.cap) feats.forEach(f => {
      const p = f.properties.p, c = GEO.capitalAt(p, st.year); if (!c) return;
      if ((p.rank || 2) >= 3 && t.k < 2 && !(sel && sel.id === p.id)) return;
      const q = pr([c.lon, c.lat]); if (!q) return;
      const [x, y] = t.apply(q); if (!inView(x, y)) return;
      if (caps.some(o => Math.hypot(o.x - x, o.y - y) < 5)) return;
      if (storyLabels.some(m => Math.hypot(m.x - x, m.y - y) < 7)) return;   // 物語の地点と同じ場所の都は出さない
      const merged = plc.find(o => Math.hypot(o.x - x, o.y - y) < 9);
      if (merged) merged.cap = true;
      caps.push({ id: p.id + c.name, name: c.name, x, y, rank: p.rank || 2, lab: null, merged: !!merged });
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
      for (const c of cands) if (!hit(c.b)) { boxes.push(c.b); return c; }
      const f = cands.find(c => c.force); if (f) { boxes.push(f.b); return f; }   // えらんだものは、あいた所がなければ最初の位置に
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
      const bounds = boundsOf(f); const wpx = (bounds[1][0] - bounds[0][0]) * t.k, hpx = (bounds[1][1] - bounds[0][1]) * t.k;
      const isSel = sel && sel.type === 'polity' && sel.id === p.id;
      if (!isSel && wpx < 22) return null;
      if (st.view === 'world' && t.k < 1.6 && rank >= 3 && !isSel) return null;
      const S = st.ls || 1;
      let fs = rank === 1 ? 17 : rank === 2 ? 14 : 12;
      if (wpx < 80) fs = Math.max(11, fs - 3);
      fs *= S;
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
      const S = st.ls || 1, s = isSelP(x.p.id), w = textW(x.p.name, 12 * S, false), h = 14 * S;
      jobs.push({ pri: s ? 0 : PORTRAITS[x.p.id] ? 2 : 4, sub: 0, run: () => { x.lab = tryPlace(side(x.sx, x.sy, x.r + 3, w, h, s)); } });
    });
    plc.forEach(o => {
      const S = st.ls || 1, w = textW(o.name, 12 * S, true), h = 14 * S;
      if (o.sel && selPlaceBox) { o.lab = selPlaceBox.lab; return; }
      jobs.push({ pri: o.sel ? 0 : (o.pl.rank || 2) === 1 ? 1.5 : 4.9, sub: o.pl.rank || 2, run: () => { o.lab = tryPlace(side(o.x, o.y, 6, w, h, o.sel).concat(side(o.x, o.y, 17, w, h, false))); } });   // 人物の写真と重なるときは少し外側に
    });
    caps.forEach(c => {
      const S = st.ls || 1, w = textW(c.name, 11 * S, false), h = 13 * S;
      if (!(t.k >= 1.4 || st.view !== 'world' || c.rank === 1)) return;
      if (c.merged) return;
      jobs.push({ pri: 5, sub: c.rank, run: () => { c.lab = tryPlace(side(c.x, c.y, 6, w, h, false)); } });
    });
    evs.forEach(x => {
      const s = sel && sel.type === 'event' && sel.id === x.i;
      if (!s && x.age > x.win / 3) return;
      const S = st.ls || 1, w = textW(x.e.title, 11 * S, false), h = 13 * S;
      jobs.push({ pri: s ? 0 : 7, sub: x.age, run: () => { x.lab = tryPlace(side(x.sx, x.sy, 9, w, h, s)); } });
    });
    storyLabels.forEach(m => jobs.push({ pri: m.main ? 0 : 1, sub: 0, run: () => { m.lab = tryPlace(side(m.x, m.y, m.main ? 13 : 7, textW(m.name, (m.main ? 14 : 12) * (st.ls || 1), false), (m.main ? 17 : 14) * (st.ls || 1), m.main)); } }));
    // 地形の名前・川の名前・今の町（いちばん後回し。あいている所だけ）
    const tlabs = [];
    const T = terrainData();
    if (T && st.layers.terrain && !opts.mini) {
      const k = st.k, S = st.ls || 1;
      T.regions.forEach(f => {
        const p = f.properties; if (!TCLS[p.c] || !p.n) return;
        if (p.r > (k < 2 ? 2 : k < 4 ? 3 : k < 8 ? 4 : 5)) return;
        const q = pr(f.lab); if (!q) return; const [x, y] = t.apply(q); if (!inView(x, y)) return;
        const w = textW(p.n, 11.5 * S, false) * 1.15, h = 13 * S;
        jobs.push({ pri: 8.2, sub: p.r, run: () => { const b = [x - w / 2, y - h / 2, x + w / 2, y + h / 2]; if (!hit(b)) { boxes.push(b); tlabs.push({ cls: 'tl-' + TCLS[p.c], n: p.n, x, y, a: 'middle' }); } } });
      });
      if (k >= 2.5) T.rivers.forEach(f => {
        const p = f.properties; if (!p.n || !f.lab || p.r > (k < 5 ? 3 : k < 10 ? 5 : 7)) return;
        const q = pr(f.lab); if (!q) return; const [x, y] = t.apply(q); if (!inView(x, y)) return;
        const w = textW(p.n, 11 * S, false), h = 13 * S;
        jobs.push({ pri: 8.5, sub: p.r, run: () => { const b = [x + 3, y - h, x + 3 + w, y]; if (!hit(b)) { boxes.push(b); tlabs.push({ cls: 'tl-riv', n: p.n, x: x + 3, y: y - h / 2, a: 'start' }); } } });
      });
    }
    if (window.CITIES && st.layers.cities && !opts.mini && st.k >= 3) {
      const k = st.k, S = st.ls || 1, maxR = k < 6 ? 2 : k < 12 ? 3 : k < 30 ? 5 : 6;
      window.CITIES.forEach(([n, lon, lat, r]) => {
        if (r > maxR) return;
        if (plc.some(o => Math.abs(o.pl.lon - lon) < 0.3 && Math.abs(o.pl.lat - lat) < 0.3)) return;   // 歴史的な地名と同じ町は出さない
        const q = pr([lon, lat]); if (!q) return; const [x, y] = t.apply(q); if (!inView(x, y)) return;
        const w = textW(n, 10.5 * S, false), h = 12 * S;
        jobs.push({ pri: 7.6, sub: r, run: () => { const b = [x - 3, y - h / 2, x + 5 + w, y + h / 2]; if (!hit(b)) { boxes.push(b); tlabs.push({ cls: 'tl-city', n, x, y, a: 'start', dot: true }); } } });
      });
    }
    jobs.sort((a, b) => a.pri - b.pri || a.sub - b.sub).forEach(j => j.run());
    gTlab.selectAll('g').data(tlabs).join(en => { const g = en.append('g'); g.append('circle'); g.append('text'); return g; })
      .attr('class', d => d.cls).attr('transform', d => `translate(${d.x},${d.y})`)
      .call(g => g.select('circle').attr('r', d => (d.dot ? 1.8 : 0)))
      .call(g => g.select('text').attr('x', d => (d.dot ? 4 : 0)).attr('text-anchor', d => d.a).attr('dominant-baseline', 'central').text(d => d.n));
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

    const ps2 = gPlc.selectAll('g').data(plc, d => d.pl.id);
    ps2.exit().remove();
    const pe2 = ps2.enter().append('g').attr('class', 'hm-plc')
      .on('click', (ev, d) => { ev.stopPropagation(); const [mx, my] = d3.pointer(ev, svgEl); const cur = gPlc.selectAll('g.hm-plc').data(); let best = d, bd = Math.hypot(d.x - mx, d.y - my); cur.forEach(o => { const dd = Math.hypot(o.x - mx, o.y - my); if (dd < bd - 0.5) { bd = dd; best = o; } }); select({ type: 'place', id: best.pl.id }); })
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.name)}</b>${(() => { const m = d.pl.modern; if (!m || m === d.name) return ''; const r = m.startsWith(d.name) ? m.slice(d.name.length).replace(/^（(.*)）$/, '$1') : m; return r ? `（今の${esc(r)}）` : ''; })()}<br><span style="font-size:12px">${esc(d.pl.text || '')}</span>`))
      .on('mouseleave', hideTip);
    pe2.append('line').attr('class', 'lead');
    pe2.append('path').attr('d', 'M0,-4.5L4.5,0L0,4.5L-4.5,0Z');
    pe2.append('rect').attr('class', 'selbg');
    pe2.append('text').attr('dominant-baseline', 'central');
    const pm2 = pe2.merge(ps2).attr('transform', d => `translate(${d.x},${d.y})`).classed('sel', d => d.sel).classed('cap', d => !!d.cap);
    pm2.filter(d => d.sel).raise();
    if (plc.some(d => d.sel)) gPlc.raise(); else gPlc.lower();
    pm2.select('text').each(function (d) {
      const s = d3.select(this);
      if (!d.lab) { s.text(''); return; }
      s.attr('x', d.lab.dx).attr('y', d.lab.dy).attr('text-anchor', d.lab.a).text(d.name);
    });
    // えらんだ地名：名前の後ろに白い札、離れたときは点まで線
    pm2.each(function (d) {
      const g = d3.select(this), r = g.select('rect.selbg'), ln = g.select('line.lead');
      if (!d.sel || !d.lab) { r.attr('width', 0).attr('height', 0); ln.attr('y2', 0).attr('y1', 0); return; }
      const bb = this.querySelector('text').getBBox();
      r.attr('x', bb.x - 5).attr('y', bb.y - 2).attr('width', bb.width + 10).attr('height', bb.height + 4).attr('rx', 6);
      if (d.lab.leader) ln.attr('x1', 0).attr('y1', -5).attr('x2', 0).attr('y2', -d.lab.leader + 2); else ln.attr('y1', 0).attr('y2', 0);
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
  // 大きな文字・印刷
  { const bk = $('.big-ck', root); if (bk) { bk.checked = document.documentElement.classList.contains('big');
      bk.addEventListener('change', () => { setBigText(bk.checked); }); }
    const pb = $('.print-btn', root); if (pb) pb.addEventListener('click', () => { const sb = $('.hm-set', root); if (sb) sb.hidden = true; setTimeout(() => window.print(), 50); }); }
  const onBig = () => { st.w = 0; resize(); };
  window.addEventListener('bigtext', onBig);
  // スマホでは指が「はなれた」ことがわからないので、どこかをタップしたら一度消す（地名をタップしたときは、そのあとで出し直す）
  const onDown = () => hideTip();
  document.addEventListener('pointerdown', onDown, true);
  svg.on('click', () => { const sb = $('.hm-set', root); if (sb && !sb.hidden) { sb.hidden = true; $('.gear', root).setAttribute('aria-expanded', 'false'); return; } if (st.sel) select(null); });

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
    if (!step) { st.story = null; requestDraw(); return; }
    st.story = {
      center: { lon: step.lon, lat: step.lat, name: step.place },
      marks: step.marks || [], routes: step.routes || [], lines: step.lines || [],
      people: step.people || [], polities: step.polities || [], t0: performance.now()
    };
    requestDraw();
    const S = st.story;
    (function tick() { if (st.story !== S) return; placeOverlay(); if (performance.now() - S.t0 < 3000) requestAnimationFrame(tick); })();
  }
  // その地点を中心に、横 span 度ぶんが入るように拡大して移動
  // --- まわりの「見どころ」の多さで、寄り方を決める ---
  // 町・地名・都がたくさんある所はもっと寄り、何もなくてのっぺりした所は引いて、まわりも見えるようにする
  let lmCache = { key: '', pts: [] };
  function landmarks() {
    const key = Math.round(st.year / 20) + '|' + (window.CITIES || []).length;
    if (lmCache.key === key) return lmCache.pts;
    const y = st.year, pts = [];
    PLACES.forEach(p => { if (placeNameAt(p, y)) pts.push([p.lon, p.lat, (p.rank || 2) === 1 ? 1.5 : 1]); });
    POLITIES.forEach(p => { if (y < p.start || y > p.end) return; const c = GEO.capitalAt(p, y); if (c) pts.push([c.lon, c.lat, 1]); });
    (window.CITIES || []).forEach(([, lon, lat, r]) => pts.push([lon, lat, 0.4, r]));
    lmCache = { key, pts };
    return pts;
  }
  // 横 span 度の画面に、見どころがどれだけ散らばって入るか（画面を 8×6 のマスに分けて、何かがあるマスを数える。同じ場所に重なるものは1つ）
  function richness(lon, lat, span) {
    const cs = Math.max(0.25, Math.cos(lat * Math.PI / 180)), hx = span / 2 / cs, hy = span / 2 * (st.h / Math.max(1, st.w));
    // 拡大するほど小さな町も地図に出るので、その大きさで見える町だけ数える
    const maxR = span < 1.5 ? 6 : span < 4 ? 5 : span < 10 ? 4 : span < 25 ? 3 : 2;
    const cells = new Set();
    landmarks().forEach(([x, y, w, r]) => {
      if (r != null && r > maxR) return;
      let dx = x - lon; if (dx > 180) dx -= 360; if (dx < -180) dx += 360;
      const dy = y - lat;
      if (Math.abs(dx) >= hx || Math.abs(dy) >= hy) return;
      cells.add(Math.floor((dx + hx) / hx * 4) + ',' + Math.floor((dy + hy) / hy * 3));
    });
    return cells.size;
  }
  // keep：かならず画面に入れたい点（物語の地点・進路など）
  function autoSpan(lon, lat, span, keep) {
    const cs = Math.max(0.25, Math.cos(lat * Math.PI / 180)), asp = st.w / Math.max(1, st.h);
    let need = 0;
    // 物語の地点のうち、もともとの範囲の近く（1.5倍まで）にあるものだけは、かならず入れる（遠くのものは、作った人が入れないつもりの所）
    (keep || []).forEach(([x, y]) => { let dx = Math.abs(x - lon); if (dx > 180) dx = 360 - dx; const ex = dx * cs * 2.3, ey = Math.abs(y - lat) * 2.3 * asp; if (Math.max(ex, ey) <= span * 1.5) need = Math.max(need, ex, ey); });
    const lo = Math.max(need, span * 0.45, 0.12), hi = Math.max(need, Math.min(Math.max(span * 4, span < 3 ? 6 : 0), 80));   // とても寄った場面は、6度くらいまでは引いてよい
    let s = Math.max(span, need);
    const R = x => richness(lon, lat, x);
    // にぎやか（マスの半分近くに何かある）なら寄る。さみしい（6マス未満）なら引く
    if (R(s) > 15) { while (s * 0.85 >= lo && R(s * 0.85) >= 10) s *= 0.85; }
    else if (R(s) < 6) { while (s * 1.2 <= hi && R(s) < 6) s *= 1.2; }
    return Math.max(s, need);
  }

  function flyTo(lon, lat, span, view, dur = 1500, keep) {
    if (view && GEO.VIEWS[view] && view !== st.view) setView(view);
    if (keep) span = autoSpan(lon, lat, span, keep === true ? [] : keep);
    st.cam = { lon, lat, span };
    const q = pr([lon, lat]);
    if (!q) { setView('world'); return; }
    const a = pr([lon - span / 2, lat]), b = pr([lon + span / 2, lat]);
    const d = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : st.w;
    const k = clamp(st.w * 0.85 / Math.max(d, 1e-6), 1, 400);
    // テロップが出ているときは、その上のあいている所のまん中に
    const capEl = $('.hm-caption', root);
    const padB = capEl && !capEl.hidden ? capEl.offsetHeight + 14 : 0;
    const cy = (st.h - padB) / 2;
    const tt = d3.zoomIdentity.translate(st.w / 2 - k * q[0], cy - k * q[1]).scale(k);
    // 大きく動くときは、いったん引いてから寄る（どこへ動いたかわかるように）
    const far = Math.abs(Math.log(k / st.t.k)) > 1.5 || Math.hypot(st.t.applyX(q[0]) - st.w / 2, st.t.applyY(q[1]) - st.h / 2) > st.w * 0.6;
    if (far && dur > 0) {
      const k1 = Math.max(1, Math.min(st.t.k, k) / 3);
      const mid = [ (st.t.invertX(st.w / 2) + q[0]) / 2, (st.t.invertY(st.h / 2) + q[1]) / 2 ];
      const t1 = d3.zoomIdentity.translate(st.w / 2 - k1 * mid[0], st.h / 2 - k1 * mid[1]).scale(k1);
      zsel.interrupt().transition().duration(dur * 0.45).ease(d3.easeCubicInOut).call(zoom.transform, t1)
        .transition().duration(dur * 0.55).ease(d3.easeCubicInOut).call(zoom.transform, tt);
    } else if (dur > 0) zsel.interrupt().transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, tt);
    else zsel.call(zoom.transform, tt);
  }

  function select(s) {
    st.sel = s;
    requestDraw();
    if (opts.onSelect) opts.onSelect(s);
  }

  // --- 年のツマミ ---
  if (opts.bar !== false) {
    const range = $('.hm-slider input', root);
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
  }
  // --- 表示の設定（⚙） ---
  const setBox = $('.hm-set', root), gear = $('.gear', root);
  const ui = Object.assign({ views: true, eras: false }, store.get('mapUI', {}));
  const applyUI = () => {
    viewsBox.style.display = ui.views ? '' : 'none';
    const er = $('.hm-eras', root); if (er) er.style.display = ui.eras ? '' : 'none';
  };
  applyUI();
  gear.addEventListener('click', e => { e.stopPropagation(); setBox.hidden = !setBox.hidden; gear.setAttribute('aria-expanded', String(!setBox.hidden)); });
  $('.x', setBox).addEventListener('click', () => { setBox.hidden = true; gear.setAttribute('aria-expanded', 'false'); });
  setBox.addEventListener('click', e => e.stopPropagation());
  setBox.addEventListener('pointerdown', e => e.stopPropagation());
  $$('[data-l]', setBox).forEach(c => {
    const k = c.dataset.l; c.checked = !!st.layers[k];
    c.addEventListener('change', () => { st.layers[k] = c.checked; store.set('layers', st.layers); requestDraw(); if (k === 'terrain') { updateTerrain(); scheduleRelief(true); } });
  });
  $$('[data-u]', setBox).forEach(c => {
    const k = c.dataset.u; c.checked = !!ui[k];
    c.addEventListener('change', () => { ui[k] = c.checked; store.set('mapUI', ui); applyUI(); });
  });
  // 読み上げの声と速さ
  const vSel = $('.tts-voice', setBox), rIn = $('.tts-rate', setBox), rV = $('.tts-rv', setBox);
  const fillVoices = () => {
    const vs = SPEECH.voices();
    vSel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}">${esc(v.name.replace(/Microsoft |Google |\(Japanese\)|Japanese|- 日本語/g, '').trim())}${/Natural|Neural|Online/i.test(v.name) ? '（自然）' : ''}</option>`).join('') : '<option>日本語の声がありません</option>';
    const cur = SPEECH.voice(); if (cur) vSel.value = cur.name;
    vSel.disabled = !vs.length;
  };
  fillVoices();
  if (SPEECH.ok && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', fillVoices);
  vSel.addEventListener('change', () => SPEECH.setVoice(vSel.value));
  rIn.value = SPEECH.rate; rV.textContent = '×' + SPEECH.rate.toFixed(2);
  rIn.addEventListener('input', () => { SPEECH.setRate(+rIn.value); rV.textContent = '×' + (+rIn.value).toFixed(2); });
  $('.tts-test', setBox).addEventListener('click', () => SPEECH.speak(`${yearLabel(st.year)}。${eraName(st.year)}です。この地図では、年のツマミを動かすと、国や王朝のようすが変わります。`));
  if (!SPEECH.ok) $$('.tts-test, .tts-rate', setBox).forEach(x => { x.disabled = true; });
  // ふりがな
  const fck = $('.furi-ck', setBox); fck.checked = store.get('furigana', false);
  fck.addEventListener('change', () => { store.set('furigana', fck.checked); root.dispatchEvent(new CustomEvent('furigana')); });
  // 自分で登録する読み
  const myList = $('.my-list', setBox), mw = $('.my-w', setBox), mr = $('.my-r', setBox);
  const renderMy = () => {
    const m = store.get('myYomi', {});
    myList.innerHTML = Object.entries(m).map(([w, r]) => `<li><b>${esc(w)}</b> → ${esc(r)} <button type="button" data-w="${esc(w)}" aria-label="けす">✕</button></li>`).join('') || '<li class="muted">まだありません</li>';
    $$('button', myList).forEach(b => b.addEventListener('click', () => { const m2 = store.get('myYomi', {}); delete m2[b.dataset.w]; store.set('myYomi', m2); SPEECH.resetDict(); renderMy(); }));
  };
  $('.my-ok', setBox).addEventListener('click', () => {
    const w = mw.value.trim(), r = mr.value.trim().replace(/[ァ-ン]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    if (!w || !/^[ぁ-んー]+$/.test(r)) { mr.focus(); return; }
    const m = store.get('myYomi', {}); m[w] = r; store.set('myYomi', m); SPEECH.resetDict(); mw.value = ''; mr.value = ''; renderMy();
  });
  $('.my-play', setBox).addEventListener('click', () => SPEECH.speak(mw.value.trim() || Object.keys(store.get('myYomi', {})).slice(-1)[0] || '関中'));
  renderMy();

  st.speed = store.get('speed', 1);
  const markSpeed = () => $$('[data-sp]', setBox).forEach(b => b.classList.toggle('on', +b.dataset.sp === st.speed));
  $$('[data-sp]', setBox).forEach(b => b.addEventListener('click', () => { st.speed = +b.dataset.sp; store.set('speed', st.speed); markSpeed(); }));
  markSpeed();

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

  // 描きなおしの注文は、1コマにまとめて1回だけ描く（同じコマで何度たのまれても）
  let drawRaf = 0;
  function requestDraw() { if (!pr) return; if (!drawRaf) drawRaf = requestAnimationFrame(() => { drawRaf = 0; draw(); }); }
  function setYear(y) {
    y = fixYear(y);
    if (y === st.year && pr) return;
    st.year = y;
    // ツマミを速く動かしても、描くのは1コマに1回だけ（最後の年だけ描く）
    requestDraw();
    if (opts.onYear) opts.onYear(y);
  }
  function setView(v, keepZoom) {
    if (!GEO.VIEWS[v]) return;
    st.view = v;
    labelCache.clear();
    buildBase();
    if (!keepZoom) { st.t = d3.zoomIdentity; zsel.call(zoom.transform, d3.zoomIdentity); }
    requestDraw();
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

  return {
    root,
    get year() { return st.year; },
    get view() { return st.view; },
    get sel() { return st.sel; },
    setYear, setView, select, focusOn, stop, setStory, flyTo, autoSpan,
    caption: $('.hm-caption', root),
    polities: () => feats.map(f => f.properties.p),
    visiblePolities() {
      if (!pr) return [];
      return feats.map(f => { const c = labelPoint(f); if (!c) return null; const [x, y] = st.t.apply(c); return x > 0 && x < st.w && y > 0 && y < st.h ? f.properties.p : null; }).filter(Boolean);
    },
    people: () => shownPeople.filter(x => !x.ghost),
    events: () => shownEvents,
    destroy() { stop(); ro.disconnect(); window.removeEventListener('bigtext', onBig); document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('lateready', onLate); root.remove(); }
  };
}
