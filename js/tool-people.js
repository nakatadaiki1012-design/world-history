/* 人物図鑑：地域・科目・名前でしぼりこみ。カードをおすと地図で足あとを見る */
registerTool('people', {
  name: '人物図鑑',
  render(main) {
    const wrap = el(`<div>
      <div class="filters">
        <input type="search" placeholder="名前・ことばでさがす（例：唐、仏教）" aria-label="さがす">
        <span class="regs" style="display:contents"></span>
        <select aria-label="科目" class="chip" style="padding:4px 8px"><option value="">科目：すべて</option><option value="sogo">歴史総合</option><option value="tankyu">世界史探究</option></select>
        <span class="muted cnt" style="font-size:13px"></span>
      </div>
      <div class="pgrid"></div>
    </div>`);
    main.appendChild(wrap);
    const q = $('input', wrap), regs = $('.regs', wrap), course = $('select', wrap), grid = $('.pgrid', wrap), cnt = $('.cnt', wrap);
    let reg = store.get('peopleReg', '');
    const all = el(`<button type="button" class="chip">すべて</button>`);
    regs.appendChild(all);
    all.addEventListener('click', () => { reg = ''; upd(); });
    REGIONS.filter(r => PEOPLE.some(p => p.region === r.id)).forEach(r => {
      const b = el(`<button type="button" class="chip" data-r="${r.id}"><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</button>`);
      b.addEventListener('click', () => { reg = reg === r.id ? '' : r.id; upd(); });
      regs.appendChild(b);
    });
    q.addEventListener('input', () => list());
    course.addEventListener('change', () => list());
    function upd() {
      store.set('peopleReg', reg);
      $$('button', regs).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.r || '') === reg)));
      list();
    }
    function list() {
      const s = q.value.trim();
      const c = course.value;
      const ps = PEOPLE.filter(p => (!reg || p.region === reg) && (!c || (p.tags || []).includes(c)) &&
        (!s || [p.name, p.kana, p.role, p.text, (p.keys || []).join(' '), p.polity && POLITY[p.polity] ? POLITY[p.polity].name : ''].join(' ').includes(s)));
      // 名前やよみに入っているものを先に（説明に出てくるだけの人はあと）
      if (s) ps.sort((a, b) => ((b.name + (b.kana || '')).includes(s) - (a.name + (a.kana || '')).includes(s)));
      cnt.textContent = `${ps.length}人`;
      grid.innerHTML = '';
      if (!ps.length) grid.appendChild(el('<p class="empty">見つかりませんでした。</p>'));
      ps.forEach(p => {
        const c = (REGION[p.region] || {}).color || '#555';
        const mid = Math.round((p.born + p.died) / 2);
        const pl = GEO.placeAt(p, mid) || (p.places || [])[0];
        const a = el(`<a class="pcard" style="--c:${c};text-decoration:none;color:inherit" href="${mapHash(fixYear(mid), REGION_VIEW[p.region] || 'world', 'p:' + p.id)}">
          <span>${portraitImg(p)}<b>${esc(p.name)}</b></span>
          <span class="m">${esc(p.role || '')}・<span class="num">${esc(lifeSpan(p))}</span></span>
          <span class="t">${esc(p.text || '')}</span>
          ${hasProfile(p.id) ? '<button type="button" class="pbadge">📖 もっと詳しく</button>' : ''}
          <span class="m">📍 ${esc((p.places || []).map(x => x.name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(' → '))}</span>
        </a>`);
        const pb = a.querySelector('.pbadge'); if (pb) pb.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openProfile(p.id); });
        grid.appendChild(a);
      });
    }
    upd();
  }
});
