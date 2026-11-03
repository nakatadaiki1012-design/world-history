/* 物語の一覧・出来事の一覧（地域・時代・科目・種類でしぼりこみ、年代順・地域順に並べる） */

// 一覧の上の「しぼりこみ」。物語と出来事で共通
function listFilters(box, key, opts, onChange) {
  const st = Object.assign({ region: '', era: '', course: '', kind: '', sort: 'year', q: '', skind: '', theme: '' }, store.get(key, {}));
  const save = () => { store.set(key, st); onChange(st); };
  const row = (label, items, field) => {
    const r = el(`<div class="lf-row"><b>${label}</b></div>`);
    items.forEach(([v, n, c]) => {
      const b = el(`<button type="button" class="chip" aria-pressed="${st[field] === v}">${c ? `<span class="sw" style="background:${c}"></span>` : ''}${n}</button>`);
      b.addEventListener('click', () => {
        st[field] = st[field] === v && field !== 'sort' ? '' : v;
        if (field === 'skind') { if (st.skind !== 'theme') st.theme = ''; store.set(key, st); box.innerHTML = ''; listFilters(box, key, opts, onChange); return; }
        $$('button', r).forEach((x, i) => x.setAttribute('aria-pressed', String(items[i][0] === st[field])));
        save();
      });
      r.appendChild(b);
    });
    box.appendChild(r);
  };
  if (opts.storyKinds) {
    row('種類', [['', 'すべて'], ['event', '🗺 できごと'], ['person', '👤 人物'], ['theme', '🧭 テーマ']], 'skind');
    if (st.skind === 'theme' || st.theme) row('テーマ', [['', 'すべて'], ...Object.entries(THEME_NAME).filter(([k]) => STORIES.some(s => s.theme === k)).map(([k, n]) => [k, n])], 'theme');
  }
  if (opts.search) {
    const s = el(`<div class="lf-row"><input type="search" placeholder="ことばでさがす（例：茶、ペスト、印刷）"></div>`);
    const inp = $('input', s); inp.value = st.q;
    inp.addEventListener('input', () => { st.q = inp.value.trim(); save(); });
    box.appendChild(s);
  }
  row('地域', [['', 'すべて'], ...REGIONS.map(r => [r.id, r.name, r.color])], 'region');
  row('時代', [['', 'すべて'], ...ERA_BINS.map(b => [b[2], b[2] + (b[0] <= -9999 ? '（〜500）' : b[1] >= 9999 ? `（${b[0]}〜）` : `（${b[0]}〜${b[1]}）`)])], 'era');
  row('科目', [['', 'すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']], 'course');
  if (opts.kinds) row('種類', [['', 'すべて'], ...Object.entries(KIND).map(([k, n]) => [k, n, KIND_COLOR[k]])], 'kind');
  row('並べかえ', [['year', '年代の古い順'], ['year-desc', '新しい順'], ['region', '地域ごと']], 'sort');
  onChange(st);
  return st;
}
const regionIndex = r => REGIONS.findIndex(x => x.id === r);

