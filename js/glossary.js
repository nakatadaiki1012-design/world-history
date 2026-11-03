/* 用語集：ウィキのように、本文の用語をおすとその用語のページ（小さな窓）が開く。用語集の一覧ページとクイズにも使う */
const GLOSSARY = (() => {
  const seen = new Set();
  return (window.GLOSSARY || []).filter(g => g && g.term && g.def && !seen.has(g.term) && seen.add(g.term));
})();
const TERM = Object.fromEntries(GLOSSARY.map(g => [g.term, g]));
const TERM_CAT_ORDER = ['国家・王朝', '人物', '事件・戦争', '条約・宣言', '制度・政策', '思想・宗教', '文化・学問', '経済・社会', '地名・地域', '組織・運動'];

// 本文の中の用語に印をつける（1つの文章で同じ語は最初の1回だけ。長い語を先に）
let _termRe = null;
function termRe() {
  if (_termRe !== null) return _termRe;
  const keys = GLOSSARY.map(g => g.term).filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
  _termRe = keys.length ? new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : false;
  return _termRe;
}
// text（ふつうの文字列）→ HTML。ふりがな（furi）と同時に使えるように、まず用語を区切ってから、それぞれを処理する
function linkTerms(text, self) {
  const re = termRe(); const s = String(text || '');
  if (!re) return furi(s);
  const used = new Set(self ? [self] : []);
  let out = '', last = 0;
  s.replace(re, (m, i) => {
    if (used.has(m)) return m;
    used.add(m);
    out += furi(s.slice(last, i)) + `<a class="term" data-term="${esc(m)}" href="#term/${encodeURIComponent(m)}">${furi(m)}</a>`;
    last = i + m.length;
    return m;
  });
  return out + furi(s.slice(last));
}
// どこをおしても用語の窓が開く（# の移動はせず、その場で開く）
document.addEventListener('click', e => {
  const a = e.target.closest('a.term');
  if (!a) return;
  e.preventDefault(); e.stopPropagation();
  openTerm(a.dataset.term);
}, true);

function termMastered() { return store.get('termOk', {}); }
function setMastered(t, v) { const m = termMastered(); if (v) m[t] = 1; else delete m[t]; store.set('termOk', m); }

