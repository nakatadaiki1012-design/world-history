/* 物語の一覧・出来事の一覧（地域・時代・科目・種類でしぼりこみ、年代順・地域順に並べる） */

// 一覧の上の「しぼりこみ」。物語と出来事で共通
function listFilters(box, key, opts, onChange) {
  const st = Object.assign({ region: '', era: '', course: '', kind: '', sort: 'year', q: '', skind: '', theme: '', tcat: '' }, store.get(key, {}));
  const save = () => { store.set(key, st); onChange(st); };
  box.classList.add('lf2');
  box.innerHTML = '';
  // 物語の種類だけはよく使うので、タブのように上に並べる
  if (opts.storyKinds) {
    const tabs = el('<div class="lf-tabs"></div>');
    [['', 'すべて'], ['event', '🗺 できごと'], ['person', '👤 人物'], ['theme', '🧭 テーマ'], ['term', '📘 用語']].forEach(([v, n]) => {
      const b = el(`<button type="button" aria-pressed="${st.skind === v}">${n}</button>`);
      b.addEventListener('click', () => { st.skind = v; if (v !== 'theme') st.theme = ''; if (v !== 'term') st.tcat = ''; store.set(key, st); listFilters(box, key, opts, onChange); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
  }
  // のこりの条件は、1行のセレクト（スマホでも場所をとらない）
  const bar = el('<div class="lf-bar"></div>');
  if (opts.search) {
    const inp = el('<input type="search" class="lf-q" placeholder="🔍 さがす（例：茶、ペスト、1600）">');
    inp.value = st.q;
    inp.addEventListener('input', () => { st.q = inp.value.trim(); save(); });
    bar.appendChild(inp);
  }
  const sel = (field, items, label) => {
    const s = el(`<select aria-label="${label}">${items.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`);
    s.value = st[field] || '';
    s.classList.toggle('on', !!st[field] && field !== 'sort');
    s.addEventListener('change', () => { st[field] = s.value; s.classList.toggle('on', !!s.value && field !== 'sort'); save(); });
    bar.appendChild(s);
  };
  if (opts.storyKinds && st.skind === 'term') sel('tcat', [['', '分類：すべて'], ...TERM_STORY_CAT.filter(c => STORIES.some(s => s.tcat === c)).map(c => [c, (TERM_STORY_ICON[c] || '') + ' ' + c])], '用語の分類');
  if (opts.storyKinds && st.skind === 'theme') sel('theme', [['', 'テーマ：すべて'], ...Object.entries(THEME_NAME).filter(([k]) => STORIES.some(s => s.theme === k))], 'テーマ');
  sel('region', [['', '地域：すべて'], ...REGIONS.map(r => [r.id, r.name])], '地域');
  sel('era', [['', '時代：すべて'], ...ERA_BINS.map(b => [b[2], b[2]])], '時代');
  if (opts.kinds) sel('kind', [['', '種類：すべて'], ...Object.entries(KIND)], '種類');
  if (opts.kinds) { const cs = [...new Set(EVENTS.filter(e => !st.era || eraOf(e.year) === st.era).map(e => centOf(e.year)))].sort((a, b) => a - b); sel('cent', [['', '世紀：すべて'], ...cs.map(c => [String(c), centLabel(c)])], '世紀'); }
  sel('course', [['', '科目：すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']], '科目');
  sel('sort', [['year', '古い順'], ['year-desc', '新しい順'], ['region', '地域ごと']], '並べかえ');
  box.appendChild(bar);
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
    listFilters(f, 'storyFilter', { storyKinds: true, search: true }, st => {
      const ss = STORIES.filter(s => (!st.skind || storyKind(s) === st.skind) && (!st.theme || s.theme === st.theme) && (!st.tcat || s.tcat === st.tcat) && (!st.q || (s.title + (s.term || '') + (s.summary || '')).includes(st.q)) && (!st.region || s.region === st.region) && (!st.era || eraOf(s.steps[0].year) === st.era) && (!st.course || (s.tags || []).includes(st.course)));
      const qHit = s => st.q && (s.title + (s.term || '')).includes(st.q) ? 1 : 0;
      ss.sort((a, b) => (qHit(b) - qHit(a)) || (st.sort === 'region' ? regionIndex(a.region) - regionIndex(b.region) || a.steps[0].year - b.steps[0].year : (st.sort === 'year-desc' ? -1 : 1) * (a.steps[0].year - b.steps[0].year)));
      cnt.textContent = `${ss.length}本`;
      grid.innerHTML = '';
      let lastHead = '', shown = 0;
      // 一度に全部は並べない（スマホで重く・長くなりすぎるので）。下まで見たら続きを足す
      const PAGE = 48, seenAll = store.get('storySeen', {});
      const more = el('<button type="button" class="btn" style="display:block;margin:14px auto;grid-column:1/-1">もっと見る</button>');
      const addPage = () => { more.remove(); ss.slice(shown, shown + PAGE).forEach(card); shown += PAGE; if (shown < ss.length) { more.textContent = `もっと見る（あと ${ss.length - shown} 本）`; grid.appendChild(more); io.observe(more); } };
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); addPage(); } }, { rootMargin: '600px' });
      more.addEventListener('click', addPage);
      function card(s) {
        const head = st.q && qHit(s) ? '題名に「' + st.q + '」' : st.sort === 'region' ? (REGION[s.region] || {}).name : eraOf(s.steps[0].year);
        if (head !== lastHead) { grid.appendChild(el(`<h3 class="lf-head">${esc(head || '')}</h3>`)); lastHead = head; }
        const col = (REGION[s.region] || {}).color || '#555';
        const talk = s.steps.some(x => x.talk);
        const seen = seenAll[s.id];
        grid.appendChild(el(`<a class="pcard" style="--c:${col};text-decoration:none;color:inherit" href="#story/${esc(s.id)}/1">
          ${thumbHtml(`story:${s.id}:1`)}
          ${seen ? `<span class="seen${seen.done ? ' done' : ''}">${seen.done ? '✓ 見た' : `${seen.n}/${s.steps.length}`}</span>` : ''}<b>${storyKind(s) === 'person' ? '👤' : storyKind(s) === 'theme' ? '🧭' : storyKind(s) === 'term' ? (TERM_STORY_ICON[s.tcat] || '📘') : '▶'} ${esc(s.title)}</b>
          <span class="m">${esc(STORY_KIND[storyKind(s)])}${s.theme ? '（' + esc(THEME_NAME[s.theme] || '') + '）' : ''}${s.tcat ? '（' + esc(s.tcat) + '）' : ''}・${esc(s.period || '')}・${s.steps.length}場面・${esc((REGION[s.region] || {}).name || '')}${talk ? '・🎙 語りつき' : ''}</span>
          <span class="t">${esc(s.summary || '')}</span>
        </a>`));
      }
      addPage();
      if (!ss.length) grid.appendChild(el('<p class="empty">この条件の物語はありません。</p>'));
    });
  }
});

