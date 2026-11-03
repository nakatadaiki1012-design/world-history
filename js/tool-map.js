/* 歴史地図の画面：左に地図と年代のツマミ、右に「この年のようす」と、えらんだ国・人物・出来事の説明 */
registerTool('map', {
  name: '歴史地図',
  render(main, params) {
    const wrap = el(`<div class="mapview"><div class="mapbox" style="display:flex;min-height:0"></div><aside class="side"><div class="tabs" role="tablist"></div><div class="side-body"></div></aside></div>`);
    main.appendChild(wrap);
    const box = $('.mapbox', wrap), tabs = $('.tabs', wrap), body = $('.side-body', wrap);
    let tab = store.get('mapTab', 'year');
    const year0 = params.year != null ? params.year : store.get('year', 750);
    const view0 = params.view || store.get('view', 'world');
    const map = createHistMap(box, {
      year: year0, view: view0,
      onYear: y => { store.set('year', y); syncHash(); renderSide(); },
      onView: v => { store.set('view', v); syncHash(); renderSide(); },
      onSelect: () => { syncHash(); renderSide(); }
    });
    map.root.style.flex = '1';

    // アドレス（# のあと）を今の場面に。コピーして送れば同じ場面が開ける
    function syncHash() {
      if (story && !story.generated) { history.replaceState(null, '', `#story/${story.id}/${si + 1}`); return; }
      if (story) { history.replaceState(null, '', mapHash(map.year, map.view)); return; }
      const s = map.sel;
      const extra = !s ? '' : s.type === 'person' ? 'p:' + s.id : s.type === 'polity' ? 's:' + s.id : 'e:' + s.id;
      history.replaceState(null, '', mapHash(map.year, map.view, extra));
    }

    const TABS = [['year', 'この年'], ['people', '人物'], ['events', '出来事'], ['stories', '▶ 物語'], ['help', '使い方']];
    function renderTabs(detail) {
      tabs.innerHTML = '';
      if (detail) return;
      TABS.forEach(([k, n]) => {
        const b = el(`<button type="button" role="tab" aria-selected="${k === tab}">${n}</button>`);
        b.addEventListener('click', () => { tab = k; store.set('mapTab', k); renderSide(); });
        tabs.appendChild(b);
      });
    }

    let timer = null;
    function renderSide() {
      clearTimeout(timer);
      timer = setTimeout(renderSideNow, 40);
    }
    function renderSideNow() {
      const s = map.sel;
      renderTabs(!!s || !!story);
      body.innerHTML = '';
      if (story) return storyPanel();
      if (s && s.type === 'polity' && POLITY[s.id]) return polityDetail(POLITY[s.id]);
      if (s && s.type === 'person' && PERSON[s.id]) return personDetail(PERSON[s.id]);
      if (s && s.type === 'event' && EVENTS[s.id]) return eventDetail(EVENTS[s.id]);
      if (tab === 'year') yearTab();
      else if (tab === 'people') peopleTab();
      else if (tab === 'events') eventsTab();
      else if (tab === 'stories') storiesTab();
      else helpTab();
    }

    function polityItem(p) {
      const b = el(`<li><button type="button"><span class="sw" style="background:${esc(p.color)}"></span>${esc(p.name)}<span class="yrs">${esc(span(p.start, p.end))}</span></button></li>`);
      b.firstChild.addEventListener('click', () => map.select({ type: 'polity', id: p.id }));
      return b;
    }
    function personItem(p, pl) {
      const c = (REGION[p.region] || {}).color || '#555';
      const b = el(`<li><button type="button">${PORTRAITS[p.id] ? portraitImg(p) : `<span class="dot" style="background:${c}"></span>`}<span><b>${esc(p.name)}</b> <span class="muted" style="font-size:12.5px">${esc(p.role || '')}${pl ? '・' + esc(pl.name) : ''}</span></span><span class="yrs">${esc(lifeSpan(p))}</span></button></li>`);
      b.firstChild.addEventListener('click', () => { map.select({ type: 'person', id: p.id }); });
      return b;
    }
    function eventItem(e, i) {
      const b = el(`<li><button type="button"><span class="sw" style="background:${KIND_COLOR[e.kind] || '#555'};transform:rotate(45deg);border-radius:2px"></span><span>${esc(e.title)}</span><span class="yrs">${esc(yearLabel(e.year))}</span></button></li>`);
      b.firstChild.addEventListener('click', () => { if (map.year !== e.year && Math.abs(map.year - e.year) > 3) map.setYear(e.year); map.select({ type: 'event', id: i }); map.focusOn(e.lon, e.lat); });
      return b;
    }

    function yearTab() {
      const y = map.year;
      body.appendChild(el(`<div><h2>${esc(yearLabel(y))}</h2><div class="muted">${esc(eraName(y))}</div></div>`));
      const vis = map.visiblePolities();
      if (!vis.length) { body.appendChild(el('<p class="empty">この範囲には、この年の国・王朝のデータがありません。年や見る範囲を変えてみましょう。</p>')); }
      REGIONS.forEach(r => {
        const ps = vis.filter(p => p.region === r.id).sort((a, b) => (a.rank || 2) - (b.rank || 2) || a.start - b.start);
        if (!ps.length) return;
        body.appendChild(el(`<h3>${esc(r.name)}</h3>`));
        const ul = el('<ul class="lst"></ul>'); ps.forEach(p => ul.appendChild(polityItem(p))); body.appendChild(ul);
      });
      const ppl = map.people();
      if (ppl.length) {
        body.appendChild(el(`<h3>この年に生きていた人物（${ppl.length}人）</h3>`));
        const ul = el('<ul class="lst"></ul>'); ppl.slice(0, 12).forEach(x => ul.appendChild(personItem(x.p, x.pl))); body.appendChild(ul);
        if (ppl.length > 12) { const m = el('<button type="button" class="backlink">すべて見る →</button>'); m.addEventListener('click', () => { tab = 'people'; renderSide(); }); body.appendChild(m); }
      }
      const evs = nearEvents(y, 6);
      if (evs.length) {
        body.appendChild(el('<h3>近い年の出来事</h3>'));
        const ul = el('<ul class="lst"></ul>'); evs.forEach(({ e, i }) => ul.appendChild(eventItem(e, i))); body.appendChild(ul);
      }
    }
    function nearEvents(y, n) {
      return EVENTS.map((e, i) => ({ e, i, d: Math.abs(e.year - y) })).sort((a, b) => a.d - b.d).slice(0, n).sort((a, b) => a.e.year - b.e.year);
    }
    function peopleTab() {
      const y = map.year;
      const ppl = map.people();
      body.appendChild(el(`<p class="muted" style="font-size:13px">${esc(yearLabel(y))}に生きていた人物です。名前をおすと、一生の足あとが地図に出ます。</p>`));
      if (!ppl.length) body.appendChild(el('<p class="empty">この年に生きていた人物は、まだデータにありません。</p>'));
      REGIONS.forEach(r => {
        const ps = ppl.filter(x => x.p.region === r.id); if (!ps.length) return;
        body.appendChild(el(`<h3>${esc(r.name)}</h3>`));
        const ul = el('<ul class="lst"></ul>'); ps.forEach(x => ul.appendChild(personItem(x.p, x.pl))); body.appendChild(ul);
      });
      // 少しあとに生まれる人・少し前に亡くなった人
      const soon = PEOPLE.filter(p => p.born > y).slice(0, 5);
      if (soon.length) {
        body.appendChild(el('<h3>このあと生まれる人物</h3>'));
        const ul = el('<ul class="lst"></ul>'); soon.forEach(p => ul.appendChild(personItem(p))); body.appendChild(ul);
      }
    }
    function eventsTab() {
      const y = map.year;
      body.appendChild(el(`<p class="muted" style="font-size:13px">${esc(yearLabel(y))}の前後の出来事です。◆の色：<span style="color:${KIND_COLOR.politics}">政治</span>・<span style="color:${KIND_COLOR.war}">戦争</span>・<span style="color:${KIND_COLOR.culture}">文化・宗教</span>・<span style="color:${KIND_COLOR.economy}">経済・交易</span>・<span style="color:${KIND_COLOR.society}">社会</span></p>`));
      const ul = el('<ul class="lst"></ul>');
      nearEvents(y, 24).forEach(({ e, i }) => ul.appendChild(eventItem(e, i)));
      body.appendChild(ul);
    }
    function helpTab() {
      body.appendChild(el(`<div>
        <h2>使い方</h2>
        <p><b>下のツマミ</b>を左右に動かすと年が変わり、地図の国・王朝、都（■）、人物（●）、出来事（◆）が変わります。</p>
        <p><b>斜線（▨）</b>は、直接は支配していないが影響がおよんだ範囲（朝貢・冊封、宗主権、勢力範囲、陣営）です。右上の <b>⚙</b>（表示の設定）で、勢力圏・都・人物・出来事・現在の国境を出す／出さないや、再生の速さを変えられます。</p>
        <p><b>▶</b> で自動で年が進みます。右はしの年をおすと、年を入力できます（例：<span class="num">前221</span>、<span class="num">1453</span>）。</p>
        <p>地図の<b>色のついた国・王朝</b>や<b>人物</b>をおすと、右に説明が出ます。人物をえらぶと、一生の<b>足あと</b>が点線で出ます。</p>
        <p>左下のボタンで<b>見る範囲</b>（東アジア・西アジア など）を切りかえ。指２本やマウスのホイールで拡大できます。</p>
        <p>アドレス（URL）に今の年と範囲が入るので、コピーして送ると同じ場面を開けます。</p>
        <h3>おことわり</h3>
        <p class="muted" style="font-size:13px">国・王朝の範囲は、教科書の地図をもとにした<b>おおよその範囲</b>です。前近代の国境は今のようにはっきりしたものではなく、支配のしかたも地域によってちがいました。範囲は陸地で切り抜いて表示しています。</p>
      </div>`));
    }

    function jumpBtns(pairs) {
      const d = el('<div class="keys" style="gap:6px"></div>');
      pairs.forEach(([label, fn]) => { const b = el(`<button type="button" class="chip">${label}</button>`); b.addEventListener('click', fn); d.appendChild(b); });
      return d;
    }
    function back() {
      const b = el('<button type="button" class="backlink">← この年の一覧へ</button>');
      b.addEventListener('click', () => map.select(null));
      return b;
    }
    // 「なぜ起きた？」と「その結果」
    function whyList(items, dir) {
      const ul = el('<ul class="why"></ul>');
      items.sort((a, b) => EVENTS[a.i].year - EVENTS[b.i].year).forEach(c => {
        const e = EVENTS[c.i];
        const li = el(`<li><button type="button"><span class="y">${esc(yearLabel(e.year))}</span><span class="k ${esc(c.kind)}">${esc(dir === 'up' ? (CAUSE_KIND[c.kind] || '原因') : '結果')}</span><b>${esc(e.title)}</b><span class="w">${esc(c.why || '')}</span></button></li>`);
        li.firstChild.addEventListener('click', () => { if (story) endStory(); map.setYear(e.year); map.select({ type: 'event', id: c.i }); map.flyTo(e.lon, e.lat, spanForEvent(e)); });
        ul.appendChild(li);
      });
      return ul;
    }
    function whySection(idx) {
      if (idx == null) return;
      const cs = causesOf(idx), rs = resultsOf(idx);
      if (cs.length) {
        body.appendChild(el('<h3>なぜ起きた？</h3>'));
        body.appendChild(whyList(cs, 'up'));
        const b = el('<button type="button" class="btn primary chainbtn">▶ 原因をさかのぼって地図でたどる</button>');
        b.addEventListener('click', () => startStory(chainStory(idx), 0));
        body.appendChild(b);
      }
      if (rs.length) {
        body.appendChild(el('<h3>その結果・影響</h3>'));
        body.appendChild(whyList(rs, 'down'));
      }
      if (!cs.length && !rs.length) body.appendChild(el('<p class="muted" style="font-size:13px">この出来事の原因・結果のつながりは、まだデータにありません。</p>'));
    }

    function polityDetail(p) {
      body.appendChild(back());
      const reg = REGION[p.region];
      body.appendChild(el(`<div>
        <div class="muted" style="font-size:13px"><span class="sw" style="background:${esc(p.color)}"></span> ${esc(reg ? reg.name : '')}</div>
        <h2>${esc(p.full || p.name)}</h2>
        <div class="num" style="font-weight:700">${esc(span(p.start, p.end))}</div>
        ${capitalText(p)}
        <p>${esc(p.text || '')}</p>
        ${p.keys && p.keys.length ? `<div class="keys">${p.keys.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        ${p.tags ? `<div class="muted" style="font-size:12.5px">${p.tags.map(t => COURSE[t]).filter(Boolean).join('・')}</div>` : ''}
        ${figureHtml('polity:' + p.id, 2)}
      </div>`));
      body.appendChild(jumpBtns([
        [`⏮ はじまり（${esc(yearLabel(p.start))}）`, () => map.setYear(p.start)],
        [`⏭ おわり（${esc(yearLabel(Math.min(p.end, YEAR_MAX)))}）`, () => map.setYear(Math.min(p.end, YEAR_MAX))]
      ]));
      if (p.spheres && p.spheres.length) {
        body.appendChild(el('<h3>勢力圏（地図の斜線）</h3>'));
        body.appendChild(jumpBtns(p.spheres.map(s => [`▨ ${esc(SPHERE_KIND[s.kind] || '勢力圏')}：${esc(s.name || '')}（${esc(yearLabel(s.from))}〜）`, () => map.setYear(s.from)])));
      }
      if (p.shapes && p.shapes.length > 1) {
        body.appendChild(el('<h3>範囲のうつりかわり</h3>'));
        body.appendChild(jumpBtns(p.shapes.map(s => [`${esc(yearLabel(s.from))}〜`, () => map.setYear(s.from)])));
      }
      const ppl = PEOPLE.filter(x => x.polity === p.id);
      if (ppl.length) {
        body.appendChild(el('<h3>関係する人物</h3>'));
        const ul = el('<ul class="lst"></ul>'); ppl.forEach(x => ul.appendChild(personItem(x))); body.appendChild(ul);
      }
      const evs = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => e.year >= p.start && e.year <= p.end && e.region === p.region).slice(0, 10);
      if (evs.length) {
        body.appendChild(el('<h3>この時代のこの地域の出来事</h3>'));
        const ul = el('<ul class="lst"></ul>'); evs.forEach(({ e, i }) => ul.appendChild(eventItem(e, i))); body.appendChild(ul);
      }
    }
    function capitalText(p) {
      if (p.capitals && p.capitals.length) return `<div style="font-size:14px">都：${p.capitals.map(c => `${esc(c.name)}<span class="muted num" style="font-size:12px">（${esc(yearLabel(c.from))}〜）</span>`).join('・')}</div>`;
      if (p.capital) return `<div style="font-size:14px">都：${esc(p.capital.name)}</div>`;
      return '';
    }
    function personDetail(p) {
      body.appendChild(back());
      const reg = REGION[p.region];
      const pol = p.polity && POLITY[p.polity];
      const ph = PORTRAITS[p.id];
      body.appendChild(el(`<div>
        ${portraitImg(p, 'bigimg')}
        <div class="muted" style="font-size:13px"><span class="dot" style="display:inline-block;background:${reg ? reg.color : '#555'}"></span> ${esc(reg ? reg.name : '')}・${esc(p.role || '')}</div>
        <h2>${esc(p.name)}</h2>
        <div class="muted" style="font-size:13px">${esc(p.kana || '')}</div>
        <div class="num" style="font-weight:700">${esc(lifeSpan(p))}</div>
        <p>${esc(p.text || '')}</p>
        ${p.keys && p.keys.length ? `<div class="keys">${p.keys.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        ${ph ? `<div class="credit">肖像：${esc(ph.what || '')}${ph.artist ? '（' + esc(ph.artist) + '）' : ''}・${esc(ph.license || '')}・<a href="${esc(ph.page || '#')}" target="_blank" rel="noopener">ウィキメディア・コモンズ</a></div>` : ''}
      </div>`));
      if (IMAGES['person:' + p.id]) body.appendChild(el(`<div>${figureHtml('person:' + p.id, 2)}</div>`));
      const pairs = [[`⏮ 生まれた年`, () => map.setYear(p.born)], [`⏭ 亡くなった年`, () => map.setYear(p.died)]];
      pairs.push([`▶ 一生をたどる`, () => playLife(p)]);
      if (pol) pairs.push([`${esc(pol.name)}を見る`, () => map.select({ type: 'polity', id: pol.id })]);
      body.appendChild(jumpBtns(pairs));
      body.appendChild(el('<h3>足あと（おすとその年へ）</h3>'));
      const cur = GEO.placeAt(p, clamp(map.year, p.born, p.died));
      const ol = el('<ol class="places"></ol>');
      (p.places || []).forEach(pl => {
        const li = el(`<li class="${pl === cur ? 'now' : ''}"><b>${esc(yearLabel(pl.from))}${pl.to !== pl.from ? '〜' + esc(yearLabel(pl.to)) : ''}</b>${esc(pl.name)}${pl.note ? `<div class="muted" style="font-size:12.5px">${esc(pl.note)}</div>` : ''}</li>`);
        li.addEventListener('click', () => { map.setYear(pl.from); map.focusOn(pl.lon, pl.lat); });
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }
    let lifeTimer = null;
    function playLife(p) {
      clearInterval(lifeTimer);
      map.stop();
      let y = p.born;
      const steps = p.places.map(pl => pl.from).concat([p.died]);
      const dur = p.died - p.born, inc = Math.max(1, Math.round(dur / 40));
      map.setYear(y);
      const first = p.places[0]; if (first) map.focusOn(first.lon, first.lat);
      lifeTimer = setInterval(() => {
        y = Math.min(p.died, y + inc);
        if (steps.some(s => s > y - inc && s <= y)) { const pl = GEO.placeAt(p, y); if (pl) map.focusOn(pl.lon, pl.lat); }
        map.setYear(y);
        if (!map.sel || map.sel.id !== p.id) map.select({ type: 'person', id: p.id });
        if (y >= p.died) clearInterval(lifeTimer);
      }, 160);
    }
    function eventDetail(e) {
      body.appendChild(back());
      const reg = REGION[e.region];
      body.appendChild(el(`<div>
        <div class="muted" style="font-size:13px"><span class="sw" style="background:${KIND_COLOR[e.kind] || '#555'};transform:rotate(45deg);border-radius:2px"></span> ${esc(KIND[e.kind] || '')}・${esc(reg ? reg.name : '')}</div>
        <h2>${esc(e.title)}</h2>
        <div class="num" style="font-weight:700">${esc(yearLabel(e.year))}${e.end && e.end !== e.year ? '〜' + esc(yearLabel(e.end)) : ''}　<span style="font-family:var(--font-body);font-weight:500">${esc(e.place || '')}</span></div>
        <p>${esc(e.text || '')}</p>
      </div>`));
      const idx = EVENT_IDX[e.title];
      body.appendChild(el(`<div>${figureHtml('event:' + e.title)}</div>`));
      body.appendChild(jumpBtns([[`この年へ（${esc(yearLabel(e.year))}）`, () => map.setYear(e.year)]]));
      whySection(idx);
      // その年に生きていた、近くの人物
      const near = PEOPLE.map(p => ({ p, pl: GEO.placeAt(p, e.year) })).filter(x => x.pl && d3.geoDistance([x.pl.lon, x.pl.lat], [e.lon, e.lat]) < 0.25);
      if (near.length) {
        body.appendChild(el('<h3>このころ近くにいた人物</h3>'));
        const ul = el('<ul class="lst"></ul>'); near.forEach(x => ul.appendChild(personItem(x.p, x.pl))); body.appendChild(ul);
      }
    }

    // --- 物語（1つのできごとを、地図を動かしながら順に追う） ---
    let story = null, si = 0, playing = false, stTimer = null;
    function storiesTab() {
      const y = map.year;
      body.appendChild(el(`<p class="muted" style="font-size:13px">1つのできごとを、地図を動かしながら順に追います。▶ をおすと自動で進みます。${esc(yearLabel(y))}に近いものから並んでいます。</p>`));
      const ul = el('<ul class="lst"></ul>');
      STORIES.slice().sort((a, b) => Math.abs(a.steps[0].year - y) - Math.abs(b.steps[0].year - y)).forEach(st => {
        const li = el(`<li><button type="button"><span class="sw" style="background:${(REGION[st.region] || {}).color || '#555'}"></span><span><b>${esc(st.title)}</b><br><span class="muted" style="font-size:12px">${esc(st.period || '')}・${st.steps.length}場面</span></span></button></li>`);
        li.firstChild.addEventListener('click', () => startStory(st, 0));
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    function startStory(st, i) {
      story = st; playing = true; map.stop(); map.select(null);
      goStep(i || 0, true);
    }
    function endStory() {
      clearTimeout(stTimer); story = null; playing = false;
      map.setStory(null); syncHash(); renderSide();
    }
    function goStep(i, first) {
      clearTimeout(stTimer);
      si = clamp(i, 0, story.steps.length - 1);
      const s = story.steps[si];
      map.setYear(s.year);
      map.setStory(s);
      // 場面が今の地域の外なら、その場所が入る地域に切りかえる（遠くの大陸へとぶとき）
      const inBox = (v, lon, lat) => { const b = GEO.VIEWS[v].bbox; return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]; };
      let v = first ? (story.view || REGION_VIEW[story.region]) : null;
      const cur = v || map.view;
      if (!inBox(cur, s.lon, s.lat)) {
        const cands = Object.entries(GEO.VIEWS).filter(([k, x]) => !x.parent && k !== 'world' && inBox(k, s.lon, s.lat)).sort((a, b) => a[1].span - b[1].span);
        v = (s.span || 6) > 25 || !cands.length ? 'world' : cands[0][0];
      }
      map.flyTo(s.lon, s.lat, s.span || 6, v);
      syncHash(); renderSideNow();
      if (playing) schedule();
    }
    function schedule() {
      clearTimeout(stTimer);
      const s = story.steps[si];
      const ms = 5200 + (s.text || '').length * 45;
      stTimer = setTimeout(() => { if (si < story.steps.length - 1) goStep(si + 1); else { playing = false; renderSideNow(); } }, ms);
    }
    function storyPanel() {
      const s = story.steps[si];
      const box = el(`<div class="story">
        <button type="button" class="backlink">← 物語をおわる</button>
        <div class="muted" style="font-size:12.5px">${esc(story.period || '')}</div>
        <h2 style="margin-top:0">${esc(story.title)}</h2>
        <div class="st-dots"></div>
        <div class="st-card">
          <div class="st-when"><span class="num">${esc(yearLabel(s.year))}</span>${s.date ? ' ' + esc(s.date) : ''}<span class="st-place">📍 ${esc(s.place || '')}</span></div>
          <h3 class="st-title">${si + 1}．${esc(s.title)}</h3>
          ${figureHtml(s.imageKey || `story:${story.id}:${si + 1}`)}
          <p>${esc(s.text || '')}</p>
          ${s.why ? `<div class="st-why">🔗 ${esc(s.why)}</div>` : ''}
          <div class="st-people"></div>
        </div>
        <div class="st-ctl">
          <button type="button" class="btn" data-a="prev" ${si === 0 ? 'disabled' : ''}>◀ 前</button>
          <button type="button" class="btn primary" data-a="play">${playing ? '❚❚ 止める' : '▶ 自動で進む'}</button>
          <button type="button" class="btn" data-a="next" ${si === story.steps.length - 1 ? 'disabled' : ''}>次 ▶</button>
        </div>
        <div class="st-bar"><i style="width:${playing ? 0 : 100}%"></i></div>
        ${si === 0 ? `<p class="muted" style="font-size:13.5px">${esc(story.summary || '')}</p>` : ''}
        ${si === story.steps.length - 1 && !playing ? `<p style="font-weight:700">おわり。${esc(story.summary || '')}</p>` : ''}
      </div>`);
      $('.backlink', box).addEventListener('click', endStory);
      // この物語の背景（原因）と、その後（結果）
      const sc = !story.generated && STORY_CAUSES[story.id];
      if (sc && si === 0 && sc.causes && sc.causes.length) {
        const w = el('<div><h3>なぜ起きた？（背景・原因）</h3></div>');
        w.appendChild(whyList(sc.causes.map(t => ({ i: EVENT_IDX[t], kind: 'cause', why: '' })).filter(c => c.i != null), 'up'));
        const b = el('<button type="button" class="btn chainbtn">▶ 背景からたどって見る</button>');
        b.addEventListener('click', () => {
          const pre = sc.causes.map(t => EVENT_IDX[t]).filter(i => i != null).sort((a, b) => EVENTS[a].year - EVENTS[b].year).map(i => eventStep(i, `背景 → 「${story.title}」`));
          startStory(Object.assign({}, story, { id: story.id + ':bg', generated: true, title: story.title + '（背景から）', steps: pre.concat(story.steps) }), 0);
        });
        w.appendChild(b);
        box.appendChild(w);
      }
      if (sc && si === story.steps.length - 1 && sc.results && sc.results.length) {
        const w = el('<div><h3>その後（結果・影響）</h3></div>');
        w.appendChild(whyList(sc.results.map(t => ({ i: EVENT_IDX[t], kind: 'result', why: '' })).filter(c => c.i != null), 'down'));
        box.appendChild(w);
      }
      const dots = $('.st-dots', box);
      story.steps.forEach((x, k) => {
        const d = el(`<button type="button" class="${k === si ? 'on' : k < si ? 'past' : ''}" title="${esc(x.title)}">${k + 1}</button>`);
        d.addEventListener('click', () => goStep(k));
        dots.appendChild(d);
      });
      const pe = $('.st-people', box);
      (s.people || []).map(id => PERSON[id]).filter(Boolean).forEach(p => {
        const b = el(`<button type="button" class="chip" style="padding:2px 10px 2px 3px">${portraitImg(p)}${esc(p.name)}</button>`);
        b.addEventListener('click', () => { playing = false; clearTimeout(stTimer); story = null; map.setStory(null); map.select({ type: 'person', id: p.id }); });
        pe.appendChild(b);
      });
      $$('.st-ctl button', box).forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'prev') goStep(si - 1);
        else if (a === 'next') goStep(si + 1);
        else { playing = !playing; if (playing && si === story.steps.length - 1) goStep(0); else { if (playing) schedule(); else clearTimeout(stTimer); renderSideNow(); } }
      }));
      body.appendChild(box);
      // 自動で進むまでの残り時間のバー
      if (playing) { const bar = $('.st-bar i', box); const ms = 5200 + (s.text || '').length * 45; bar.style.transition = `width ${ms}ms linear`; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; })); }
    }
    const onKey = e => {
      if (!story || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') goStep(si + 1); else if (e.key === 'ArrowLeft') goStep(si - 1);
      else if (e.key === ' ') { e.preventDefault(); $('.st-ctl [data-a=play]') && $('.st-ctl [data-a=play]').click(); }
    };
    document.addEventListener('keydown', onKey);

    // 最初にえらぶもの（URL から）
    if (params.story && STORY[params.story]) {
      setTimeout(() => startStory(STORY[params.story], (params.step || 1) - 1), 150);
    } else if (params.sel) {
      const [t, id] = params.sel.split(':');
      if (t === 'p' && PERSON[id]) { map.select({ type: 'person', id }); const pl = GEO.placeAt(PERSON[id], clamp(map.year, PERSON[id].born, PERSON[id].died)); if (pl && !params.view) map.focusOn(pl.lon, pl.lat); }
      else if (t === 's' && POLITY[id]) map.select({ type: 'polity', id });
      else if (t === 'e' && EVENTS[+id]) map.select({ type: 'event', id: +id });
      else renderSide();
    } else renderSide();
    syncHash();

    return () => { clearInterval(lifeTimer); clearTimeout(timer); clearTimeout(stTimer); document.removeEventListener('keydown', onKey); map.destroy(); };
  }
});