function openTerm(t) {
  const g = TERM[t]; if (!g) return;
  $$('.term-ov').forEach(x => x.remove());
  const reg = REGION[g.region];
  // この語が出てくる出来事・物語・人物
  const evs = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => (e.title + (e.text || '')).includes(t)).slice(0, 8);
  const sts = STORIES.filter(s => s.title.includes(t) || s.steps.some(x => (x.title + x.text).includes(t))).slice(0, 6);
  const pps = PEOPLE.filter(p => p.name.includes(t) || (p.keys || []).includes(t) || (p.text || '').includes(t)).slice(0, 8);
  const pol = POLITIES.find(p => p.name === t);
  const per = PEOPLE.find(p => p.name.replace(/（.*?）/g, '') === t || p.name === t);
  const ov = el(`<div class="term-ov" role="dialog" aria-label="${esc(t)}">
    <div class="term-card">
      <button type="button" class="prof-x" aria-label="とじる">✕</button>
      <div class="muted" style="font-size:12.5px">${esc(g.cat || '')}${reg ? '・' + esc(reg.name) : ''}${g.year != null ? '・' + esc(yearLabel(g.year)) + (g.end && g.end !== g.year ? '〜' + esc(yearLabel(g.end)) : '') : ''}</div>
      <h2>${esc(t)} <small class="muted">${esc(g.yomi || '')}</small> <span class="stars" title="テストに出る度">${'★'.repeat(g.rank || 1)}${'☆'.repeat(3 - (g.rank || 1))}</span></h2>
      <p>${linkTerms(g.def, t)}</p>
      <div class="term-btns"></div>
      ${(g.related || []).length ? `<h3>関連する用語</h3><div class="keys">${g.related.map(r => TERM[r] ? `<a class="term chip" data-term="${esc(r)}" href="#term/${encodeURIComponent(r)}">${esc(r)}</a>` : `<span>${esc(r)}</span>`).join('')}</div>` : ''}
      ${evs.length ? `<h3>出てくる出来事</h3><ul class="lst term-evs"></ul>` : ''}
      ${sts.length ? `<h3>出てくる物語</h3><ul class="lst term-sts"></ul>` : ''}
      ${pps.length ? `<h3>関係する人物</h3><ul class="lst term-pps"></ul>` : ''}
    </div></div>`);
  const close = () => { SPEECH.stop(); ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('.prof-x', ov).addEventListener('click', close);
  const bt = $('.term-btns', ov);
  bt.appendChild(speakBtn(() => `${t}。${g.def}`));
  const ok = el(`<button type="button" class="chip">${termMastered()[t] ? '✅ 覚えた' : '☐ 覚えた'}</button>`);
  ok.addEventListener('click', () => { const v = !termMastered()[t]; setMastered(t, v); ok.textContent = v ? '✅ 覚えた' : '☐ 覚えた'; });
  bt.appendChild(ok);
  if (g.year != null) { const a = el(`<a class="chip" href="${mapHash(fixYear(g.year), REGION_VIEW_OF[g.region] || 'world', pol ? 's:' + pol.id : per ? 'p:' + per.id : '')}">🗺 地図で見る</a>`); a.addEventListener('click', close); bt.appendChild(a); }
  if (per && hasProfile(per.id)) { const b = el('<button type="button" class="chip">📖 人物のくわしいページ</button>'); b.addEventListener('click', () => { close(); openProfile(per.id); }); bt.appendChild(b); }
  const ul1 = $('.term-evs', ov); if (ul1) evs.forEach(({ e, i }) => { const a = el(`<li><a href="${mapHash(e.year, REGION_VIEW_OF[e.region] || 'world', 'e:' + i)}"><span class="yrs">${esc(yearLabel(e.year))}</span> ${esc(e.title)}</a></li>`); a.querySelector('a').addEventListener('click', close); ul1.appendChild(a); });
  const ul2 = $('.term-sts', ov); if (ul2) sts.forEach(s => { const a = el(`<li><a href="#story/${esc(s.id)}/1">▶ ${esc(s.title)}</a></li>`); a.querySelector('a').addEventListener('click', close); ul2.appendChild(a); });
  const ul3 = $('.term-pps', ov); if (ul3) pps.forEach(p => { const a = el(`<li><a href="${mapHash(fixYear(Math.round((p.born + p.died) / 2)), REGION_VIEW_OF[p.region] || 'world', 'p:' + p.id)}">${portraitImg(p)} ${esc(p.name)} <span class="yrs">${esc(lifeSpan(p))}</span></a></li>`); a.querySelector('a').addEventListener('click', close); ul3.appendChild(a); });
  document.body.appendChild(ov);
}

