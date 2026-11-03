/* 人物年表：地域をえらぶと、その地域の人物の一生を帯で並べる（音楽史年表の作曲家の帯と同じ考え方）。
   上には、その地域の主な国・王朝の帯。たての赤い線が「今の年」。帯をおすと右に説明と足あと。 */
const ROLE_GROUPS = [
  { id: 'travel', name: '旅・探検', color: '#148f77', re: /航海|旅行|探検|商人/ },
  { id: 'culture', name: '学問・文化', color: '#b9770e', re: /学者|科学|詩人|作家|芸術|歴史家|技術|天文|経済学|人文|看護/ },
  { id: 'thought', name: '思想・宗教', color: '#7d3c98', re: /思想|哲学|宗教|神学|教皇|僧|宣教|預言|修道|聖職|牧師/ },
  { id: 'military', name: '軍事', color: '#c0392b', re: /軍人|征服/ },
  { id: 'ruler', name: '君主', color: '#1f4e79', re: /皇帝|王|君主|カリフ|スルタン|女帝|天皇|皇太后|ハン/ },
  { id: 'politics', name: '政治・革命', color: '#2c8350', re: /./ }
];
const roleGroup = p => ROLE_GROUPS.find(g => g.re.test(p.role || '')) || ROLE_GROUPS[ROLE_GROUPS.length - 1];

