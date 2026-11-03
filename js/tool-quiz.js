/* クイズ：データから毎回ちがう問題を作る＋授業の確認問題 */
const QTYPES = [
  { id: 'map', name: '地図の国・王朝' },
  { id: 'capital', name: '都' },
  { id: 'same', name: '同じ時代' },
  { id: 'order', name: '出来事の順番' },
  { id: 'who', name: '人物あて' },
  { id: 'lesson', name: '授業の確認問題' },
  { id: 'termdef', name: '用語：説明→用語' },
  { id: 'defterm', name: '用語：用語→説明' },
  { id: 'termera', name: '用語：いつのこと？' }
];

function quizMaker(course) {
  // 用語のえらび方：科目で絞り、★の多い語を多めに
  const termPool = () => (typeof GLOSSARY === 'undefined' ? [] : GLOSSARY).filter(g => g.def && g.def.length > 20 && (!course || !(g.course || []).length || g.course.includes(course)));
  const termPick = () => { const P = termPool(); if (!P.length) return null; const w = P.map(g => (g.rank || 1) * (g.rank || 1)); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < P.length; i++) { r -= w[i]; if (r <= 0) return P[i]; } return P[0]; };
  // まちがいの選択肢：同じ分類・同じ地域・近い時代の語から（見分けがいのあるものに）
  const termOthers = (g, n) => { const P = termPool().filter(x => x.term !== g.term && !g.def.includes(x.term) && !x.def.includes(g.term));
    const near = P.filter(x => x.cat === g.cat && (x.region === g.region || (x.year != null && g.year != null && Math.abs(x.year - g.year) < 400)));
    return shuffle(near.length >= n ? near : P).slice(0, n); };
  // 歴史総合は 18 世紀以降が中心
  const inCourse = x => !course || (x.tags || []).includes(course) || (course === 'sogo' && (x.start || x.year || x.born || 0) >= 1700);
  const pols = POLITIES.filter(p => (p.rank || 2) <= 2 && inCourse(p));
  const evs = EVENTS.filter(inCourse);
  const ppl = PEOPLE.filter(inCourse);
  const mk = {
    map() {
      const p = pick(pols.filter(p => p.shapes && p.shapes.length));
      if (!p) return null;
      const s = pick(p.shapes);
      const y = fixYear(Math.round((Math.max(s.from, p.start) + Math.min(s.to, p.end, YEAR_MAX)) / 2));
      const others = shuffle(POLITIES.filter(q => q.id !== p.id && q.name !== p.name && y >= q.start && y <= q.end && (q.rank || 2) <= 2)).slice(0, 3);
      if (others.length < 3) return null;
      const c = shuffle([p, ...others]);
      return { q: `${yearLabel(y)}ごろ、地図で色をつけた国・王朝はどれ？`, c: c.map(x => x.name), a: c.indexOf(p), exp: `${p.name}（${span(p.start, p.end)}）。${p.text || ''}`, map: { year: y, id: p.id, view: REGION_VIEW[p.region] || 'world' } };
    },
    capital() {
      const ws = pols.filter(p => p.capital || (p.capitals && p.capitals.length));
      const p = pick(ws); if (!p) return null;
      const cap = p.capital || pick(p.capitals);
      const others = shuffle(ws.filter(q => q.region === p.region && q.name !== p.name && !(q.capitals || [q.capital]).some(c => c && c.name === cap.name))).slice(0, 3);
      if (others.length < 3) return null;
      const c = shuffle([p, ...others]);
      return { q: `${cap.name}に都をおいた国・王朝はどれ？`, c: c.map(x => x.name), a: c.indexOf(p), exp: `${p.name}（${span(p.start, p.end)}）の都は${(p.capitals || [p.capital]).map(c => c.name).join('・')}。${p.text || ''}` };
    },
    same() {
      const y = fixYear(pick(pols).start + Math.round(Math.random() * 60));
      const alive = shuffle(pols.filter(p => y >= p.start && y <= p.end));
      const regs = []; const three = [];
      alive.forEach(p => { if (three.length < 3 && !regs.includes(p.region)) { regs.push(p.region); three.push(p); } });
      if (three.length < 3) return null;
      const not = pick(pols.filter(p => (p.end < y - 100 || p.start > y + 100) && !three.some(t => t.name === p.name)));
      if (!not) return null;
      const c = shuffle([...three, not]);
      return { q: `${yearLabel(y)}に、まだ（もう）存在して<b>いなかった</b>国・王朝はどれ？`, c: c.map(x => x.name), a: c.indexOf(not), exp: `${not.name}は${span(not.start, not.end)}。ほかの3つは${yearLabel(y)}に存在した（${three.map(t => `${t.name} ${span(t.start, t.end)}`).join('、')}）。` };
    },
    order() {
      const pool = shuffle(evs);
      const four = [];
      for (const e of pool) { if (four.length >= 4) break; if (four.every(f => Math.abs(f.year - e.year) >= 8 && f.title !== e.title)) four.push(e); }
      if (four.length < 4) return null;
      const newest = Math.random() < 0.5;
      const ans = four.slice().sort((a, b) => newest ? b.year - a.year : a.year - b.year)[0];
      return { q: `次の出来事のうち、もっとも${newest ? '<b>新しい</b>' : '<b>古い</b>'}ものはどれ？`, c: four.map(e => e.title), a: four.indexOf(ans), exp: four.slice().sort((a, b) => a.year - b.year).map(e => `${e.title}（${yearLabel(e.year)}）`).join(' → ') };
    },
    who() {
      const p = pick(ppl.filter(p => p.text && p.text.length > 20)); if (!p) return null;
      const others = shuffle(ppl.filter(q => q.id !== p.id && Math.abs(q.born - p.born) < 600)).slice(0, 3);
      if (others.length < 3) return null;
      let text = p.text;
      [p.name, ...(p.name.split('=').length > 1 ? p.name.split('=') : [])].forEach(n => { if (n.length >= 2) text = text.split(n).join('この人物'); });
      const c = shuffle([p, ...others]);
      return { q: `次の説明にあてはまる人物はだれ？<div class="qres" style="margin-top:8px;font-weight:500">${esc(text)}</div>`, c: c.map(x => x.name), a: c.indexOf(p), exp: `${p.name}（${lifeSpan(p)}、${p.role || ''}）。`, person: p.id };
    },
    // 用語集から：説明を読んで用語を当てる（テストに出やすい語ほど多く出す）
    termdef() {
      const g = termPick(); if (!g) return null;
      const others = termOthers(g, 3); if (others.length < 3) return null;
      const c = shuffle([g, ...others]);
      let d = g.def; [g.term, ...(g.term.split(/[=＝・]/).filter(x => x.length >= 2))].forEach(n => { d = d.split(n).join('〔　　〕'); });
      return { q: `次の説明にあてはまる用語はどれ？<div class="qres" style="margin-top:8px;font-weight:500">${esc(d)}</div>`, c: c.map(x => x.term), a: c.indexOf(g), exp: `${g.term}（${g.yomi || ''}）：${g.def}`, term: g.term };
    },
    defterm() {
      const g = termPick(); if (!g) return null;
      const others = termOthers(g, 3); if (others.length < 3) return null;
      const c = shuffle([g, ...others]);
      const hide = (x) => { let d = x.def; [x.term].forEach(n => { d = d.split(n).join('これ'); }); return d.length > 70 ? d.slice(0, 68) + '…' : d; };
      return { q: `「${esc(g.term)}」の説明として正しいものはどれ？`, c: c.map(hide), a: c.indexOf(g), exp: `${g.term}：${g.def}`, term: g.term };
    },
    termera() {
      const pool = termPool().filter(g => g.year != null);
      const g = pick(pool); if (!g) return null;
      const bins = ERA_BINS.map(b => b[2]);
      const right = eraOf(g.year);
      const c = shuffle([right, ...shuffle(bins.filter(b => b !== right)).slice(0, 3)]);
      return { q: `「${esc(g.term)}」がいちばん関係する時代はどれ？`, c, a: c.indexOf(right), exp: `${g.term}（${yearLabel(g.year)}）：${g.def}`, term: g.term };
    },
    lesson() {
      const ls = LESSONS.filter(l => !course || l.course === course).filter(l => l.quiz && l.quiz.length);
      const l = pick(ls); if (!l) return null;
      const q = pick(l.quiz);
      const order = shuffle([0, 1, 2, 3].slice(0, q.c.length));
      return { q: esc(q.q), c: order.map(i => q.c[i]), a: order.indexOf(q.a), exp: q.exp || '', lesson: l };
    }
  };
  return type => { for (let i = 0; i < 20; i++) { const r = mk[type](); if (r) return r; } return null; };
}

