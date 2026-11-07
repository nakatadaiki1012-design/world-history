/* 人口と経済：国ごとの人口・GDP（経済規模）・1人あたりGDP の移り変わり（Maddison Project Database 2020）
   地図（円の大きさ・色）＋折れ線グラフ＋その年の順位。年のツマミを動かすと全部が変わる。 */
const ECON_IND = [
  { id: 'pop', name: '人口', unit: '人', fmt: v => fmtPop(v) },
  { id: 'gdp', name: 'GDP（経済規模）', unit: 'ドル', fmt: v => fmtMoney(v) },
  { id: 'pc', name: '1人あたりGDP', unit: 'ドル', fmt: v => Math.round(v).toLocaleString() + 'ドル' },
  { id: 'share', name: '世界に占める割合', unit: '%', fmt: v => v.toFixed(1) + '%' }
];
function fmtPop(k) { // k = 千人
  if (k >= 1e5) return (k / 1e5).toFixed(k >= 1e6 ? 1 : 2).replace(/\.0+$/, '') + '億人';
  if (k >= 10) return Math.round(k / 10).toLocaleString() + '万人';
  return Math.round(k * 1000).toLocaleString() + '人';
}
function fmtMoney(m) { // m = 百万ドル
  if (m >= 1e6) return (m / 1e6).toFixed(1) + '兆ドル';
  if (m >= 100) return Math.round(m / 100).toLocaleString() + '億ドル';
  return Math.round(m).toLocaleString() + '百万ドル';
}

