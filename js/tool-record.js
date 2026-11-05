/* 学習の記録：見た物語・覚えた用語・終えた授業・クイズの点数をまとめて見る（記録はこの端末のブラウザの中だけ） */
registerTool('record', {
  name: '学習の記録',
  render(main) {
    const seen = store.get('storySeen', {}), ok = store.get('termOk', {}), done = store.get('done', {});
    const hist = store.get('quizHist', []), wrong = store.get('wrongQ', []);
    const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
    const tile = (label, a, b, note) => `<div class="rec-tile"><div class="muted" style="font-size:12.5px">${label}</div><div class="big">${a}<small class="muted" style="font-size:14px"> / ${b}</small></div><div class="bar"><i style="width:${pct(a, b)}%"></i></div>${note ? `<div class="muted" style="font-size:12px;margin-top:4px">${note}</div>` : ''}</div>`;
    // 物語（種類ごと）
    const kinds = [['event', '🗺 できごと'], ['person', '👤 人物'], ['theme', '🧭 テーマ'], ['term', '📘 用語']];
    const doneIds = new Set(Object.keys(seen).filter(k => seen[k].done));
    const t3 = GLOSSARY.filter(g => (g.rank || 1) >= 3), ok3 = t3.filter(g => ok[g.term]).length;
    const qn = hist.filter(h => !h.review), avg = qn.length ? Math.round(qn.reduce((a, h) => a + h.score / h.n, 0) / qn.length * 100) : 0;
    const box = el(`<div class="rec">
      <div class="course-head"><h2>📊 学習の記録</h2><div class="muted" style="font-size:13.5px">この端末のブラウザに保存されています（ほかの人には見えません）。</div></div>
      <div class="rec-tiles">
        ${tile('最後まで見た物語', doneIds.size, STORIES.length)}
        ${tile('覚えた用語（★★★）', ok3, t3.length, `すべての用語では ${Object.keys(ok).length} / ${GLOSSARY.length}`)}
        ${tile('終えた授業', Object.keys(done).length, LESSONS.length)}
        ${(() => { const C = store.get('cardBox', {}), now = Date.now(), dueN = Object.values(C).filter(o => o.due <= now).length; return `<div class="rec-tile"><div class="muted" style="font-size:12.5px">🃏 暗記カード</div><div class="big">${Object.keys(C).length}<small class="muted" style="font-size:14px"> 枚 学習</small></div><div class="muted" style="font-size:12.5px">今日の復習 ${dueN} 枚</div><a class="btn" style="margin-top:6px;text-decoration:none;display:inline-block" href="#cards">カードを開く</a></div>`; })()}
        <div class="rec-tile"><div class="muted" style="font-size:12.5px">クイズ</div><div class="big">${qn.length}<small class="muted" style="font-size:14px"> 回</small></div><div class="muted" style="font-size:12.5px">平均の正答率 ${avg}%</div>${wrong.length ? `<a class="btn" style="margin-top:6px;text-decoration:none;display:inline-block" href="#quiz/review">📝 復習 ${wrong.length}問</a>` : ''}</div>
      </div>
      <div class="card"><h3 style="margin-top:0">物語の種類ごと</h3><div class="rec-tiles kinds"></div></div>
      <div class="card"><h3 style="margin-top:0">クイズの点数（最近 30 回）</h3><div class="rec-quiz"></div><div class="muted" style="font-size:12px">棒の高さが正答率。<span style="color:var(--ai)">■</span> は復習。</div></div>
      <div class="card cont"><h3 style="margin-top:0">▶ つづきから</h3><ul class="lst"></ul></div>
      <div class="card next"><h3 style="margin-top:0">✏ 次に覚えたい用語（★★★）</h3><div class="keys"></div></div>
      <div style="text-align:right"><button type="button" class="btn reset" style="font-size:13px">記録を消す</button></div>
    </div>`);
    main.appendChild(box);
    const kb = $('.kinds', box);
    kinds.forEach(([k, n]) => { const all = STORIES.filter(s => storyKind(s) === k); kb.insertAdjacentHTML('beforeend', tile(n, all.filter(s => doneIds.has(s.id)).length, all.length)); });
    const qb = $('.rec-quiz', box);
    const last = hist.slice(-30);
    if (!last.length) qb.outerHTML = '<p class="muted">まだクイズの記録がありません。<a href="#quiz">クイズに挑戦</a></p>';
    else last.forEach(h => qb.appendChild(el(`<i class="${h.review ? 'rv' : ''}" style="height:${Math.max(3, h.score / h.n * 100)}%" title="${new Date(h.t).toLocaleDateString('ja-JP')}：${h.score}/${h.n}"></i>`)));
    // とちゅうまで見た物語（新しい順）
    const cont = Object.entries(seen).filter(([id, o]) => !o.done && STORY[id]).sort((a, b) => b[1].t - a[1].t).slice(0, 8);
    const cu = $('.cont ul', box);
    if (!cont.length) $('.cont', box).insertAdjacentHTML('beforeend', '<p class="muted" style="margin:0">とちゅうの物語はありません。<a href="#stories">物語を見る</a></p>');
    cont.forEach(([id, o]) => { const s = STORY[id]; cu.appendChild(el(`<li><a href="#story/${esc(id)}/${Math.min(o.n + 1, s.steps.length)}"><b>${esc(s.title)}</b> <span class="muted">${o.n}/${s.steps.length} 場面まで</span></a></li>`)); });
    // まだ覚えていない ★★★ の用語から（物語のある語を優先）
    const notYet = shuffle(t3.filter(g => !ok[g.term]));
    notYet.sort((a, b) => (termStoryOf(b.term) ? 1 : 0) - (termStoryOf(a.term) ? 1 : 0));
    const nx = $('.next .keys', box);
    if (!notYet.length) nx.innerHTML = '<p>★★★ の用語は全部「覚えた」です！</p>';
    notYet.slice(0, 12).forEach(g => nx.appendChild(el(`<a class="term chip" data-term="${esc(g.term)}" href="#term/${encodeURIComponent(g.term)}">${termStoryOf(g.term) ? '▶ ' : ''}${esc(g.term)}</a>`)));
    $('.reset', box).addEventListener('click', () => {
      if (!confirm('物語・クイズ・まちがえた問題の記録を消します。「覚えた用語」と「終えた授業」は残ります。よろしいですか？')) return;
      ['storySeen', 'quizHist', 'wrongQ', 'quizBest'].forEach(k => store.set(k, k === 'storySeen' ? {} : k === 'quizBest' ? {} : []));
      location.hash = '#record'; route();
    });
  }
});
