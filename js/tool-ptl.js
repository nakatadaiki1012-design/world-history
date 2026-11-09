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
    const wrap = el(`<div class="chrono ptl">
      <div class="chrono-main">
        <div class="ptl-head">
          <label class="ptl-sel">地域 <select class="ptl-reg"></select></label>
          <label class="ptl-sel">時代 <select class="ptl-era"></select></label>
          <span class="muted ptl-count"></span>
        </div>
        <div class="ptl-roles"></div>
        <div class="chrono-svgwrap ptl-body"></div>
      </div>
      <aside class="side"><div class="side-body"></div></aside>
    </div>`);
    main.appendChild(wrap);
    const regSel = $('.ptl-reg', wrap), eraSel = $('.ptl-era', wrap), rolesBar = $('.ptl-roles', wrap), sw = $('.ptl-body', wrap), body = $('.side-body', wrap), cnt = $('.ptl-count', wrap);
    let year = store.get('year', 750);
    let region = store.get('ptlRegion', 'east');
    let eraF = store.get('ptlEra', '');
    let roles = new Set(store.get('ptlRoles', ROLE_GROUPS.map(g => g.id)));
    let sel = null;

    // 地域・時代（セレクトで、スマホでも場所をとらない）
    const regs = [{ id: 'all', name: 'すべての地域' }, ...REGIONS.filter(r => PEOPLE.some(p => p.region === r.id))];
    regSel.innerHTML = regs.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    regSel.value = region;
    regSel.addEventListener('change', () => { region = regSel.value; store.set('ptlRegion', region); sel = null; draw(); side(); sw.scrollTop = 0; });
    const ERAS_P = ERA_BINS.map(b => ({ name: b[2], a: b[0], b: b[1] }));
    eraSel.innerHTML = '<option value="">すべての時代</option>' + ERAS_P.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
    eraSel.value = eraF;
    eraSel.addEventListener('change', () => { eraF = eraSel.value; store.set('ptlEra', eraF); draw(); sw.scrollTop = 0; });
    const markRegion = () => { regSel.value = region; };
    // 人物の種類（1行で横にスクロール）
    ROLE_GROUPS.forEach(g => {
      const b = el(`<button type="button" class="chip" aria-pressed="${roles.has(g.id)}"><span class="sw" style="background:${g.color}"></span>${esc(g.name)}</button>`);
      b.addEventListener('click', () => { roles.has(g.id) ? roles.delete(g.id) : roles.add(g.id); if (!roles.size) roles.add(g.id); b.setAttribute('aria-pressed', String(roles.has(g.id))); store.set('ptlRoles', [...roles]); draw(); });
      rolesBar.appendChild(b);
    });

    const people = () => PEOPLE.filter(p => (region === 'all' || p.region === region) && roles.has(roleGroup(p).id));
    // 人物がいちばん活躍したころ（30〜40歳ごろ）で、どの時代の段に入れるかを決める
    const prime = p => Math.min(p.died, p.born + Math.min(38, Math.round((p.died - p.born) * 0.6)));

    // 時代ごとに「段」を分け、段ごとに横軸をのばす（古い時代がつぶれないように）
    function draw() {
      const W = Math.max(320, sw.clientWidth - 2);
      sw.innerHTML = '';
      const ps = people();
      cnt.textContent = `${ps.length}人`;
      const S = W < 600 ? 0.9 : 1;
      ERAS_P.forEach(E => {
        if (eraF && eraF !== E.name) return;
        const list = ps.filter(p => { const y = prime(p); return y >= E.a && y < E.b; }).sort((a, b) => a.born - b.born);
        if (!list.length) return;
        const lo = Math.min(Math.max(E.a, -3000), d3.min(list, p => p.born)) - 10, hi = Math.max(Math.min(E.b, 2025), d3.max(list, p => p.died)) + 10;
        const x0 = Math.max(lo, d3.min(list, p => p.born) - 15), x1 = Math.min(hi, d3.max(list, p => p.died) + 15);
        const L = 10, R = 10;
        const xs = d3.scaleLinear().domain([x0, x1]).range([L, W - R]);
        const sec = el(`<section class="ptl-sec"><h3 class="ptl-era-h">${esc(E.name)}<small>${esc(yearLabel(Math.round(x0)))}〜${esc(yearLabel(Math.round(x1)))}・${list.length}人</small></h3></section>`);
        sw.appendChild(sec);
        const svg = d3.select(sec).append('svg').attr('width', W);
        const g = svg.append('g');
        let y0 = 18;
        // 目盛り
        const span = x1 - x0, step = [500, 200, 100, 50, 25, 10, 5].find(s => span / s >= 4 && span / s <= 12) || 10;
        const ax = g.append('g').attr('class', 'c-axis');
        for (let yy = Math.ceil(x0 / step) * step; yy <= x1; yy += step) {
          const v = yy === 0 ? 1 : yy, x = xs(v);
          ax.append('line').attr('x1', x).attr('x2', x).attr('y1', 14).attr('y2', 9999).attr('stroke-dasharray', '2 4');
          ax.append('text').attr('x', x).attr('y', 10).attr('text-anchor', 'middle').text(v < 0 ? '前' + (-v) : v);
        }
        // その地域・時代の主な国（細い帯・3段まで）
        const pols = POLITIES.filter(p => (region === 'all' ? (p.rank || 2) === 1 : p.region === region && (p.rank || 2) <= 2) && p.start < x1 && p.end > x0)
          .sort((a, b) => (a.rank || 2) - (b.rank || 2) || (b.end - b.start) - (a.end - a.start));
        const lanesP = [];
        pols.forEach(p => {
          const a = xs(Math.max(p.start, x0)), b = Math.max(xs(Math.min(p.end, x1)), a + 2);
          const tw = p.name.length * 10 + 6, e = Math.max(b, a + tw);
          let i = lanesP.findIndex(Lr => Lr.every(([u, v]) => e < u - 2 || a > v + 2));
          if (i < 0) { if (lanesP.length >= 3) return; i = lanesP.length; lanesP.push([]); }
          lanesP[i].push([a, e]);
          const yy = y0 + i * 14;
          const gg = g.append('g').attr('class', 'ptl-pol');
          gg.append('rect').attr('x', a).attr('y', yy).attr('width', b - a).attr('height', 12).attr('rx', 3).attr('fill', p.color).attr('opacity', 0.55).append('title').text(`${p.name}（${span2(p)}）`);
          if (b - a > tw) gg.append('text').attr('x', a + 3).attr('y', yy + 9.5).text(p.name).attr('fill', isLight(p.color) ? '#1f1d1a' : '#fff');
        });
        y0 += Math.max(1, lanesP.length) * 14 + 8;
        // 人物：名前（写真つき）を上に、一生の帯を下に。名前が帯からはみ出しても、同じ段に重ならないように
        const ROW = Math.round(34 * S);
        const lanes = [];
        list.forEach(p => {
          const a = xs(p.born), b = Math.max(xs(p.died), a + 3);
          const nameW = textWidth(p.name, 13 * S) + (PORTRAITS[p.id] ? 22 : 0) + 8;
          const e = Math.max(b, a + nameW) + 8;
          let i = lanes.findIndex(v => v < a);
          if (i < 0) { i = lanes.length; lanes.push(0); }
          lanes[i] = e; p._ln = i; p._a = a; p._b = b;
        });
        list.forEach(p => {
          const yy = y0 + p._ln * ROW, grp = roleGroup(p), c = grp.color, isSel = sel === p.id;
          const gg = g.append('g').attr('class', 'ptl-p' + (isSel ? ' sel' : '')).style('cursor', 'pointer');
          gg.append('rect').attr('class', 'hit').attr('x', p._a - 2).attr('y', yy).attr('width', Math.max(p._b - p._a, textWidth(p.name, 13 * S) + 30) + 4).attr('height', ROW - 2).attr('fill', 'transparent');
          gg.append('rect').attr('class', 'life').attr('x', p._a).attr('y', yy + ROW - 11).attr('width', p._b - p._a).attr('height', 6).attr('rx', 3).attr('fill', c);
          let tx = p._a;
          if (PORTRAITS[p.id]) {
            const cid = 'pc-' + p.id.replace(/[^a-z0-9]/gi, '');
            gg.append('clipPath').attr('id', cid).append('circle').attr('cx', tx + 9).attr('cy', yy + 10).attr('r', 9);
            gg.append('image').attr('href', PORTRAITS[p.id].src).attr('x', tx).attr('y', yy + 1).attr('width', 18).attr('height', 18).attr('preserveAspectRatio', 'xMidYMin slice').attr('clip-path', `url(#${cid})`);
            gg.append('circle').attr('cx', tx + 9).attr('cy', yy + 10).attr('r', 9).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.4);
            tx += 22;
          }
          gg.append('text').attr('class', 'ptl-name').attr('x', tx).attr('y', yy + 14).attr('font-size', 13 * S).text(p.name);
          gg.append('title').text(`${p.name}（${lifeSpan(p)}）${p.role || ''}`);
          gg.on('click', ev => { ev.stopPropagation(); sel = p.id; year = Math.round((p.born + p.died) / 2); store.set('year', year); draw(); side(); if (window.innerWidth < 900) body.closest('.side').scrollIntoView({ behavior: 'smooth' }); });
        });
        const H = y0 + lanes.length * ROW + 8;
        svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
        ax.selectAll('line').attr('y2', H);
        // 今の年
        if (year >= x0 && year <= x1) {
          svg.append('line').attr('class', 'c-cursor').attr('x1', xs(year)).attr('x2', xs(year)).attr('y1', 14).attr('y2', H);
          svg.append('text').attr('x', xs(year) + 4).attr('y', 24).attr('font-size', 11).attr('font-weight', 800).attr('fill', 'var(--accent)').text(yearLabel(year));
        }
        svg.on('click', ev => { const [x] = d3.pointer(ev); year = fixYear(Math.round(xs.invert(x))); store.set('year', year); sel = null; draw(); side(); });
      });
      if (!sw.children.length) sw.appendChild(el('<p class="empty">この条件の人物はいません。</p>'));
    }
    const span2 = p => span(p.start, p.end);
    const mctx = document.createElement('canvas').getContext('2d');
    function textWidth(t, px) { mctx.font = `700 ${px}px ${getComputedStyle(document.body).fontFamily}`; return mctx.measureText(t).width; }

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
          ${personFunHtml(p.id)}
          ${p.keys ? `<div class="keys">${p.keys.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        </div>`));
        if (hasProfile(p.id)) body.appendChild(profileBtn(p.id));
        body.appendChild(el(`<a class="btn${hasProfile(p.id) ? '' : ' primary'}" style="display:inline-block;text-decoration:none;margin:6px 0" href="${mapHash(fixYear(Math.round((p.born + p.died) / 2)), REGION_VIEW[p.region] || 'world', 'p:' + p.id)}">🗺 地図で足あとを見る</a>`));
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
        <div class="muted" style="font-size:13px">${ps.length}人。時代ごとに段を分けて、一生の長さを帯で示しています。名前をおすと説明、年表の空いた所をおすと、その年に生きていた人が出ます。</div></div>`));
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

    requestAnimationFrame(() => { draw(); side(); });
    const ro = new ResizeObserver(() => draw());
    ro.observe(sw);
    return () => ro.disconnect();
  }
});