registerTool('ptl', {
  name: '人物年表',
  render(main) {
    const wrap = el(`<div class="chrono">
      <div class="chrono-main">
        <div class="chrono-head"></div>
        <div class="chrono-head ptl-roles"></div>
        <div class="chrono-svgwrap"><svg></svg></div>
      </div>
      <aside class="side"><div class="side-body"></div></aside>
    </div>`);
    main.appendChild(wrap);
    const head = $('.chrono-head', wrap), rolesBar = $('.ptl-roles', wrap), sw = $('.chrono-svgwrap', wrap), body = $('.side-body', wrap);
    const svg = d3.select($('svg', wrap));
    let year = store.get('year', 750);
    let region = store.get('ptlRegion', 'east');
    let roles = new Set(store.get('ptlRoles', ROLE_GROUPS.map(g => g.id)));
    let sel = null;
    let t = d3.zoomIdentity;

    // 地域（1つえらぶ。「すべて」もある）
    const regs = [{ id: 'all', name: 'すべての地域', color: '#555' }, ...REGIONS.filter(r => PEOPLE.some(p => p.region === r.id))];
    regs.forEach(r => {
      const b = el(`<button type="button" class="chip" data-r="${r.id}"><span class="sw" style="background:${r.color}"></span>${esc(r.name)}</button>`);
      b.addEventListener('click', () => { region = r.id; store.set('ptlRegion', region); sel = null; markRegion(); fit(); side(); });
      head.appendChild(b);
    });
    const markRegion = () => $$('[data-r]', head).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === region)));
    markRegion();
    const zin = el('<button type="button" class="chip" style="margin-left:auto">＋ 拡大</button>'), zout = el('<button type="button" class="chip">－ 縮小</button>'), zfit = el('<button type="button" class="chip">⟷ 全体</button>');
    head.appendChild(zin); head.appendChild(zout); head.appendChild(zfit);
    // 人物の種類
    ROLE_GROUPS.forEach(g => {
      const b = el(`<button type="button" class="chip" aria-pressed="${roles.has(g.id)}"><span class="sw" style="background:${g.color}"></span>${esc(g.name)}</button>`);
      b.addEventListener('click', () => { roles.has(g.id) ? roles.delete(g.id) : roles.add(g.id); if (!roles.size) roles.add(g.id); b.setAttribute('aria-pressed', String(roles.has(g.id))); store.set('ptlRoles', [...roles]); draw(); });
      rolesBar.appendChild(b);
    });

    const LEFT = 8, ROW = 26, TOP = 22;
    let W = 800;
    const zoom = d3.zoom().scaleExtent([1, 60])
      .filter(ev => (ev.type !== 'wheel' || ev.ctrlKey || ev.shiftKey) && !ev.button)
      .on('zoom', ev => { t = ev.transform; draw(); });
    svg.call(zoom).on('dblclick.zoom', null);
    zin.addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1.8, [xOf(year), 10]));
    zout.addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.8, [xOf(year), 10]));
    zfit.addEventListener('click', fit);

    const base = y => LEFT + yearToPos(y) / 100 * (W - LEFT - 12);
    const xOf = y => t.applyX(base(y));
    const yearOfX = x => posToYear((t.invertX(x) - LEFT) / (W - LEFT - 12) * 100);
    const people = () => PEOPLE.filter(p => (region === 'all' || p.region === region) && roles.has(roleGroup(p).id));

    // えらんだ地域の人物がちょうど入るように拡大
    function fit() {
      W = Math.max(500, sw.clientWidth);
      const ps = PEOPLE.filter(p => region === 'all' || p.region === region);
      if (!ps.length) { t = d3.zoomIdentity; svg.call(zoom.transform, t); return; }
      const a = base(d3.min(ps, p => p.born) - 20), b = base(d3.max(ps, p => p.died) + 20);
      const k = clamp((W - 30) / Math.max(1, b - a), 1, 60);
      t = d3.zoomIdentity.translate(15 - a * k, 0).scale(k);
      svg.call(zoom.transform, t);
    }

    function draw() {
      W = Math.max(500, sw.clientWidth);
      zoom.extent([[0, 0], [W, 100]]).translateExtent([[0, 0], [W, 100]]);
      svg.selectAll('*').remove();
      const g = svg.append('g');
      let y0 = TOP + 6;
      // その地域の主な国・王朝（上の細い帯）
      const pols = POLITIES.filter(p => (region === 'all' ? (p.rank || 2) === 1 : p.region === region && ((p.rank || 2) === 1 || ((p.rank || 2) === 2 && p.end - p.start >= 150)))).sort((a, b) => (a.rank || 2) - (b.rank || 2) || (b.end - b.start) - (a.end - a.start));
      const lanesP = [], MAXL = 5;   // 帯は5段まで（大きい国・長く続いた国から）
      pols.forEach(p => {
        const x0 = xOf(p.start), x1 = Math.max(xOf(Math.min(p.end, YEAR_MAX)), x0 + 2);
        if (x1 < 0 || x0 > W) return;
        const xe = Math.max(x1, x0 + p.name.length * 10 + 4);
        let i = lanesP.findIndex(L => L.every(([a, b]) => xe < a - 2 || x0 > b + 2));
        if (i < 0) { if (lanesP.length >= MAXL) return; i = lanesP.length; lanesP.push([]); }
        lanesP[i].push([x0, xe]);
        const yy = y0 + i * 15;
        const gg = g.append('g').attr('class', 'ptl-pol');
        gg.append('rect').attr('x', Math.max(x0, -5)).attr('y', yy).attr('width', Math.max(2, x1 - Math.max(x0, -5))).attr('height', 13).attr('rx', 3).attr('fill', p.color).attr('opacity', 0.75)
          .append('title').text(`${p.name}（${span(p.start, p.end)}）`);
        if (x1 - Math.max(x0, 0) > p.name.length * 10 + 4) gg.append('text').attr('x', Math.max(x0, 0) + 3).attr('y', yy + 10.5).text(p.name).attr('fill', isLight(p.color) ? '#1f1d1a' : '#fff');
      });
      y0 += Math.max(1, lanesP.length) * 15 + 10;
      g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y0 - 5).attr('y2', y0 - 5).attr('stroke', 'var(--line)');

      // 人物の帯（生まれた順。名前が入らないときは帯の右に）
      const ps = people().slice().sort((a, b) => a.born - b.born);
      const lanes = [];
      ps.forEach(p => {
        const x0 = xOf(p.born), x1 = Math.max(xOf(p.died), x0 + 3);
        const ph = !!PORTRAITS[p.id];
        const nameW = p.name.length * 12.5 + (ph ? 24 : 6);
        const inside = x1 - x0 > nameW + 6;
        const end = inside ? x1 : x1 + nameW + 4;
        let i = lanes.findIndex(e => e < x0 - 4); if (i < 0) { i = lanes.length; lanes.push(-1e9); }
        lanes[i] = end; p._lane = i; p._x0 = x0; p._x1 = x1; p._in = inside;
      });
      ps.forEach(p => {
        if (p._x1 < -200 || p._x0 > W + 10) return;
        const yy = y0 + p._lane * ROW, grp = roleGroup(p), c = grp.color;
        const gg = g.append('g').attr('class', 'ptl-p' + (sel === p.id ? ' sel' : '')).style('cursor', 'pointer');
        gg.append('rect').attr('x', p._x0).attr('y', yy + 3).attr('width', p._x1 - p._x0).attr('height', ROW - 6).attr('rx', 10).attr('fill', c).attr('fill-opacity', 0.22).attr('stroke', c).attr('stroke-width', sel === p.id ? 2.4 : 1);
        let tx = (p._in ? p._x0 : p._x1) + 6;
        if (PORTRAITS[p.id]) {
          const cid = 'pc' + p.id.replace(/[^a-z0-9]/gi, '');
          gg.append('clipPath').attr('id', cid).append('circle').attr('cx', tx + 9).attr('cy', yy + ROW / 2).attr('r', 9);
          gg.append('image').attr('href', PORTRAITS[p.id].src).attr('x', tx).attr('y', yy + ROW / 2 - 9).attr('width', 18).attr('height', 18).attr('preserveAspectRatio', 'xMidYMin slice').attr('clip-path', `url(#${cid})`);
          gg.append('circle').attr('cx', tx + 9).attr('cy', yy + ROW / 2).attr('r', 9).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.2);
          tx += 22;
        }
        gg.append('text').attr('x', tx).attr('y', yy + ROW / 2 + 4.5).attr('class', 'ptl-name').text(p.name);
        gg.append('title').text(`${p.name}（${lifeSpan(p)}）${p.role || ''}`);
        gg.on('click', ev => { ev.stopPropagation(); sel = p.id; if (year < p.born || year > p.died) year = Math.round((p.born + p.died) / 2); store.set('year', year); draw(); side(); });
      });
      const H = Math.max(y0 + lanes.length * ROW + 20, sw.clientHeight);
      svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
      // 目盛り
      const ax = svg.append('g').attr('class', 'c-axis');
      const steps = [1000, 500, 200, 100, 50, 20, 10, 5];
      const span0 = Math.abs(yearOfX(W) - yearOfX(0)) || 1;
      const step = steps.find(s => span0 / s >= 5) || 5;
      const s0 = Math.ceil(yearOfX(0) / step) * step;
      for (let y = s0; y <= yearOfX(W); y += step) {
        const yy = y === 0 ? 1 : y, x = xOf(yy); if (x < 0 || x > W) continue;
        ax.append('line').attr('x1', x).attr('x2', x).attr('y1', 16).attr('y2', H).attr('stroke-dasharray', '2 4');
        ax.append('text').attr('x', x).attr('y', 12).attr('text-anchor', 'middle').text(yy < 0 ? '前' + (-yy) : yy);
      }
      ax.lower();
      const cx = xOf(year);
      svg.append('line').attr('class', 'c-cursor').attr('x1', cx).attr('x2', cx).attr('y1', 16).attr('y2', H);
      svg.append('text').attr('x', cx + 4).attr('y', 26).attr('font-size', 12).attr('font-weight', 800).attr('fill', 'var(--accent)').text(yearLabel(year));
      if (!ps.length) svg.append('text').attr('x', 20).attr('y', y0 + 30).attr('fill', 'var(--muted)').text('この地域・種類の人物は、まだデータにありません。');
    }
    svg.on('click', ev => {
      const [x] = d3.pointer(ev);
      year = fixYear(yearOfX(x)); store.set('year', year); sel = null; draw(); side();
    });

    function side() {
      body.innerHTML = '';
      const p = sel && PERSON[sel];
      if (p) {
        const reg = REGION[p.region], grp = roleGroup(p);
        body.appendChild(el(`<div>
          ${portraitImg(p, 'bigimg')}
          <div class="muted" style="font-size:13px"><span class="sw" style="background:${grp.color}"></span> ${esc(grp.name)}・${esc(reg ? reg.name : '')}</div>
          <h2>${esc(p.name)}</h2>
          <div class="num" style="font-weight:700">${esc(lifeSpan(p))}（${esc(p.role || '')}）</div>
          <p>${esc(p.text || '')}</p>
          ${p.keys ? `<div class="keys">${p.keys.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        </div>`));
        body.appendChild(el(`<a class="btn primary" style="display:inline-block;text-decoration:none;margin:6px 0" href="${mapHash(fixYear(Math.round((p.born + p.died) / 2)), REGION_VIEW[p.region] || 'world', 'p:' + p.id)}">🗺 地図で足あとを見る</a>`));
        body.appendChild(el('<h3>一生の足あと</h3>'));
        const ol = el('<ol class="places"></ol>');
        (p.places || []).forEach(pl => ol.appendChild(el(`<li><b>${esc(yearLabel(pl.from))}〜</b>${esc(pl.name)}${pl.note ? `<div class="muted" style="font-size:12.5px">${esc(pl.note)}</div>` : ''}</li>`)));
        body.appendChild(ol);
        // 同じころの人物（ほかの地域も）
        const same = PEOPLE.filter(q => q !== p && q.born < p.died && q.died > p.born).sort((a, b) => Math.abs(a.born - p.born) - Math.abs(b.born - p.born)).slice(0, 10);
        if (same.length) {
          body.appendChild(el('<h3>同じ時代を生きた人物</h3>'));
          const ul = el('<ul class="lst"></ul>');
          same.forEach(q => {
            const li = el(`<li><button type="button">${portraitImg(q)}<span><b>${esc(q.name)}</b> <span class="muted" style="font-size:12.5px">${esc((REGION[q.region] || {}).name || '')}・${esc(q.role || '')}</span></span><span class="yrs">${esc(lifeSpan(q))}</span></button></li>`);
            li.firstChild.addEventListener('click', () => { if (region !== 'all' && q.region !== region) { region = q.region; store.set('ptlRegion', region); markRegion(); } sel = q.id; draw(); side(); });
            ul.appendChild(li);
          });
          body.appendChild(ul);
        }
        return;
      }
      const ps = people();
      const alive = ps.filter(q => year >= q.born && year <= q.died);
      body.appendChild(el(`<div><h2>${esc(region === 'all' ? 'すべての地域' : (REGION[region] || {}).name || '')}の人物</h2>
        <div class="muted" style="font-size:13px">${ps.length}人。帯をおすと説明。年表の上をおすと、その年に生きていた人が下に出ます。ドラッグで左右に動かし、＋で拡大（Ctrl やシフトを押しながらホイールでも）。</div></div>`));
      body.appendChild(el(`<h3>${esc(yearLabel(year))}に生きていた人物（${alive.length}人）</h3>`));
      const ul = el('<ul class="lst"></ul>');
      alive.forEach(q => {
        const li = el(`<li><button type="button">${portraitImg(q)}<span><b>${esc(q.name)}</b> <span class="muted" style="font-size:12.5px">${esc(q.role || '')}</span></span><span class="yrs">${esc(lifeSpan(q))}</span></button></li>`);
        li.firstChild.addEventListener('click', () => { sel = q.id; draw(); side(); });
        ul.appendChild(li);
      });
      if (!alive.length) ul.appendChild(el('<li class="empty">この年に生きていた人物はいません。</li>'));
      body.appendChild(ul);
    }

    requestAnimationFrame(() => { fit(); side(); });
    const ro = new ResizeObserver(() => draw());
    ro.observe(sw);
    return () => ro.disconnect();
  }
});