// 用語集のページ（テスト対策）
registerTool('glossary', {
  name: '用語集',
  render(main, params) {
    main.appendChild(el(`<div class="course-head"><h2>用語集</h2><div class="muted" style="font-size:13px">${GLOSSARY.length}語。★の数はテストに出る度。おすと説明が開きます。「覚えた」を記録できます。</div></div>`));
    if (!GLOSSARY.length) { main.appendChild(el('<p class="empty">用語集のデータを準備中です。</p>')); return; }
    const box = el('<div style="max-width:1100px;margin:0 auto"></div>');
    main.appendChild(box);
    const st = Object.assign({ q: '', rank: '3', region: '', era: '', cat: '', course: '', hide: false }, store.get('glossF', {}));
    const tabs = el('<div class="lf-tabs" style="margin-bottom:8px"></div>');
    [['3', '★★★ テストに必ず出る'], ['2', '★★ よく出る'], ['', 'すべて']].forEach(([v, n]) => {
      const b = el(`<button type="button" aria-pressed="${st.rank === v}">${n}</button>`);
      b.addEventListener('click', () => { st.rank = v; $$('button', tabs).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); upd(); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    const bar = el('<div class="lf-bar"></div>');
    const q = el('<input type="search" class="lf-q" placeholder="🔍 さがす">'); q.value = st.q; q.addEventListener('input', () => { st.q = q.value.trim(); upd(); }); bar.appendChild(q);
    const sel = (f, items) => { const s = el(`<select>${items.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`); s.value = st[f]; s.addEventListener('change', () => { st[f] = s.value; upd(); }); bar.appendChild(s); };
    sel('region', [['', '地域：すべて'], ...REGIONS.map(r => [r.id, r.name])]);
    sel('era', [['', '時代：すべて'], ...ERA_BINS.map(b => [b[2], b[2]])]);
    sel('cat', [['', '分類：すべて'], ...TERM_CAT_ORDER.map(c => [c, c])]);
    sel('course', [['', '科目：すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']]);
    const hide = el(`<label class="chip"><input type="checkbox"> 覚えた語をかくす</label>`); $('input', hide).checked = st.hide; $('input', hide).addEventListener('change', e => { st.hide = e.target.checked; upd(); }); bar.appendChild(hide);
    box.appendChild(bar);
    const info = el('<div class="muted" style="font-size:13px;margin:8px 0"></div>'); box.appendChild(info);
    const list = el('<div class="gl-list"></div>'); box.appendChild(list);
    const more = el('<button type="button" class="btn" style="display:block;margin:12px auto">もっと見る</button>'); box.appendChild(more);
    let rows = [], shown = 0;
    function page() {
      rows.slice(shown, shown + 120).forEach(g => {
        const ok = termMastered()[g.term];
        const it = el(`<div class="gl-item${ok ? ' ok' : ''}"><a class="term gl-t" data-term="${esc(g.term)}" href="#term/${encodeURIComponent(g.term)}">${esc(g.term)}</a><span class="gl-y muted">${esc(g.yomi || '')}</span><span class="stars">${'★'.repeat(g.rank || 1)}</span><span class="gl-m muted">${esc(g.cat || '')}${g.year != null ? '・' + esc(yearLabel(g.year)) : ''}</span><div class="gl-d">${esc(g.def)}</div><button type="button" class="gl-ok" aria-label="覚えた">${ok ? '✅' : '☐'}</button></div>`);
        $('.gl-ok', it).addEventListener('click', () => { const v = !termMastered()[g.term]; setMastered(g.term, v); it.classList.toggle('ok', v); $('.gl-ok', it).textContent = v ? '✅' : '☐'; });
        list.appendChild(it);
      });
      shown += 120; more.hidden = shown >= rows.length;
    }
    more.addEventListener('click', page);
    function upd() {
      store.set('glossF', st);
      const m = termMastered();
      rows = GLOSSARY.filter(g => (!st.rank || String(g.rank || 1) === st.rank) && (!st.region || g.region === st.region) && (!st.era || (g.year != null && eraOf(g.year) === st.era)) && (!st.cat || g.cat === st.cat) && (!st.course || (g.course || []).includes(st.course)) && (!st.hide || !m[g.term]) && (!st.q || (g.term + (g.yomi || '') + g.def).includes(st.q)))
        .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      const all = GLOSSARY.filter(g => !st.rank || String(g.rank || 1) === st.rank), done = all.filter(g => m[g.term]).length;
      info.textContent = `${rows.length}語（この重要度で覚えた語：${done} / ${all.length}）`;
      list.innerHTML = ''; shown = 0; page();
    }
    upd();
    if (params && params.term && TERM[params.term]) setTimeout(() => openTerm(params.term), 50);
  }
});