registerTool('econ', {
  name: '人口と経済',
  render(main) {
    const E = window.ECON;
    if (!E) { main.appendChild(el('<p class="empty">人口と経済のデータがありません。</p>')); return; }
    const wrap = el(`<div class="econ">
      <div class="econ-main card">
        <div class="econ-head"></div>
        <div class="econ-map"><svg></svg><div class="econ-year"></div><div class="hm-tip" hidden></div></div>
        <div class="econ-bar">
          <button type="button" class="hm-play" aria-label="再生">▶</button>
          <input type="range" min="0" max="1000" aria-label="年">
          <span class="yr num"></span>
        </div>
        <div class="econ-chart"><svg></svg></div>
      </div>
      <aside class="side"><div class="side-body"></div></aside>
    </div>`);
    main.appendChild(wrap);
    const head = $('.econ-head', wrap), mapBox = $('.econ-map', wrap), chartBox = $('.econ-chart', wrap), body = $('.side-body', wrap), tip = $('.hm-tip', wrap);
    let ind = store.get('econInd', 'gdp');
    let year = clamp(store.get('econYear', 1820), 1, 2018);
    let log = store.get('econLog', true);
    let picked = store.get('econPicked', ['China', 'India', 'United Kingdom', 'United States', 'Japan', 'Russia']);
    const C = Object.fromEntries(E.countries.map(c => [c.en, c]));
    const G = Object.fromEntries(E.groups.map(g => [g.en, g]));
    picked = picked.filter(n => C[n]);
    // 解体した国（ソ連・チェコスロヴァキア・ユーゴスラヴィア）は、解体までは全体で、そのあとは後継の国で数える（二重に数えない）
    const UNIONS = [
      { en: 'Former USSR', end: 1991, iso: '643', parts: ['Russia', 'Ukraine', 'Belarus', 'Moldova', 'Estonia', 'Latvia', 'Lithuania', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'] },
      { en: 'Czechoslovakia', end: 1992, iso: '203', parts: ['Czechia', 'Slovakia'] },
      { en: 'Former Yugoslavia', end: 1991, iso: '688', parts: ['Slovenia', 'Croatia', 'Bosnia and Herzegovina', 'Serbia', 'Montenegro', 'North Macedonia'] }
    ];
    const partOf = {}; UNIONS.forEach(u => u.parts.forEach(n => { partOf[n] = u; }));
    const UNI = Object.fromEntries(UNIONS.map(u => [u.en, u]));
    const active = (c, y) => { if (UNI[c.en]) return y < UNI[c.en].end; const u = partOf[c.en]; return !u || y >= u.end || !C[u.en] || val(C[u.en], y, 'pop') == null; };

    // --- 値（データの年のあいだは、なめらかにつなぐ：人口・GDPは伸び率でつなぐ） ---
    function raw(c, y, k) { // k: 1=pop, 2=gdp
      const d = c.data; let a = null, b = null;
      for (const r of d) { if (r[k] == null) continue; if (r[0] <= y) a = r; if (r[0] >= y) { b = r; break; } }
      if (!a || !b) return null;
      if (a[0] === b[0]) return a[k];
      if (b[0] - a[0] > 520) return null;     // 間があきすぎるときはつながない
      const t = (y - a[0]) / (b[0] - a[0]);
      return Math.exp(Math.log(a[k]) + (Math.log(b[k]) - Math.log(a[k])) * t);
    }
    const world = (y, k) => raw(G.World, y, k);
    function val(c, y, id = ind) {
      if (id === 'pop') return raw(c, y, 1);
      if (id === 'gdp') return raw(c, y, 2);
      if (id === 'pc') { const p = raw(c, y, 1), g = raw(c, y, 2); return p && g ? g * 1e6 / (p * 1e3) : null; }
      if (id === 'share') { const g = raw(c, y, 2), w = world(y, 2); return g && w ? g / w * 100 : null; }
    }
    // 年のツマミ（1年〜2018年。古い時代は目盛りを粗く）
    const ESEG = [[1, 0], [1000, 15], [1500, 30], [1820, 50], [1950, 75], [2018, 100]];
    const y2p = y => { for (let i = 1; i < ESEG.length; i++) { const [y0, p0] = ESEG[i - 1], [y1, p1] = ESEG[i]; if (y <= y1) return p0 + (y - y0) / (y1 - y0) * (p1 - p0); } return 100; };
    const p2y = p => { for (let i = 1; i < ESEG.length; i++) { const [y0, p0] = ESEG[i - 1], [y1, p1] = ESEG[i]; if (p <= p1) return Math.round(y0 + (p - p0) / (p1 - p0) * (y1 - y0)); } return 2018; };

    // --- 見出しのボタン ---
    ECON_IND.forEach(d => {
      const b = el(`<button type="button" class="chip" data-i="${d.id}">${d.name}</button>`);
      b.addEventListener('click', () => { ind = d.id; store.set('econInd', ind); markInd(); drawAll(); });
      head.appendChild(b);
    });
    const logB = el(`<button type="button" class="chip" style="margin-left:auto" aria-pressed="${log}">グラフ：対数目盛り</button>`);
    logB.addEventListener('click', () => { log = !log; store.set('econLog', log); logB.setAttribute('aria-pressed', String(log)); drawChart(); });
    head.appendChild(logB);
    const markInd = () => { $$('[data-i]', head).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.i === ind))); logB.hidden = ind === 'share'; };
    markInd();

    // --- 地図 ---
    const msvg = d3.select($('svg', mapBox));
    const gM = msvg.append('g'), gB = msvg.append('g');
    let pr, path, MW = 0, MH = 0;
    const feats = GEO.world().countries;
    const byIso = {}; E.countries.forEach(c => { if (c.iso) byIso[c.iso] = c; });
    const isoOf = c => c.iso || (UNI[c.en] && UNI[c.en].iso);
    function buildMap() {
      const r = mapBox.getBoundingClientRect();
      MW = Math.max(300, r.width); MH = Math.max(200, r.height);
      msvg.attr('viewBox', `0 0 ${MW} ${MH}`);
      pr = GEO.projection('world', MW, MH);
      // 1ピクセルより近い点は省く（小さな地図なので、細かい点は見えない。描くのがずっと速くなる）
      path = d3.geoPath({ stream: out => pr.stream({ _x: NaN, _y: NaN, _n: 0,
        point(x, y) { if (this._n++ === 0 || Math.abs(x - this._x) + Math.abs(y - this._y) >= 0.8) { this._x = x; this._y = y; out.point(x, y); } },
        lineStart() { this._n = 0; out.lineStart(); }, lineEnd() { out.lineEnd(); },
        polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); }, sphere() { out.sphere && out.sphere(); } }) });
      gM.selectAll('*').remove();
      gM.append('rect').attr('class', 'hm-sea').attr('width', MW).attr('height', MH);
      // 同じ大きさの地図の形は、一度作ったら覚えておく（2回目からはすぐ出る）
      const PC = window.__econPC || (window.__econPC = new Map()), pk = MW + 'x' + MH;
      if (!PC.has(pk)) { if (PC.size > 3) PC.clear(); PC.set(pk, new Map()); }
      const pc = PC.get(pk);
      feats.forEach(f => { if (!pc.has(f)) pc.set(f, { d: path(f) || '', c: path.centroid(f) }); });
      gM.selectAll('path.ec').data(feats).join('path').attr('class', 'ec').attr('d', f => pc.get(f).d)
        .on('mousemove', (ev, f) => { const c = byIso[f.id]; showTip(ev, c ? `<b>${esc(c.ja)}</b><br>${esc(tipText(c))}` : 'データなし'); })
        .on('mouseleave', () => { tip.hidden = true; })
        .on('click', (ev, f) => { const c = byIso[f.id]; if (c) togglePick(c.en); });
      feats.forEach(f => { f.cen = pc.get(f).c; });
    }
    function tipText(c) {
      const d = ECON_IND.find(x => x.id === ind), v = val(c, year);
      return v == null ? `${year}年：データなし` : `${year}年：${d.fmt(v)}`;
    }
    function showTip(ev, html) {
      const r = mapBox.getBoundingClientRect();
      tip.innerHTML = html; tip.hidden = false;
      tip.style.left = Math.min(ev.clientX - r.left + 12, r.width - tip.offsetWidth - 4) + 'px';
      tip.style.top = Math.max(4, ev.clientY - r.top - tip.offsetHeight - 8) + 'px';
    }
    function drawMap() {
      if (!pr) return;
      const vals = E.countries.filter(c => active(c, year)).map(c => val(c, year)).filter(v => v != null);
      const max = d3.max(vals) || 1;
      const rcol = c => (REGION[c.region] || {}).color || '#888';
      if (ind === 'pc') {
        // 色の濃さ（対数）
        const sc = d3.scaleSequentialLog(d3.interpolateYlOrBr).domain([400, 60000]).clamp(true);
        gM.selectAll('path.ec').attr('fill', f => { const c = byIso[f.id]; const v = c && val(c, year); return v ? sc(v) : 'var(--land)'; }).attr('fill-opacity', 0.9);
        gB.selectAll('*').remove();
      } else {
        gM.selectAll('path.ec').attr('fill', f => { const c = byIso[f.id]; return c && val(c, year) != null ? 'color-mix(in srgb, ' + rcol(c) + ' 18%, var(--land))' : 'var(--land)'; }).attr('fill-opacity', 1);
        // 円の面積が値に比例
        const rmax = Math.min(MW, MH) * (ind === 'share' ? 0.16 : 0.14);
        const rs = d3.scaleSqrt().domain([0, ind === 'share' ? Math.max(max, 30) : max]).range([0, rmax]);
        const cen = Object.fromEntries(feats.map(f => [f.id, f.cen]));
        const items = E.countries.filter(c => active(c, year)).map(c => { const v = val(c, year), q = cen[isoOf(c)]; return v && q && isFinite(q[0]) ? { c, v, x: q[0], y: q[1] } : null; }).filter(Boolean).sort((a, b) => b.v - a.v);
        gB.selectAll('g.eb').data(items, d => d.c.en).join(en => { const g = en.append('g').attr('class', 'eb'); g.append('circle'); g.append('text'); return g; })
          .attr('transform', d => `translate(${d.x},${d.y})`)
          .call(g => g.select('circle').attr('r', d => rs(d.v)).attr('fill', d => rcol(d.c)).attr('class', d => picked.includes(d.c.en) ? 'on' : ''))
          .call(g => g.select('text').text(d => rs(d.v) > 16 ? d.c.ja : '').attr('font-size', d => Math.min(14, 9 + rs(d.v) / 8)))
          .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.c.ja)}</b><br>${esc(tipText(d.c))}`))
          .on('mouseleave', () => { tip.hidden = true; })
          .on('click', (ev, d) => togglePick(d.c.en))
          .order();
      }
      $('.econ-year', wrap).innerHTML = `${year}年<small>${esc(ECON_IND.find(x => x.id === ind).name)}${year < 1820 ? '（推計・データの間をつないだ値）' : ''}</small>`;
    }

    // --- 折れ線グラフ（えらんだ国）／ 積み上げ（世界に占める割合：地域別） ---
    const csvg = d3.select($('svg', chartBox));
    const SHARE_GROUPS = ['Western Europe', 'Western Offshoots', 'Eastern Europe', 'Former USSR', 'Latin America', 'Middle East', 'East Asia', 'South and South-East Asia', 'Sub-Sahara Africa'];
    const GCOL = { 'Western Europe': '#1f5f8b', 'Western Offshoots': '#148f77', 'Eastern Europe': '#5d6d7e', 'Former USSR': '#a93226', 'Latin America': '#7cb342', 'Middle East': '#1e8449', 'East Asia': '#c0392b', 'South and South-East Asia': '#e69b00', 'Sub-Sahara Africa': '#d4ac0d' };
    const YEARS = d3.range(1, 2019);
    // アプリの地域ごとに国を合計（解体した国は二重に数えない）
    const RKEYS = ['europe', 'america', 'west', 'africa', 'south', 'sea', 'east', 'inner', 'oceania'];
    function regionAgg(y, k) { const o = {}; E.countries.forEach(c => { if (!active(c, y)) return; const v = raw(c, y, k); if (v) o[c.region] = (o[c.region] || 0) + v; }); return o; }
    function drawChart() {
      const r = chartBox.getBoundingClientRect();
      const W = Math.max(300, r.width), H = Math.max(140, r.height);
      csvg.attr('viewBox', `0 0 ${W} ${H}`); csvg.selectAll('*').remove();
      const m = { l: 58, r: 120, t: 14, b: 22 };
      const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
      const xy = y => x(y2p(y));
      // 横軸
      const ax = csvg.append('g').attr('class', 'c-axis');
      // せまい画面では目盛りを減らす（数字が重ならないように）。目盛りの間かくは一定ではない（新しい時代ほど広い）
      (W < 520 ? [1, 1000, 1500, 1820, 1950] : [1, 1000, 1500, 1700, 1820, 1900, 1950, 2000]).forEach(y => { ax.append('line').attr('x1', xy(y)).attr('x2', xy(y)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke-dasharray', '2 4'); ax.append('text').attr('x', xy(y)).attr('y', H - 6).attr('text-anchor', 'middle').text(y); });
      if (ind === 'share') {
        // 地域別の割合を積み上げ
        const ys = YEARS.filter(y => y >= 1820 && (y % 5 === 0 || y === 2018));
        const rows = ys.map(y => { const a = regionAgg(y, 2), tot = d3.sum(RKEYS, k => a[k] || 0); const o = { y }; RKEYS.forEach(k => { o[k] = tot ? (a[k] || 0) / tot * 100 : 0; }); return o; });
        const st = d3.stack().keys(RKEYS)(rows);
        const yS = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
        csvg.append('g').selectAll('path').data(st).join('path').attr('fill', d => REGION[d.key].color).attr('fill-opacity', 0.8)
          .attr('d', d3.area().x(d => xy(d.data.y)).y0(d => yS(d[0])).y1(d => yS(d[1])).curve(d3.curveMonotoneX));
        csvg.append('g').attr('class', 'c-axis').call(d3.axisLeft(yS).ticks(4).tickFormat(d => d + '%')).attr('transform', `translate(${m.l},0)`);
        // 右に名前（2018年の位置）
        const last = st.map(s => ({ k: s.key, y: (yS(s[s.length - 1][0]) + yS(s[s.length - 1][1])) / 2, h: yS(s[s.length - 1][0]) - yS(s[s.length - 1][1]) }));
        csvg.append('g').selectAll('text').data(last.filter(d => d.h > 9)).join('text').attr('class', 'ec-lab').attr('x', W - m.r + 6).attr('y', d => d.y + 4).attr('fill', d => REGION[d.k].color).text(d => REGION[d.k].name);
        csvg.append('text').attr('x', m.l + 6).attr('y', m.t + 14).attr('fill', 'var(--muted)').attr('font-size', 11.5).text('1820年より前は、そろったデータがないため表示していません');
      } else {
        const series = picked.map(n => C[n]).map(c => ({ c, pts: YEARS.filter(y => y === 1 || y % 5 === 0 || y === 2018).map(y => [y, val(c, y)]).filter(p => p[1] != null) })).filter(s => s.pts.length);
        const all = series.flatMap(s => s.pts.map(p => p[1]));
        const lo = d3.min(all) || 1, hi = d3.max(all) || 10;
        const yS = (log ? d3.scaleLog().domain([Math.max(lo * 0.8, 1e-3), hi * 1.2]) : d3.scaleLinear().domain([0, hi * 1.05])).range([H - m.b, m.t]).nice();
        const fmt = ECON_IND.find(d => d.id === ind).fmt;
        csvg.append('g').attr('class', 'c-axis').call(d3.axisLeft(yS).ticks(4, log ? '~s' : undefined).tickFormat(v => fmt(v).replace(/ドル|人/, ''))).attr('transform', `translate(${m.l},0)`);
        // 国ごとにちがう色（同じ地域の国も見分けられるように）
        const PAL = ['#c0392b', '#1f5f8b', '#d68910', '#27ae60', '#8e44ad', '#16a085', '#7f8c8d', '#e84393', '#2c3e50', '#a0522d', '#00a8cc', '#6c5ce7'];
        const col = s => PAL[series.indexOf(s) % PAL.length];
        const ln = d3.line().x(p => xy(p[0])).y(p => yS(p[1])).curve(d3.curveMonotoneX);
        csvg.append('g').selectAll('path').data(series).join('path').attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2.2).attr('d', s => ln(s.pts));
        // 右はしに名前（重ならないように少しずらす）
        const labs = series.map(s => ({ s, y: yS(s.pts[s.pts.length - 1][1]) })).sort((a, b) => a.y - b.y);
        labs.forEach((l, i) => { if (i && l.y - labs[i - 1].y < 12) l.y = labs[i - 1].y + 12; });
        csvg.append('g').selectAll('text').data(labs).join('text').attr('class', 'ec-lab').attr('x', W - m.r + 6).attr('y', d => d.y + 4).attr('fill', d => col(d.s)).text(d => d.s.c.ja);
        if (!series.length) csvg.append('text').attr('x', m.l + 10).attr('y', H / 2).attr('fill', 'var(--muted)').text('地図や右の一覧で国をえらぶと、ここに線が出ます。');
      }
      // 今の年
      csvg.append('line').attr('class', 'c-cursor').attr('x1', xy(year)).attr('x2', xy(year)).attr('y1', m.t).attr('y2', H - m.b);
      csvg.on('click', ev => { const [px] = d3.pointer(ev); setYear(p2y(clamp(x.invert(px), 0, 100))); });
    }

    // --- 右：その年の順位と、地域別の割合 ---
    function side() {
      const d = ECON_IND.find(x => x.id === ind);
      const list = E.countries.filter(c => active(c, year)).map(c => ({ c, v: val(c, year) })).filter(o => o.v != null).sort((a, b) => b.v - a.v);
      const top = list.slice(0, 15), max = top.length ? top[0].v : 1;
      body.innerHTML = '';
      body.appendChild(el(`<div><h2>${year}年の${esc(d.name)}</h2><div class="muted" style="font-size:12.5px">今の国の範囲で数えた推計です。${year < 1820 ? '1820年より前は、記録のある年（1年・1000年・1500年・1600年・1700年など）のあいだをつないだ値です。' : ''}</div></div>`));
      const w = world(year, 1), wg = world(year, 2);
      if (w || wg) body.appendChild(el(`<div class="ec-world">世界全体：${w ? '人口 ' + fmtPop(w) : ''}${wg ? '・GDP ' + fmtMoney(wg) : ''}${w && wg ? '・1人あたり ' + Math.round(wg * 1e3 / w).toLocaleString() + 'ドル' : ''}</div>`));
      body.appendChild(el('<h3>順位（おすとグラフに足す）</h3>'));
      const ul = el('<ol class="ec-rank"></ol>');
      top.forEach((o, i) => {
        const col = (REGION[o.c.region] || {}).color || '#888';
        const li = el(`<li class="${picked.includes(o.c.en) ? 'on' : ''}"><span class="n">${i + 1}</span><span class="nm">${esc(o.c.ja)}</span><span class="bar"><i style="width:${(o.v / max * 100).toFixed(1)}%;background:${col}"></i></span><span class="v">${esc(d.fmt(o.v))}</span></li>`);
        li.addEventListener('click', () => togglePick(o.c.en));
        ul.appendChild(li);
      });
      body.appendChild(ul);
      // 地域別の割合（GDP と 人口）
      const shareRow = k => { const a = regionAgg(year, k); return RKEYS.map(r => ({ r, v: a[r] || 0 })).filter(o => o.v); };
      [[2, 'GDP の地域別の割合'], [1, '人口の地域別の割合']].forEach(([k, t]) => {
        const rows = shareRow(k), tot = d3.sum(rows, o => o.v);
        if (!rows.length || !tot) return;
        body.appendChild(el(`<h3>${t}</h3>`));
        const bar = el('<div class="ec-stack"></div>');
        rows.forEach(o => bar.appendChild(el(`<i style="width:${(o.v / tot * 100).toFixed(2)}%;background:${REGION[o.r].color}" title="${esc(REGION[o.r].name)} ${(o.v / tot * 100).toFixed(1)}%"></i>`)));
        body.appendChild(bar);
        const lg = el('<div class="ec-legend"></div>');
        rows.sort((a, b) => b.v - a.v).forEach(o => lg.appendChild(el(`<span><span class="sw" style="background:${REGION[o.r].color}"></span>${esc(REGION[o.r].name)} ${(o.v / tot * 100).toFixed(1)}%</span>`)));
        if (year < 1820) body.appendChild(el('<p class="muted" style="font-size:11.5px">1820年より前は、データのある国だけで計算しています（とくにGDPは国が少ないので、目安です）。</p>'));
        body.appendChild(lg);
      });
      body.appendChild(el(`<p class="muted" style="font-size:11.5px;margin-top:14px">出典：${esc(E.src)}</p>`));
    }

    function togglePick(en) {
      const i = picked.indexOf(en);
      if (i >= 0) picked.splice(i, 1); else { picked.push(en); if (picked.length > 9) picked.shift(); }
      store.set('econPicked', picked);
      if (ind === 'share') { ind = 'gdp'; store.set('econInd', ind); markInd(); }
      drawAll();
    }

    // --- 年のツマミと再生 ---
    const range = $('.econ-bar input', wrap), yr = $('.econ-bar .yr', wrap), playB = $('.econ-bar .hm-play', wrap);
    range.addEventListener('input', () => setYear(p2y(range.value / 10)));
    let timer = null;
    playB.addEventListener('click', () => {
      if (timer) { clearInterval(timer); timer = null; playB.textContent = '▶'; return; }
      if (year >= 2018) year = 1;
      playB.textContent = '❚❚';
      timer = setInterval(() => { const step = year < 1500 ? 20 : year < 1820 ? 5 : 1; if (year >= 2018) { clearInterval(timer); timer = null; playB.textContent = '▶'; return; } setYear(Math.min(2018, year + step)); }, 90);
    });
    let sideT = null;
    function setYear(y) {
      year = clamp(Math.round(y), 1, 2018); store.set('econYear', year);
      if (document.activeElement !== range) range.value = Math.round(y2p(year) * 10);
      yr.textContent = year + '年';
      drawMap();
      csvg.select('.c-cursor').remove();
      drawChart();
      clearTimeout(sideT); sideT = setTimeout(side, 60);
    }
    function drawAll() { drawMap(); drawChart(); side(); }
    const ro = new ResizeObserver(() => { buildMap(); drawAll(); });
    ro.observe(mapBox); ro.observe(chartBox);
    buildMap(); setYear(year); side();
    return () => { clearInterval(timer); ro.disconnect(); };
  }
});
