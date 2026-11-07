/* 人物のくわしいプロフィール（「📖 もっと詳しく」）。画面いっぱいに開く読みもの */
function hasProfile(id) { return !!PERSON_DETAIL[id]; }
function profileBtn(id, label = '📖 もっと詳しく') {
  const b = el(`<button type="button" class="btn primary profbtn">${label}</button>`);
  b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openProfile(id); });
  return b;
}
function openProfile(id) {
  const p = PERSON[id], d = PERSON_DETAIL[id];
  if (!p || !d) return;
  const reg = REGION[p.region];
  const ph = PORTRAITS[p.id];
  const mid = fixYear(Math.round((p.born + p.died) / 2));
  const ov = el(`<div class="prof-ov" role="dialog" aria-label="${esc(p.name)}のくわしいプロフィール">
    <article class="prof">
      <button type="button" class="prof-x" aria-label="とじる">✕</button>
      <header class="prof-head" style="--c:${reg ? reg.color : '#555'}">
        ${portraitImg(p, 'profimg')}
        <div>
          <div class="muted" style="font-size:13px">${esc(reg ? reg.name : '')}・${esc(p.role || '')}</div>
          <h2>${esc(p.name)}</h2>
          <div class="muted">${esc(p.kana || '')}　<span class="num">${esc(lifeSpan(p))}</span></div>
          <p class="prof-catch">${esc(d.catch || '')}</p>
          <div class="prof-btns"></div>
        </div>
      </header>
      ${ph ? `<div class="credit" style="padding:0 20px">肖像：${esc(ph.what || '')}・${esc(ph.license || '')}・<a href="${esc(ph.page || '#')}" target="_blank" rel="noopener">ウィキメディア・コモンズ</a></div>` : ''}
      <div class="prof-body">
        <section class="prof-story">${(d.story || []).map(t => `<p>${linkTerms(t, p.name)}</p>`).join('')}</section>
        ${d.quote ? `<blockquote class="prof-quote">「${esc(d.quote.text)}」<cite>${esc(d.quote.note || '')}</cite></blockquote>` : ''}
        ${(d.episodes || []).length ? `<h3>エピソード</h3><div class="prof-eps">${d.episodes.map(e => `<div class="prof-ep">${e.legend ? '<span class="leg">言い伝え</span>' : /といわれ|と言われ|と伝え|という説|諸説|かもしれ|らしい/.test(e.text) ? '<span class="maybe">諸説あり</span>' : '<span class="fact">史実</span>'}<b>${esc(e.title)}</b><p>${esc(e.text)}</p></div>`).join('')}</div>` : ''}
        ${figureHtml('person:' + p.id, 2)}
        ${d.legacy ? `<h3>その後の世界への影響</h3><p>${esc(d.legacy)}</p>` : ''}
        ${(d.life || []).length ? `<h3>年表</h3><ol class="prof-life">${d.life.map(l => `<li><b class="num">${esc(yearLabel(l.year))}</b><span>${esc(l.text)}</span></li>`).join('')}</ol>` : ''}
        ${(d.terms || p.keys || []).length ? `<h3>重要語句</h3><div class="keys">${(d.terms || p.keys).map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        <h3>同じ時代を生きた人物</h3><ul class="lst prof-same"></ul>
      </div>
    </article>
  </div>`);
  const close = () => { SPEECH.stop(); ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('.prof-x', ov).addEventListener('click', close);
  const bt = $('.prof-btns', ov);
  bt.appendChild(speakBtn(() => `${p.name}。${d.catch || ''}。` + (d.story || []).join('。'), '🔊 読み上げ'));
  const life = lifeStoryOf(p.id);
  // 物語がまだ読みこまれていなければ、読んでからボタンを足す
  if (!life && !STORIES.length && window.ensureStories) ensureStories().then(() => { const l2 = lifeStoryOf(p.id); if (l2 && ov.isConnected) { const la = el(`<a class="chip" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)" href="#story/${esc(l2.id)}/1">👤 生涯を物語でたどる</a>`); la.addEventListener('click', close); bt.insertBefore(la, bt.children[1] || null); } });
  if (life) { const la = el(`<a class="chip" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)" href="#story/${esc(life.id)}/1">👤 生涯を物語でたどる</a>`); la.addEventListener('click', close); bt.appendChild(la); }
  const mapA = el(`<a class="chip" href="${mapHash(mid, REGION_VIEW_OF[p.region] || 'world', 'p:' + p.id)}">🗺 地図で足あと</a>`);
  mapA.addEventListener('click', close);
  bt.appendChild(mapA);
  const same = $('.prof-same', ov);
  PEOPLE.filter(q => q !== p && q.born < p.died && q.died > p.born).sort((a, b) => Math.abs(a.born - p.born) - Math.abs(b.born - p.born)).slice(0, 8).forEach(q => {
    const li = el(`<li><button type="button">${portraitImg(q)}<span><b>${esc(q.name)}</b> <span class="muted" style="font-size:12.5px">${esc((REGION[q.region] || {}).name || '')}・${esc(q.role || '')}</span></span><span class="yrs">${esc(lifeSpan(q))}</span>${hasProfile(q.id) ? '<span class="chip" style="margin-left:6px">📖</span>' : ''}</button></li>`);
    li.firstChild.addEventListener('click', () => { if (hasProfile(q.id)) { close(); openProfile(q.id); } else { close(); location.hash = mapHash(fixYear(Math.round((q.born + q.died) / 2)), REGION_VIEW_OF[q.region] || 'world', 'p:' + q.id); } });
    same.appendChild(li);
  });
  document.body.appendChild(ov);
  $('.prof-x', ov).focus({ preventScroll: true });
}
