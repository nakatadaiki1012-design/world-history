/* 年表：地域ごとに、国・王朝の続いた期間を帯で並べる（音楽史年表と同じ考え方）。
   たての赤い線が「今えらんでいる年」。帯をおすと説明、「地図で見る」で地図へ。 */
const REGION_VIEW = { east: 'eastasia', inner: 'inner', south: 'southasia', sea: 'seasia', west: 'westasia', europe: 'europe', africa: 'africa', america: 'america', oceania: 'world' };

registerTool('chrono', {
  name: '年表',
  render(main) {
    const wrap = el(`<div class="chrono">
      <div class="chrono-main">
        <div class="chrono-head"></div>
        <div class="chrono-svgwrap"><svg></svg></div>
      </div>
      <aside class="side"><div class="side-body"></div></aside>
    </div>`);
    main.appendChild(wrap);
    const head = $('.chrono-head', wrap), sw = $('.chrono-svgwrap', wrap), body = $('.side-body', wrap);
    const svg = d3.select($('svg', wrap));
    let year = store.get('year', 750);
    let regions = new Set(store.get('chronoRegions', REGIONS.map(r => r.id)));
    let showPeople = store.get('chronoPeople', false);
    let sel = null;
    let t = d3.zoomIdentity;

    REGIONS.forEach(r => {
      const b = el(`<button type="button" class="chip" aria-pressed="${regions.has(r.id)}"><span class="sw" style="background:${r.color}"></span>${esc(r.name)}</button>`);
      b.addEventListener('click', () => { regions.has(r.id) ? regions.delete(r.id) : regions.add(r.id); b.setAttribute('aria-pressed', String(regions.has(r.id))); store.set('chronoRegions', [...regions]); draw(); });
      head.appendChild(b);
    });
    const pb = el(`<button type="button" class="chip" aria-pressed="${showPeople}">● 人物の一生</button>`);
    pb.addEventListener('click', () => { showPeople = !showPeople; pb.setAttribute('aria-pressed', String(showPeople)); store.set('chronoPeople', showPeople); draw(); });
    head.appendChild(pb);
    const zin = el('<button type="button" class="chip" style="margin-left:auto">＋ 拡大</button>'), zout = el('<button type="button" class="chip">－ 縮小</button>');
    head.appendChild(zin); head.appendChild(zout);

    const LEFT = 92, LANE = 22, GAP = 3;
    let W = 800;
    const zoom = d3.zoom().scaleExtent([1, 40])
      .filter(ev => (ev.type !== 'wheel' || ev.ctrlKey || ev.shiftKey) && !ev.button)
      .on('zoom', ev => { t = ev.transform; draw(true); });
    svg.call(zoom).on('dblclick.zoom', null);
    zin.addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1.8, [xOf(year), 10]));
    zout.addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.8, [xOf(year), 10]));

    function xOf(y) { return t.applyX(LEFT + yearToPos(y) / 100 * (W - LEFT - 12)); }
    function yearOfX(x) { return posToYear((t.invertX(x) - LEFT) / (W - LEFT - 12) * 100); }

    function lanes(items) {
      const ends = [];
      items.forEach(it => {
        let i = ends.findIndex(e => e < it.a - 1);
        if (i < 0) { i = ends.length; ends.push(0); }
        ends[i] = it.b; it.lane = i;
      });
      return ends.length;
    }

    function draw() {
      W = Math.max(300, sw.clientWidth);
      zoom.extent([[LEFT, 0], [W, 100]]).translateExtent([[LEFT, 0], [W, 100]]);
      svg.selectAll('*').remove();
      let y0 = 30;
      const g = svg.append('g');
      const pad = 3;
      REGIONS.filter(r => regions.has(r.id)).forEach(r => {
        const items = POLITIES.filter(p => p.region === r.id)
          .sort((a, b) => a.start - b.start || (a.rank || 2) - (b.rank || 2))
          .map(p => ({ p, a: p.start, b: Math.min(p.end, YEAR_MAX) }));
        // 画面上の長さで重なりを判定（名前が入るように）
        items.forEach(it => { it.x0 = xOf(it.a); it.x1 = Math.max(xOf(it.b), it.x0 + 4); });
        const ends = [];
        items.forEach(it => {
          const need = it.x0;
          let i = ends.findIndex(e => e + pad < need);
          if (i < 0) { i = ends.length; ends.push(-1e9); }
          const txtEnd = it.x0 + Math.max(it.x1 - it.x0, Math.min(it.p.name.length * 12 + 8, 120));
          ends[i] = Math.max(it.x1, it.x1 - it.x0 < it.p.name.length * 12 + 8 ? txtEnd : it.x1); it.lane = i;
        });
        const n = Math.max(1, ends.length);
        g.append('text').attr('class', 'c-reg').attr('x', 6).attr('y', y0 + 14).text(r.name);
        g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y0 - 4).attr('y2', y0 - 4).attr('stroke', 'var(--line)');
        items.forEach(it => {
          if (it.x1 < LEFT || it.x0 > W + 10) return;   // 画面の左（ラベルの列）に入るものは出さない
          const p = it.p, y = y0 + it.lane * (LANE + GAP);
          const bg = g.append('g').attr('class', 'cb' + (isLight(p.color) ? ' light' : '') + (sel === p.id ? ' sel' : '')).style('cursor', 'pointer');
          bg.append('rect').attr('x', Math.max(it.x0, LEFT - 4)).attr('y', y).attr('width', Math.max(3, it.x1 - Math.max(it.x0, LEFT - 4))).attr('height', LANE).attr('fill', p.color).attr('rx', 4)
            .append('title').text(`${p.name}（${span(p.start, p.end)}）`);
          const tx = Math.max(it.x0, LEFT) + 4;
          const fits = it.x1 - tx > p.name.length * 11.5;
          bg.append('text').attr('x', fits ? tx : it.x1 + 3).attr('y', y + 15).text(p.name).style('fill', fits ? null : 'var(--ink)');
          bg.on('click', ev => { ev.stopPropagation(); sel = p.id; if (year < p.start || year > p.end) year = clamp(year, p.start, Math.min(p.end, YEAR_MAX)); store.set('year', year); draw(); side(); });
        });
        y0 += n * (LANE + GAP) + 14;
      });
      if (showPeople) {
        const items = PEOPLE.filter(p => regions.has(p.region)).map(p => ({ p, x0: xOf(p.born), x1: Math.max(xOf(p.died), xOf(p.born) + 3) }));
        const ends = [];
        items.forEach(it => { let i = ends.findIndex(e => e + 4 < it.x0); if (i < 0) { i = ends.length; ends.push(-1e9); } ends[i] = Math.max(it.x1, it.x0 + it.p.name.length * 11 + 6); it.lane = i; });
        g.append('text').attr('class', 'c-reg').attr('x', 6).attr('y', y0 + 14).text('人物');
        g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y0 - 4).attr('y2', y0 - 4).attr('stroke', 'var(--line)');
        items.forEach(it => {
          if (it.x1 < LEFT || it.x0 > W + 10) return;   // 画面の左（ラベルの列）に入るものは出さない
          const p = it.p, y = y0 + it.lane * 18, c = (REGION[p.region] || {}).color || '#555';
          const gg = g.append('g').style('cursor', 'pointer');
          gg.append('rect').attr('x', Math.max(it.x0, LEFT - 4)).attr('y', y + 10).attr('width', Math.max(3, it.x1 - Math.max(it.x0, LEFT - 4))).attr('height', 5).attr('fill', c).attr('rx', 2);
          gg.append('text').attr('x', Math.max(it.x0, LEFT)).attr('y', y + 8).attr('font-size', 11).attr('fill', 'var(--ink)').text(p.name);
          gg.on('click', ev => { ev.stopPropagation(); location.hash = mapHash(clamp(year, p.born, p.died), REGION_VIEW[p.region], 'p:' + p.id); });
        });
        y0 += ends.length * 18 + 14;
      }
      const H = Math.max(y0 + 10, sw.clientHeight);
      svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
      // 目盛り
      const ax = svg.append('g').attr('class', 'c-axis');
      const cands = [];
      for (let y = -3000; y <= 2000; y += 10) cands.push(y === 0 ? 1 : y);
      const steps = [1000, 500, 200, 100, 50, 20, 10];
      let lastX = -1e9;
      const ok = y => { const s = steps.find(s => (y === 1 ? 0 : y) % s === 0); return s; };
      cands.filter(y => ok(y)).sort((a, b) => (steps.indexOf(ok(a)) - steps.indexOf(ok(b))) || a - b).forEach(y => {
        const x = xOf(y); if (x < LEFT || x > W - 10) return;
        if (ax.selectAll('line').nodes().some(n => Math.abs(+n.getAttribute('x1') - x) < 48)) return;
        ax.append('line').attr('x1', x).attr('x2', x).attr('y1', 16).attr('y2', H).attr('stroke-dasharray', '2 4');
        ax.append('text').attr('x', x).attr('y', 12).attr('text-anchor', 'middle').text(y < 0 ? '前' + (-y) : y);
        lastX = x;
      });
      ax.lower();
      svg.append('rect').attr('x', 0).attr('y', 0).attr('width', LEFT - 6).attr('height', H).attr('fill', 'var(--panel)').lower();
      // 今の年
      const cx = xOf(year);
      if (cx >= LEFT) {
        svg.append('line').attr('class', 'c-cursor').attr('x1', cx).attr('x2', cx).attr('y1', 16).attr('y2', H);
        svg.append('text').attr('x', cx + 4).attr('y', 26).attr('font-size', 12).attr('font-weight', 800).attr('fill', 'var(--accent)').text(yearLabel(year));
      }
      // 名前の欄を前に
      svg.selectAll('.c-reg').raise();
    }
    svg.on('click', ev => {
      const [x] = d3.pointer(ev);
      if (x < LEFT) return;
      year = fixYear(yearOfX(x)); store.set('year', year); sel = null; draw(); side();
    });

    function side() {
      body.innerHTML = '';
      const p = sel && POLITY[sel];
      if (p) {
        body.appendChild(el(`<div>
          <div class="muted" style="font-size:13px"><span class="sw" style="background:${esc(p.color)}"></span> ${esc((REGION[p.region] || {}).name || '')}</div>
          <h2>${esc(p.full || p.name)}</h2>
          <div class="num" style="font-weight:700">${esc(span(p.start, p.end))}</div>
          <p>${esc(p.text || '')}</p>
          ${p.keys ? `<div class="keys">${p.keys.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        </div>`));
        const b = el(`<a class="btn primary" style="display:inline-block;text-decoration:none;margin-top:8px" href="${mapHash(clamp(year, p.start, Math.min(p.end, YEAR_MAX)), REGION_VIEW[p.region], 's:' + p.id)}">🗺 地図で見る（${esc(yearLabel(clamp(year, p.start, Math.min(p.end, YEAR_MAX))))}）</a>`);
        body.appendChild(b);
        const same = POLITIES.filter(q => q !== p && q.start <= p.end && q.end >= p.start && q.region === p.region && (q.rank || 2) <= 2).slice(0, 12);
        if (same.length) {
          body.appendChild(el('<h3>同じ地域で同じころの国</h3>'));
          const ul = el('<ul class="lst"></ul>');
          same.forEach(q => { const li = el(`<li><button type="button"><span class="sw" style="background:${esc(q.color)}"></span>${esc(q.name)}<span class="yrs">${esc(span(q.start, q.end))}</span></button></li>`); li.firstChild.addEventListener('click', () => { sel = q.id; draw(); side(); }); ul.appendChild(li); });
          body.appendChild(ul);
        }
        return;
      }
      body.appendChild(el(`<div><h2>${esc(yearLabel(year))}</h2><div class="muted">${esc(eraName(year))}</div>
        <p class="muted" style="font-size:13px">年表の上をおすと、その年の国・王朝が一覧になります。帯をおすと説明。ドラッグで左右に動かし、＋で拡大（Ctrl やシフトを押しながらホイールでも）。</p></div>`));
      const a = el(`<a class="btn primary" style="display:inline-block;text-decoration:none" href="${mapHash(year, store.get('view', 'world'))}">🗺 この年の地図を見る</a>`);
      body.appendChild(a);
      REGIONS.forEach(r => {
        const ps = POLITIES.filter(p => p.region === r.id && year >= p.start && year <= p.end && (p.rank || 2) <= 2);
        if (!ps.length) return;
        body.appendChild(el(`<h3>${esc(r.name)}</h3>`));
        const ul = el('<ul class="lst"></ul>');
        ps.forEach(q => { const li = el(`<li><button type="button"><span class="sw" style="background:${esc(q.color)}"></span>${esc(q.name)}<span class="yrs">${esc(span(q.start, q.end))}</span></button></li>`); li.firstChild.addEventListener('click', () => { sel = q.id; draw(); side(); }); ul.appendChild(li); });
        body.appendChild(ul);
      });
    }

    // はじめは今の年のあたりを少し拡大して見せる
    requestAnimationFrame(() => {
      W = Math.max(300, sw.clientWidth);
      const k = 3, x = LEFT + yearToPos(year) / 100 * (W - LEFT - 12);
      t = d3.zoomIdentity.translate((LEFT + W) / 2 - x * k, 0).scale(k);
      svg.call(zoom.transform, t);
      side();
    });
    const ro = new ResizeObserver(() => draw());
    ro.observe(sw);
    return () => ro.disconnect();
  }
});
