/* まとめて探す：用語・物語・人物・出来事・国/王朝・地名を、1つの検索欄から。ひらがなの読みでも探せる */
(function () {
  // くらべやすい形に（カタカナ→ひらがな、＝・＝・空白を消す、英字は小文字）
  const norm = s => String(s || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[=＝・\s　「」『』（）()]/g, '').toLowerCase();
  let index = null;
  function build() {
    const L = [];
    const add = (type, label, sub, href, keys, w) => L.push({ type, label, sub, href, keys: keys.map(norm).filter(Boolean), w: w || 1 });
    GLOSSARY.forEach(g => add('用語', g.term, `${'★'.repeat(g.rank || 1)} ${g.cat || ''}${g.year != null ? '・' + yearLabel(g.year) : ''}`, `#term/${encodeURIComponent(g.term)}`, [g.term, g.yomi], 1 + (g.rank || 1) * 0.2));
    STORIES.forEach(s => add('物語', s.title, `${STORY_KIND[storyKind(s)] || ''}・${s.period || ''}`, `#story/${s.id}/1`, [s.title, s.term, s.person && PERSON[s.person] ? PERSON[s.person].name : ''], 1.3));
    PEOPLE.forEach(p => add('人物', p.name, `${p.role || ''}・${lifeSpan(p)}`, mapHash(fixYear(Math.round((p.born + p.died) / 2)), REGION_VIEW_OF[p.region] || 'world', 'p:' + p.id), [p.name, p.kana, ...(p.keys || [])], 1.2));
    EVENTS.forEach((e, i) => add('出来事', e.title, `${yearLabel(e.year)}・${(REGION[e.region] || {}).name || ''}`, mapHash(e.year, REGION_VIEW_OF[e.region] || 'world', 'e:' + i), [e.title], 1));
    POLITIES.forEach(p => add('国・王朝', p.name, span(p.start, p.end), mapHash(fixYear(Math.round((Math.max(p.start, YEAR_MIN) + Math.min(p.end, YEAR_MAX)) / 2)), REGION_VIEW_OF[p.region] || 'world', 's:' + p.id), [p.name, ...(p.alias || [])], 1.1));
    PLACES.forEach(pl => { const n = pl.names[pl.names.length - 1]; add('地名', pl.names.map(x => x.name).filter((v, i, a) => a.indexOf(v) === i).join('／'), pl.modern ? '今の' + pl.modern : '', mapHash(fixYear(Math.max(YEAR_MIN, n.from)), REGION_VIEW_OF[pl.region] || 'world', 'pl:' + pl.id), [...pl.names.map(x => x.name), pl.modern], 0.9); });
    return L;
  }
  function search(q) {
    if (!index) index = build();
    const k = norm(q); if (!k) return [];
    const out = [];
    index.forEach(it => {
      let sc = 0;
      it.keys.forEach(x => { const v = x === k ? 100 : x.startsWith(k) ? 60 - Math.min(20, x.length - k.length) : x.includes(k) ? 30 - Math.min(15, x.length - k.length) : 0; if (v > sc) sc = v; });
      if (sc) out.push({ it, sc: sc * it.w });
    });
    return out.sort((a, b) => b.sc - a.sc).map(o => o.it);
  }
  const ORDER = ['用語', '物語', '人物', '出来事', '国・王朝', '地名'];
  const ICON = { '用語': '📘', '物語': '▶', '人物': '👤', '出来事': '◆', '国・王朝': '🏳', '地名': '📍' };
  function open() {
    if ($('.sr-ov')) return;
    if (window.ensureStories) ensureStories();   // 物語も探せるように（まだなら読みはじめる）
    const ov = el(`<div class="sr-ov" role="dialog" aria-label="まとめて探す"><div class="sr-card">
      <div class="sr-head"><input type="search" class="sr-in" placeholder="用語・人物・物語・出来事・国・地名（読みでもOK）" autocomplete="off"><button type="button" class="prof-x" aria-label="とじる">✕</button></div>
      <div class="sr-res"><p class="muted" style="font-size:13px">例：きんでん、ナポレオン、ウェストファリア、長安、ルネサンス</p></div></div></div>`);
    document.body.appendChild(ov);
    const inp = $('.sr-in', ov), res = $('.sr-res', ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', close); };
    window.addEventListener('hashchange', close);   // 画面が変わったら閉じる（用語の窓から物語へ移ったときなど）
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('.prof-x', ov).addEventListener('click', close);
    let t = null;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 120); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = $('a', res); if (a) { a.click(); } } });
    function render() {
      const r = search(inp.value);
      res.innerHTML = '';
      if (!inp.value.trim()) return;
      if (!r.length) { res.innerHTML = '<p class="muted">見つかりませんでした。ちがう書き方（カタカナ・ひらがな）でも試してみてください。</p>'; return; }
      // いちばん合うものを上に、そのあと種類ごと
      ORDER.forEach(type => {
        const g = r.filter(x => x.type === type); if (!g.length) return;
        const sec = el(`<div class="sr-sec"><h3>${ICON[type]} ${type} <small class="muted">${g.length}</small></h3><ul class="lst"></ul></div>`);
        const ul = $('ul', sec);
        const show = n => { ul.innerHTML = ''; g.slice(0, n).forEach(x => { const li = el(`<li><a href="${esc(x.href)}"${type === '用語' ? ` class="term" data-term="${esc(x.label)}"` : ''}><b>${esc(x.label)}</b> <span class="muted" style="font-size:12.5px">${esc(x.sub || '')}</span></a></li>`); $('a', li).addEventListener('click', close); ul.appendChild(li); }); };
        show(5);
        if (g.length > 5) { const m = el(`<button type="button" class="chip" style="margin:2px 0 6px">ほかに ${g.length - 5} 件</button>`); m.addEventListener('click', () => { show(60); m.remove(); }); sec.appendChild(m); }
        res.appendChild(sec);
      });
    }
    inp.focus();
  }
  window.openSearch = open;
  window.addEventListener('lateready', () => { index = null; });
  // 「/」キーでも開ける（文字を入力中は除く）
  document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); open(); } });
})();