// 物語の一覧
registerTool('stories', {
  name: 'できごとを追う',
  render(main) {
    main.appendChild(el(`<div class="course-head"><h2>物語でたどる</h2><div class="muted" style="font-size:13.5px">できごと・人物の生涯・テーマ（土地制度・宗教・戦い方など）を、地図を動かしながら順にたどります。えらぶと地図が開き、自動で進みます（◀ ▶ で1場面ずつ・🔈 で語りの読み上げ）。</div></div>`));
    const f = el('<div class="lf" style="max-width:1100px;margin:0 auto 10px"></div>');
    const cnt = el('<div class="muted" style="max-width:1100px;margin:0 auto 6px;font-size:13px"></div>');
    const grid = el('<div class="pgrid" style="max-width:1100px;margin:0 auto"></div>');
    main.appendChild(f); main.appendChild(cnt); main.appendChild(grid);
    listFilters(f, 'storyFilter', { storyKinds: true }, st => {
      const ss = STORIES.filter(s => (!st.skind || storyKind(s) === st.skind) && (!st.theme || s.theme === st.theme) && (!st.region || s.region === st.region) && (!st.era || eraOf(s.steps[0].year) === st.era) && (!st.course || (s.tags || []).includes(st.course)));
      ss.sort((a, b) => st.sort === 'region' ? regionIndex(a.region) - regionIndex(b.region) || a.steps[0].year - b.steps[0].year : (st.sort === 'year-desc' ? -1 : 1) * (a.steps[0].year - b.steps[0].year));
      cnt.textContent = `${ss.length}本`;
      grid.innerHTML = '';
      let lastHead = '';
      ss.forEach(s => {
        const head = st.sort === 'region' ? (REGION[s.region] || {}).name : eraOf(s.steps[0].year);
        if (head !== lastHead) { grid.appendChild(el(`<h3 class="lf-head">${esc(head || '')}</h3>`)); lastHead = head; }
        const col = (REGION[s.region] || {}).color || '#555';
        const talk = s.steps.some(x => x.talk);
        grid.appendChild(el(`<a class="pcard" style="--c:${col};text-decoration:none;color:inherit" href="#story/${esc(s.id)}/1">
          ${thumbHtml(`story:${s.id}:1`)}
          <b>${storyKind(s) === 'person' ? '👤' : storyKind(s) === 'theme' ? '🧭' : '▶'} ${esc(s.title)}</b>
          <span class="m">${esc(STORY_KIND[storyKind(s)])}${s.theme ? '（' + esc(THEME_NAME[s.theme] || '') + '）' : ''}・${esc(s.period || '')}・${s.steps.length}場面・${esc((REGION[s.region] || {}).name || '')}${talk ? '・🎙 語りつき' : ''}</span>
          <span class="t">${esc(s.summary || '')}</span>
        </a>`));
      });
      if (!ss.length) grid.appendChild(el('<p class="empty">この条件の物語はありません。</p>'));
    });
  }
});

// 出来事の一覧
registerTool('events', {
  name: '出来事',
  render(main) {
    main.appendChild(el(`<div class="course-head"><h2>出来事の一覧</h2><div class="muted" style="font-size:13.5px">おすと、その年の地図が開きます。💡は「ここがおもしろい」つき。</div></div>`));
    const f = el('<div class="lf" style="max-width:1100px;margin:0 auto 10px"></div>');
    const cnt = el('<div class="muted" style="max-width:1100px;margin:0 auto 6px;font-size:13px"></div>');
    const list = el('<div class="evlist" style="max-width:1100px;margin:0 auto"></div>');
    const more = el('<button type="button" class="btn" style="display:block;margin:12px auto">もっと見る</button>');
    main.appendChild(f); main.appendChild(cnt); main.appendChild(list); main.appendChild(more);
    let rows = [], shown = 0, sortMode = 'year', lastHead = '';
    const PAGE = 150;
    function renderMore() {
      rows.slice(shown, shown + PAGE).forEach(({ e, i }) => {
        const head = sortMode === 'region' ? (REGION[e.region] || {}).name : eraOf(e.year);
        if (head !== lastHead) { list.appendChild(el(`<h3 class="lf-head">${esc(head || '')}</h3>`)); lastHead = head; }
        const fun = EVENT_FUN[e.title];
        list.appendChild(el(`<a class="evrow" href="${mapHash(e.year, REGION_VIEW_OF[e.region] || 'world', 'e:' + i)}">
          <span class="y num">${esc(yearLabel(e.year))}</span>
          <span class="k" style="background:${KIND_COLOR[e.kind] || '#555'}">${esc(KIND[e.kind] || '')}</span>
          <span class="b"><b>${esc(e.title)}</b>${fun ? ' <span title="ここがおもしろい">💡</span>' : ''}<span class="muted"> ${esc(e.place || '')}・${esc((REGION[e.region] || {}).name || '')}</span><br><span class="t">${esc(fun || e.text || '')}</span></span>
        </a>`));
      });
      shown += PAGE;
      more.hidden = shown >= rows.length;
    }
    more.addEventListener('click', renderMore);
    listFilters(f, 'eventFilter', { search: true, kinds: true }, st => {
      rows = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => (!st.region || e.region === st.region) && (!st.era || eraOf(e.year) === st.era) && (!st.course || (e.tags || []).includes(st.course)) && (!st.kind || e.kind === st.kind) && (!st.q || (e.title + (e.text || '') + (e.place || '') + (EVENT_FUN[e.title] || '')).includes(st.q)));
      rows.sort((a, b) => st.sort === 'region' ? regionIndex(a.e.region) - regionIndex(b.e.region) || a.e.year - b.e.year : (st.sort === 'year-desc' ? -1 : 1) * (a.e.year - b.e.year));
      cnt.textContent = `${rows.length}件`;
      list.innerHTML = ''; shown = 0; sortMode = st.sort; lastHead = '';
      renderMore();
    });
  }
});