// 物語の一覧
registerTool('stories', {
  name: 'できごとを追う',
  render(main) {
    main.appendChild(el(`<div class="course-head"><h2>できごとを追う</h2><div class="muted" style="font-size:13.5px">1つのできごとを、地図を動かしながら順に追います。えらぶと地図が開き、自動で進みます（◀ ▶ で1場面ずつ）。</div></div>`));
    const f = el('<div class="filters" style="max-width:980px;margin:0 auto 10px"></div>');
    let c = '';
    const grid = el('<div class="pgrid" style="max-width:980px;margin:0 auto"></div>');
    [['', 'すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']].forEach(([k, n]) => {
      const b = el(`<button type="button" class="chip" aria-pressed="${k === c}">${n}</button>`);
      b.addEventListener('click', () => { c = k; $$('button', f).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); list(); });
      f.appendChild(b);
    });
    function list() {
      grid.innerHTML = '';
      STORIES.filter(s => !c || (s.tags || []).includes(c)).forEach(s => {
        const col = (REGION[s.region] || {}).color || '#555';
        grid.appendChild(el(`<a class="pcard" style="--c:${col};text-decoration:none;color:inherit" href="#story/${esc(s.id)}/1">
          <b>▶ ${esc(s.title)}</b>
          <span class="m">${esc(s.period || '')}・${s.steps.length}場面・${esc((REGION[s.region] || {}).name || '')}</span>
          <span class="t">${esc(s.summary || '')}</span>
        </a>`));
      });
      if (!grid.children.length) grid.appendChild(el('<p class="empty">物語のデータがまだありません。</p>'));
    }
    main.appendChild(f); main.appendChild(grid); list();
  }
});
registerTool('story', { name: '物語', render(main, params) { return TOOLS.map.render(main, params); } });
