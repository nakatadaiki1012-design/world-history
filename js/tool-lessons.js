/* 授業モード：歴史総合・世界史探究。左に説明、右に年代のツマミつきの地図 */
registerTool('lessons', {
  name: '授業',
  render(main, params) {
    const course = params.course === 'tankyu' ? 'tankyu' : 'sogo';
    const ls = LESSONS.filter(l => l.course === course);
    const done = store.get('done', {});
    if (params.lesson) {
      const i = ls.findIndex(l => l.id === params.lesson);
      if (i >= 0) return lessonPage(main, ls, i, done);
    }
    // 一覧（大項目ごとにたたむ。次に学ぶ大項目だけ開く）
    main.appendChild(el(`<div class="course-head"><h2>${COURSE[course]}</h2><div class="muted" style="font-size:13.5px">学習指導要領の項目の順に ${ls.length} 回。授業をえらぶと、説明と地図（年代のツマミつき）が並んで出ます。</div></div>`));
    if (!ls.length) { main.appendChild(el('<p class="empty">授業のデータがまだありません。</p>')); return; }
    const units = [];
    ls.forEach(l => { let u = units.find(u => u.name === l.unit); if (!u) units.push(u = { name: l.unit, items: [] }); u.items.push(l); });
    const firstOpen = units.find(u => u.items.some(l => !done[l.id])) || units[0];
    const box = el('<div class="units"></div>');
    let n = 0;
    units.forEach(u => {
      const d = u.items.filter(l => done[l.id]).length;
      const det = el(`<details class="unit card"${u === firstOpen ? ' open' : ''}><summary>${esc(u.name)}<span class="prog">${d} / ${u.items.length}</span></summary><ol></ol></details>`);
      u.items.forEach(l => {
        n++;
        const b = el(`<li><button type="button" class="${done[l.id] ? 'done' : ''}"><span class="n">${String(n).padStart(2, '0')}</span><span>${esc(l.title)}</span><span class="s">${esc(l.sub || '')}</span></button></li>`);
        b.firstChild.addEventListener('click', () => { location.hash = `#lessons/${course}/${l.id}`; });
        $('ol', det).appendChild(b);
      });
      box.appendChild(det);
    });
    main.appendChild(box);
  }
});

function lessonPage(main, ls, i, done) {
  const l = ls[i];
  const wrap = el(`<div class="lesson"><div class="lesson-text card"></div><div class="lmap" style="display:flex;min-height:0"></div></div>`);
  main.appendChild(wrap);
  const tx = $('.lesson-text', wrap);
  const m0 = (l.maps || [])[0] || { year: 1800, view: 'world' };
  const map = createHistMap($('.lmap', wrap), { year: m0.year, view: m0.view });
  map.root.style.flex = '1';
  tx.innerHTML = `
    <div class="crumb"><a href="#lessons/${l.course}" style="color:inherit">${esc(COURSE[l.course])}</a> ＞ ${esc(l.unit)} ${esc(l.sub || '')}</div>
    <h2>${esc(l.title)}</h2>
    <div class="q">問い：${esc(l.question || '')}</div>
    <div class="mapbtns"></div>
    ${(l.body || []).map((b, k) => `<h3>${esc(b.h)}</h3><p>${linkTerms(b.p)}</p>${k === 0 ? figureHtml('lesson:' + l.id, 1) : ''}`).join('')}
    ${(IMAGES['lesson:' + l.id] || []).length > 1 ? `<h3>資料</h3><div class="figs">${figureHtml('lesson:' + l.id, 4).split('</figure>').slice(1).join('</figure>')}</div>` : ''}
    ${l.terms && l.terms.length ? `<h3>重要語句</h3><div class="keys">${l.terms.map(t => TERM[t] ? `<a class="term" data-term="${esc(t)}" href="#term/${encodeURIComponent(t)}"><span>${esc(t)}</span></a>` : `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    ${l.think ? `<div class="think"><b>考えよう</b><br>${esc(l.think)}</div>` : ''}
    <h3>確認問題</h3><div class="lqs"></div>
    <div class="lesson-nav"></div>`;
  // 読み上げ（題・問い・説明）
  tx.insertBefore(speakBtn(() => `${l.title}。問い。${l.question || ''}。` + (l.body || []).map(b => `${b.h}。${b.p}`).join('。'), '🔊 この授業を読み上げ'), $('.q', tx));
  // 地図ボタン
  const mb = $('.mapbtns', tx);
  (l.maps || []).forEach((m, k) => {
    const b = el(`<button type="button" class="chip${k === 0 ? ' on' : ''}">🗺 ${esc(m.label || yearLabel(m.year))}</button>`);
    b.addEventListener('click', () => { $$('button', mb).forEach(x => x.classList.remove('on')); b.classList.add('on'); map.setView(m.view); map.setYear(m.year); });
    mb.appendChild(b);
  });
  const big = el(`<a class="chip" href="${mapHash(m0.year, m0.view)}">⤢ 大きな地図で</a>`);
  big.addEventListener('click', () => { big.href = mapHash(map.year, map.view); });
  mb.appendChild(big);
  // 確認問題
  const qbox = $('.lqs', tx);
  let right = 0, answered = 0;
  (l.quiz || []).forEach((q, k) => {
    const c = el(`<div class="card lq"><div style="font-weight:700">${k + 1}．${esc(q.q)}</div><div class="qchoices" style="margin-top:6px"></div><div class="r"></div></div>`);
    const ch = $('.qchoices', c);
    q.c.forEach((t, j) => {
      const b = el(`<button type="button">${'アイウエ'[j]}．${esc(t)}</button>`);
      b.addEventListener('click', () => {
        if (ch.dataset.done) return; ch.dataset.done = '1';
        answered++; if (j === q.a) right++;
        $$('button', ch).forEach((x, n) => { if (n === q.a) x.classList.add('ok'); else if (n === j) x.classList.add('ng'); });
        $('.r', c).appendChild(el(`<div class="qres"><span class="mark" style="color:${j === q.a ? 'var(--ok)' : 'var(--ng)'}">${j === q.a ? '◯' : '✕'}</span>${esc(q.exp || '')}</div>`));
        if (answered === l.quiz.length) {
          done[l.id] = { right, n: answered }; store.set('done', done);
          qbox.appendChild(el(`<p style="font-weight:700">${right} / ${answered} 問正解。${right === answered ? 'この授業は ✓ クリア！' : ''}</p>`));
        }
      });
      ch.appendChild(b);
    });
    qbox.appendChild(c);
  });
  // 前後
  const nav = $('.lesson-nav', tx);
  const prev = ls[i - 1], next = ls[i + 1];
  nav.appendChild(prev ? el(`<a class="btn" style="text-decoration:none" href="#lessons/${l.course}/${prev.id}">← ${esc(prev.title)}</a>`) : el('<span></span>'));
  nav.appendChild(next ? el(`<a class="btn primary" style="text-decoration:none" href="#lessons/${l.course}/${next.id}">${esc(next.title)} →</a>`) : el(`<a class="btn" style="text-decoration:none" href="#lessons/${l.course}">一覧へ</a>`));
  return () => { SPEECH.stop(); map.destroy(); };
}