// 出来事の一覧
registerTool('events', {
  name: '出来事',
  render(main) {
    main.appendChild(el(`<div class="course-head"><h2>出来事の一覧</h2><div class="muted" style="font-size:13px">おすと地図が開きます（💡＝ここがおもしろい）</div></div>`));
    const f = el('<div class="lf" style="max-width:1100px;margin:0 auto 10px"></div>');
    const cnt = el('<div class="muted" style="max-width:1100px;margin:0 auto 6px;font-size:13px"></div>');
    const list = el('<div class="evlist" style="max-width:1100px;margin:0 auto"></div>');
    const more = el('<button type="button" class="btn" style="display:block;margin:12px auto">もっと見る</button>');
    main.appendChild(f); main.appendChild(cnt); main.appendChild(list); main.appendChild(more);
    let rows = [], shown = 0, sortMode = 'year', lastHead = '';
    const PAGE = 150;
    function renderMore() {
      rows.slice(shown, shown + PAGE).forEach(({ e, i }) => {
        const head = sortMode === 'region' ? (REGION[e.region] || {}).name : e.year < -3000 ? '先史（地図は前3000年から）' : `${eraOf(e.year)}・${centLabel(centOf(e.year))}`;   // 世紀ごとに見出し
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
      rows = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => (!st.region || e.region === st.region) && (!st.era || eraOf(e.year) === st.era) && (!st.course || (e.tags || []).includes(st.course)) && (!st.kind || e.kind === st.kind) && (!st.cent || centOf(e.year) === +st.cent) && (!st.q || (/^\d{2,4}$/.test(st.q) ? (e.year >= +st.q && e.year < +st.q + 100) : (e.title + (e.text || '') + (e.place || '') + (EVENT_FUN[e.title] || '')).includes(st.q))));   // 数字なら、その年から100年
      rows.sort((a, b) => st.sort === 'region' ? regionIndex(a.e.region) - regionIndex(b.e.region) || a.e.year - b.e.year : (st.sort === 'year-desc' ? -1 : 1) * (a.e.year - b.e.year));
      cnt.textContent = `${rows.length}件`;
      list.innerHTML = ''; shown = 0; sortMode = st.sort; lastHead = '';
      renderMore();
    });
  }
});