registerTool('quiz', {
  name: 'クイズ',
  render(main) {
    const box = el('<div class="quiz"></div>');
    main.appendChild(box);
    let cfg = Object.assign({ course: '', types: ['map', 'capital', 'same', 'order', 'who', 'lesson', 'termdef', 'defterm'], n: 10 }, store.get('quizCfg', {}));
    let mini = null;
    function setup() {
      if (mini) { mini.destroy(); mini = null; }
      box.innerHTML = '';
      const best = store.get('quizBest', {});
      const s = el(`<div class="card setup">
        <h2 style="margin:0">クイズ</h2>
        <div class="row"><b>科目</b></div>
        <div class="row"><b>問題の種類</b></div>
        <div class="row"><b>問題の数</b></div>
        <div><button type="button" class="btn primary">スタート</button> <span class="muted" style="font-size:13px">${best.n ? `これまでの最高：${best.score}/${best.n}` : ''}</span></div>
      </div>`);
      const rows = $$('.row', s);
      [['', 'すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']].forEach(([k, n]) => {
        const b = el(`<button type="button" class="chip" aria-pressed="${cfg.course === k}">${n}</button>`);
        b.addEventListener('click', () => { cfg.course = k; $$('button', rows[0]).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); });
        rows[0].appendChild(b);
      });
      QTYPES.forEach(t => {
        const b = el(`<button type="button" class="chip" aria-pressed="${cfg.types.includes(t.id)}">${t.name}</button>`);
        b.addEventListener('click', () => { const i = cfg.types.indexOf(t.id); if (i >= 0) { if (cfg.types.length > 1) cfg.types.splice(i, 1); } else cfg.types.push(t.id); b.setAttribute('aria-pressed', String(cfg.types.includes(t.id))); });
        rows[1].appendChild(b);
      });
      [5, 10, 20].forEach(n => {
        const b = el(`<button type="button" class="chip" aria-pressed="${cfg.n === n}">${n}問</button>`);
        b.addEventListener('click', () => { cfg.n = n; $$('button', rows[2]).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); });
        rows[2].appendChild(b);
      });
      $('.btn.primary', s).addEventListener('click', () => { store.set('quizCfg', cfg); start(); });
      box.appendChild(s);
    }
    function start() {
      const make = quizMaker(cfg.course);
      const qs = [];
      for (let i = 0; i < cfg.n * 3 && qs.length < cfg.n; i++) {
        const q = make(cfg.types[i % cfg.types.length === 0 ? Math.floor(Math.random() * cfg.types.length) : Math.floor(Math.random() * cfg.types.length)]);
        if (q && !qs.some(x => x.q === q.q)) qs.push(q);
      }
      let i = 0, score = 0, streak = 0;
      function show() {
        if (mini) { mini.destroy(); mini = null; }
        box.innerHTML = '';
        if (i >= qs.length) return result();
        const q = qs[i];
        const card = el(`<div class="card qbox">
          <div class="qmeta"><span>${i + 1} / ${qs.length}</span><span>${streak >= 2 ? `🔥 ${streak}問連続` : ''} 正解 ${score}</span></div>
          ${q.map ? '<div class="qmap"></div>' : ''}
          <h2>${q.q}</h2>
          <div class="qchoices"></div>
          <div class="qnext"></div>
        </div>`);
        box.appendChild(card);
        if (q.map) {
          mini = createHistMap($('.qmap', card), { year: q.map.year, view: q.map.view, bar: false, mini: true, only: [q.map.id], layers: { cap: false, people: false, events: false } });
          mini.root.style.height = '100%';
        }
        const ch = $('.qchoices', card);
        q.c.forEach((c, k) => {
          const b = el(`<button type="button">${'アイウエ'[k]}．${esc(c)}</button>`);
          b.addEventListener('click', () => {
            if (ch.dataset.done) return; ch.dataset.done = '1';
            const ok = k === q.a;
            if (ok) { score++; streak++; } else streak = 0;
            $$('button', ch).forEach((x, j) => { if (j === q.a) x.classList.add('ok'); else if (j === k) x.classList.add('ng'); });
            const res = el(`<div class="qres"><span class="mark" style="color:${ok ? 'var(--ok)' : 'var(--ng)'}">${ok ? '◯' : '✕'}</span>${esc(q.exp)}</div>`);
            const links = el('<div class="keys" style="margin-top:8px"></div>');
            if (q.map) links.appendChild(el(`<a class="chip" href="${mapHash(q.map.year, q.map.view, 's:' + q.map.id)}">🗺 地図でくわしく</a>`));
            if (q.person) links.appendChild(el(`<a class="chip" href="${mapHash(Math.round((PERSON[q.person].born + PERSON[q.person].died) / 2), REGION_VIEW[PERSON[q.person].region], 'p:' + q.person)}">🗺 足あとを見る</a>`));
            if (q.term && typeof TERM !== 'undefined' && TERM[q.term]) { const t = el(`<a class="chip term" data-term="${esc(q.term)}" href="#term/${encodeURIComponent(q.term)}">📘 用語「${esc(q.term)}」を見る</a>`); links.appendChild(t); }
            if (q.lesson) links.appendChild(el(`<a class="chip" href="#lessons/${q.lesson.course}/${q.lesson.id}">📖 授業「${esc(q.lesson.title)}」</a>`));
            if (links.children.length) res.appendChild(links);
            $('.qnext', card).appendChild(res);
            const nx = el(`<button type="button" class="btn primary" style="margin-top:12px">${i + 1 < qs.length ? '次へ →' : '結果を見る'}</button>`);
            nx.addEventListener('click', () => { i++; show(); });
            $('.qnext', card).appendChild(nx);
            nx.focus({ preventScroll: true });
          });
          ch.appendChild(b);
        });
      }
      function result() {
        const best = store.get('quizBest', {});
        if (!best.n || score / qs.length > best.score / best.n) store.set('quizBest', { score, n: qs.length });
        const stars = score / qs.length >= 0.9 ? '★★★' : score / qs.length >= 0.6 ? '★★☆' : score / qs.length >= 0.3 ? '★☆☆' : '☆☆☆';
        const r = el(`<div class="card qbox" style="text-align:center">
          <div class="score">${score} / ${qs.length}</div>
          <div style="font-size:30px;color:#d4a017">${stars}</div>
          <p>${score === qs.length ? 'パーフェクト！' : 'まちがえた問題は、地図や授業で確かめてみよう。'}</p>
          <button type="button" class="btn primary">もう一度</button> <button type="button" class="btn">設定にもどる</button>
        </div>`);
        const bs = $$('button', r);
        bs[0].addEventListener('click', start); bs[1].addEventListener('click', setup);
        box.appendChild(r);
      }
      if (!qs.length) { box.innerHTML = '<p class="empty">問題を作れませんでした。種類や科目を変えてみてください。</p>'; return; }
      show();
    }
    setup();
    return () => { if (mini) mini.destroy(); };
  }
});
