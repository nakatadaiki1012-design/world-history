/* 歴史地図の画面：左に地図と年代のツマミ、右に「この年のようす」と、えらんだ国・人物・出来事の説明 */
registerTool('map', {
  name: '歴史地図',
  render(main, params) {
    const wrap = el(`<div class="mapview"><div class="mapbox" style="display:flex;min-height:0"></div><aside class="side"><div class="tabs" role="tablist"></div><div class="side-body"></div></aside></div>`);
    main.appendChild(wrap);
    const box = $('.mapbox', wrap), tabs = $('.tabs', wrap), body = $('.side-body', wrap);
    let tab = store.get('mapTab', 'year');
    // 物語から開くときは、はじめからその物語の地域・年で地図を作る（作りなおしを省く）
    const st0 = params.story && STORY[params.story], sp0 = st0 && st0.steps[Math.max(0, (params.step || 1) - 1)];
    const year0 = sp0 ? fixYear(sp0.year) : params.year != null ? params.year : store.get('year', 750);
    const view0 = st0 ? (st0.view || REGION_VIEW[st0.region] || 'world') : params.view || store.get('view', 'world');
    const map = createHistMap(box, {
      year: year0, view: view0,
      onYear: y => { yearSave(y); renderSide(220); },
      onView: v => { store.set('view', v); syncHash(); renderSide(); },
      onSelect: () => { syncHash(); renderSide(); }
    });
    map.root.style.flex = '1';

    // アドレス（# のあと）を今の場面に。コピーして送れば同じ場面が開ける
    function syncHash() {
      if (story && !story.generated) { history.replaceState(null, '', `#story/${story.id}/${si + 1}`); return; }
      if (story) { history.replaceState(null, '', mapHash(map.year, map.view)); return; }
      const s = map.sel;
      const extra = !s ? '' : s.type === 'person' ? 'p:' + s.id : s.type === 'polity' ? 's:' + s.id : s.type === 'place' ? 'pl:' + s.id : 'e:' + s.id;
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
    // 横の欄は、年がしばらく止まってから描きなおす（ツマミや再生の最中に何度も作らない）
    function renderSide(wait) {
      clearTimeout(timer);
      timer = setTimeout(renderSideNow, wait || 40);
    }
    // 年の保存と URL の書きかえも、少しまとめてから
    let ySaveT = null;
    function yearSave(y) { clearTimeout(ySaveT); ySaveT = setTimeout(() => { store.set('year', y); syncHash(); }, 250); }
    function renderSideNow() {
      const s = map.sel;
      renderTabs(!!s || !!story);
      body.innerHTML = '';
      if (story) return storyPanel();
      if (s && s.type === 'polity' && POLITY[s.id]) return polityDetail(POLITY[s.id]);
      if (s && s.type === 'person' && PERSON[s.id]) return personDetail(PERSON[s.id]);
      if (s && s.type === 'event' && EVENTS[s.id]) return eventDetail(EVENTS[s.id]);
      if (s && s.type === 'place' && PLACE[s.id]) return placeDetail(PLACE[s.id]);
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
        li.firstChild.addEventListener('click', () => { if (story) endStory(); map.setYear(e.year); map.select({ type: 'event', id: c.i }); map.flyTo(e.lon, e.lat, spanForEvent(e), null, undefined, true); });
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

    // 歴史的な地名：時代ごとの名前・都にした国・この地の出来事・ゆかりの人物
    function placeDetail(pl) {
      body.appendChild(back());
      const nm = placeNameAt(pl, map.year);
      { const r = el('<div style="float:right"></div>'); r.appendChild(speakBtn(() => `${nm ? nm.name : pl.modern}。今の${pl.modern}。${pl.text || ''}`)); body.appendChild(r); }
      body.appendChild(el(`<div>
        <div class="muted" style="font-size:13px">◇ 地名・${esc((REGION[pl.region] || {}).name || '')}</div>
        <h2>${esc(nm ? nm.name : pl.modern)}</h2>
        <div class="muted">今の名前：${esc(pl.modern || '')}</div>
        ${figureHtml('place:' + pl.id)}
        <p>${linkTerms(pl.text || '')}</p>
        ${pl.fun ? `<div class="ev-fun">💡 <b>ここがおもしろい</b>　${esc(pl.fun)}</div>` : ''}
      </div>`));
      body.appendChild(el('<h3>名前のうつりかわり（おすとその年へ）</h3>'));
      const ol = el('<ol class="places"></ol>');
      pl.names.forEach(n => {
        const li = el(`<li class="${n === nm ? 'now' : ''}"><b>${esc(yearLabel(n.from))}〜${n.to >= 2025 ? '今' : esc(yearLabel(n.to))}</b>${esc(n.name)}${n.note ? `<div class="muted" style="font-size:12.5px">${esc(n.note)}</div>` : ''}</li>`);
        li.addEventListener('click', () => map.setYear(Math.max(n.from, YEAR_MIN)));
        ol.appendChild(li);
      });
      body.appendChild(ol);
      const near = (lon, lat) => Math.hypot((lon - pl.lon) * Math.cos(pl.lat * Math.PI / 180), lat - pl.lat) < 0.45;
      const nearCap = (lon, lat) => Math.hypot((lon - pl.lon) * Math.cos(pl.lat * Math.PI / 180), lat - pl.lat) < 0.2;
      const caps = POLITIES.filter(p => (p.rank || 2) <= 2 && (p.capitals || (p.capital ? [Object.assign({ from: p.start, to: p.end }, p.capital)] : [])).some(c => nearCap(c.lon, c.lat))).sort((a, b) => a.start - b.start);
      if (caps.length) {
        body.appendChild(el('<h3>ここを都にした国・王朝</h3>'));
        const ul = el('<ul class="lst"></ul>'); caps.forEach(p => ul.appendChild(polityItem(p))); body.appendChild(ul);
      }
      const evs = EVENTS.map((e, i) => ({ e, i })).filter(({ e }) => near(e.lon, e.lat)).slice(0, 25);
      if (evs.length) {
        body.appendChild(el(`<h3>この地で起きた出来事（${evs.length}）</h3>`));
        const ul = el('<ul class="lst"></ul>'); evs.forEach(({ e, i }) => ul.appendChild(eventItem(e, i))); body.appendChild(ul);
      }
      const ppl = PEOPLE.filter(p => (p.places || []).some(x => near(x.lon, x.lat)));
      if (ppl.length) {
        body.appendChild(el(`<h3>ゆかりの人物（${ppl.length}人）</h3>`));
        const ul = el('<ul class="lst"></ul>'); ppl.slice(0, 20).forEach(p => ul.appendChild(personItem(p))); body.appendChild(ul);
      }
    }

    function polityDetail(p) {
      body.appendChild(back());
      { const r = el('<div style="float:right"></div>'); r.appendChild(speakBtn(() => `${p.full || p.name}。${span(p.start, p.end)}。${p.text || ''}`)); body.appendChild(r); }
      const reg = REGION[p.region];
      body.appendChild(el(`<div>
        <div class="muted" style="font-size:13px"><span class="sw" style="background:${esc(p.color)}"></span> ${esc(reg ? reg.name : '')}</div>
        <h2>${esc(p.full || p.name)}</h2>
        <div class="num" style="font-weight:700">${esc(span(p.start, p.end))}</div>
        ${capitalText(p)}
        <p>${linkTerms(p.text || '', p.name)}</p>
        ${p.keys && p.keys.length ? `<div class="keys">${p.keys.map(k => TERM[k] ? `<a class="term" data-term="${esc(k)}" href="#term/${encodeURIComponent(k)}"><span>${esc(k)}</span></a>` : `<span>${esc(k)}</span>`).join('')}</div>` : ''}
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
      { const r = el('<div style="float:right"></div>'); r.appendChild(speakBtn(() => `${p.name}。${p.role || ''}。${lifeSpan(p)}。${p.text || ''}`)); body.appendChild(r); }
      const reg = REGION[p.region];
      const pol = p.polity && POLITY[p.polity];
      const ph = PORTRAITS[p.id];
      body.appendChild(el(`<div>
        ${portraitImg(p, 'bigimg')}
        <div class="muted" style="font-size:13px"><span class="dot" style="display:inline-block;background:${reg ? reg.color : '#555'}"></span> ${esc(reg ? reg.name : '')}・${esc(p.role || '')}</div>
        <h2>${esc(p.name)}</h2>
        <div class="muted" style="font-size:13px">${esc(p.kana || '')}</div>
        <div class="num" style="font-weight:700">${esc(lifeSpan(p))}</div>
        <p>${linkTerms(p.text || '', p.name)}</p>
        ${p.keys && p.keys.length ? `<div class="keys">${p.keys.map(k => TERM[k] ? `<a class="term" data-term="${esc(k)}" href="#term/${encodeURIComponent(k)}"><span>${esc(k)}</span></a>` : `<span>${esc(k)}</span>`).join('')}</div>` : ''}
        ${ph ? `<div class="credit">肖像：${esc(ph.what || '')}${ph.artist ? '（' + esc(ph.artist) + '）' : ''}・${esc(ph.license || '')}・<a href="${esc(ph.page || '#')}" target="_blank" rel="noopener">ウィキメディア・コモンズ</a></div>` : ''}
      </div>`));
      if (IMAGES['person:' + p.id]) body.appendChild(el(`<div>${figureHtml('person:' + p.id, 2)}</div>`));
      if (hasProfile(p.id)) body.appendChild(profileBtn(p.id));
      { const life = lifeStoryOf(p.id); if (life) { const b = el(`<button type="button" class="btn profbtn">👤 生涯を物語でたどる</button>`); b.addEventListener('click', () => startStory(life, 0)); body.appendChild(b); } }
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
      { const r = el('<div style="float:right"></div>'); r.appendChild(speakBtn(() => `${e.title}。${yearLabel(e.year)}。${e.text || ''}`)); body.appendChild(r); }
      const reg = REGION[e.region];
      body.appendChild(el(`<div>
        <div class="muted" style="font-size:13px"><span class="sw" style="background:${KIND_COLOR[e.kind] || '#555'};transform:rotate(45deg);border-radius:2px"></span> ${esc(KIND[e.kind] || '')}・${esc(reg ? reg.name : '')}</div>
        <h2>${esc(e.title)}</h2>
        <div class="num" style="font-weight:700">${esc(yearLabel(e.year))}${e.end && e.end !== e.year ? '〜' + esc(yearLabel(e.end)) : ''}　<span style="font-family:var(--font-body);font-weight:500">${esc(e.place || '')}</span></div>
        <p>${linkTerms(e.text || '', e.title)}</p>
      </div>`));
      const idx = EVENT_IDX[e.title];
      body.appendChild(el(`<div>${figureHtml('event:' + e.title)}</div>`));
      if (EVENT_FUN[e.title]) body.appendChild(el(`<div class="ev-fun">💡 <b>ここがおもしろい</b>　${esc(EVENT_FUN[e.title])}</div>`));
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
      if (!STORIES.length) { body.appendChild(el('<p class="muted">物語を読みこんでいます…</p>')); return; }
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
      map.root.classList.add('storying');
      goStep(i || 0, true);
    }
    function endStory() {
      clearTimeout(stTimer); SPEECH.stop(); story = null; playing = false;
      map.root.classList.remove('storying'); map.caption.hidden = true;
      $$('.story-img, .story-img-show', map.root).forEach(x => x.remove());
      map.setStory(null); syncHash(); renderSide();
    }
    // 場面の読み上げ用の文
    const stepSpeech = s => `${yearLabel(s.year)}${s.date ? '、' + s.date : ''}。${s.title}。${s.text || ''}${s.why ? '。' + s.why : ''}`;
    // 「語り」：場面に talk（エピソードをまじえた語り）があれば、テロップと読み上げはそちらを使う
    let talkMode = store.get('talkMode', true);
    const stepBody = s => (talkMode && s.talk) ? s.talk : (s.text || '');
    // 場面を文ごとに読み、読んでいる文をテロップで光らせる
    const clearReading = () => $$('.hm-caption .reading').forEach(x => x.classList.toggle('reading', false));
    function speakStep(s, onend) {
      const sents = SPEECH.sentences(stepBody(s));
      const parts = [`${yearLabel(s.year)}${s.date ? '、' + s.date : ''}。${s.title}。`, ...sents];
      const marks = ['.cap-title', ...sents.map((x, i) => `.cap-s[data-i="${i}"]`)];
      if (s.why) { parts.push('つながり。' + s.why.replace(/^[^：]*：/, '')); marks.push('.cap-why'); }
      SPEECH.speakParts(parts, () => { clearReading(); if (onend) onend(); }, i => {
        clearReading();
        const e = $('.hm-caption ' + marks[i]);
        if (e) { e.classList.add('reading'); const box = e.closest('.cap-text'); if (box) box.scrollTop = Math.max(0, e.offsetTop - box.offsetTop - 8); }
      });
    }
    // 地図の下に重ねる「テロップ」（スクロールしなくても読める）
    function renderCaption() {
      const cap = map.caption;
      if (!story) { cap.hidden = true; return; }
      const s = story.steps[si], n = story.steps.length;
      const small = store.get('capSmall', false);
      cap.hidden = false;
      cap.className = 'hm-caption' + (small ? ' small' : '');
      // 場面の画像（スマホでは右の欄が見えないので、テロップの中に小さく出す。おすと大きく）
      const im = (IMAGES[s.imageKey || `story:${story.id}:${si + 1}`] || [])[0] || (story.kind === 'person' && story.person ? (IMAGES['person:' + story.person] || [])[0] : null);
      const capFig = im ? `<figure class="cap-fig fig"><img src="${esc(commonsUrl(im.file, 240))}" data-big="${esc(commonsUrl(im.file, 1400))}" alt="${esc(im.what || '')}" onerror="this.closest('figure').remove()"><figcaption hidden>${esc(im.what || '')}<span class="credit">${im.artist ? esc(im.artist) + '・' : ''}${esc(im.license || '')}</span></figcaption><span class="cap-zoom">🔍</span></figure>` : '';
      // パソコンでは、地図の右下（テロップのとなり）にも画像を出す（✕でかくせる）
      $$('.story-img, .story-img-show', map.root).forEach(x => x.remove());
      map.root.classList.toggle('has-simg', !!im && !store.get('storyImgHide', false));
      if (im) {
        if (!store.get('storyImgHide', false)) {
          const box = el(`<figure class="story-img fig"><img src="${esc(commonsUrl(im.file, 480))}" data-big="${esc(commonsUrl(im.file, 1400))}" alt="${esc(im.what || '')}" onerror="this.closest('figure').remove()"><figcaption>${esc(im.what || '')}<span class="credit" hidden>${im.artist ? esc(im.artist) + '・' : ''}${esc(im.license || '')}</span></figcaption><button type="button" class="x" aria-label="画像をかくす">✕</button></figure>`);
          $('.x', box).addEventListener('click', e => { e.stopPropagation(); store.set('storyImgHide', true); renderCaption(); });
          $('.hm-stage', map.root).appendChild(box);
        } else {
          const b = el('<button type="button" class="chip story-img-show">🖼 画像</button>');
          b.addEventListener('click', () => { store.set('storyImgHide', false); renderCaption(); });
          $('.hm-stage', map.root).appendChild(b);
        }
      }
      cap.innerHTML = `${capFig}
        <div class="cap-top"><span class="cap-story">${esc(story.title)}</span><span class="cap-n num">${si + 1} / ${n}</span></div>
        <div class="cap-when"><span class="num">${esc(yearLabel(s.year))}</span>${s.date ? ' ' + esc(s.date) : ''}<span>📍 ${esc(s.place || '')}</span></div>
        <div class="cap-title">${furi(s.title)}</div>
        <div class="cap-text${talkMode && s.talk ? ' talk' : ''}">${SPEECH.sentences(stepBody(s)).map((x, i) => `<span class="cap-s" data-i="${i}">${furi(x)}</span>`).join('')}${s.why ? `<div class="cap-why">🔗 ${esc(s.why)}</div>` : ''}</div>
        <div class="cap-ctl">
          <button type="button" data-a="prev" ${si === 0 ? 'disabled' : ''} aria-label="前の場面">◀</button>
          <button type="button" data-a="play" class="pl" aria-label="${playing ? '止める' : '自動で進む'}">${playing ? '❚❚' : '▶'}</button>
          <button type="button" data-a="next" ${si === n - 1 ? 'disabled' : ''} aria-label="次の場面">▶▶</button>
          <button type="button" data-a="tts" class="${SPEECH.on ? 'on' : ''}" ${SPEECH.ok ? '' : 'disabled'} aria-label="音声で読み上げ">${SPEECH.on ? '🔊' : '🔈'}<span class="lbl2"> 読み上げ</span></button>
          ${s.talk ? `<button type="button" data-a="talk" class="${talkMode ? 'on' : ''}" aria-label="語り口の切りかえ">${talkMode ? '🎙 語り' : '📄 要点'}</button>` : ''}
          <button type="button" data-a="size" aria-label="テロップの大きさ">${small ? '▴' : '▾'}</button>
          <button type="button" data-a="list" aria-label="物語の一覧へ">☰<span class="lbl2"> 一覧</span></button>
          <button type="button" data-a="end" aria-label="物語をおわる">✕</button>
        </div>
        <div class="cap-bar"><i></i></div>`;
      $$('.cap-ctl button', cap).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); storyCtl(b.dataset.a); }));
      cap.onclick = null;   // 画像をおすと大きく（document の処理に任せる）
      cap.onpointerdown = e => e.stopPropagation();
      // 残り時間のバー（読み上げ中は、読みおわるまで）
      const bar = $('.cap-bar i', cap);
      if (playing && !SPEECH.on) { const ms = 5200 + (s.text || '').length * 45; bar.style.transition = `width ${ms}ms linear`; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; })); }
      else if (playing) bar.classList.add('busy');
      else bar.style.width = '100%';
    }
    function storyCtl(a) {
      if (a === 'prev') goStep(si - 1);
      else if (a === 'next') goStep(si + 1);
      else if (a === 'end') endStory();
      else if (a === 'list') { endStory(); location.hash = '#stories'; }
      else if (a === 'size') { store.set('capSmall', !store.get('capSmall', false)); renderCaption(); }
      else if (a === 'talk') { talkMode = !talkMode; store.set('talkMode', talkMode); renderSideNow(); if (SPEECH.on) { if (playing) schedule(); else speakStep(story.steps[si]); } }
      else if (a === 'tts') {
        SPEECH.setOn(!SPEECH.on);
        if (SPEECH.on) { if (playing) schedule(); else speakStep(story.steps[si]); }
        else if (playing) schedule();
        renderSideNow();
      } else {
        playing = !playing;
        if (playing && si === story.steps.length - 1) goStep(0);
        else { if (playing) schedule(); else { clearTimeout(stTimer); SPEECH.stop(); } renderSideNow(); }
      }
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
      syncHash(); renderSideNow();
      // まわりの町や地名の多さで寄り方を調節（物語の地点・進路は必ず画面に入れる）
      const keep = [...(s.marks || []).map(m => [m.lon, m.lat]), ...(s.routes || []).flatMap(r => r.pts || []), ...(s.lines || []).flatMap(l => l.pts || [])].filter(p => p && isFinite(p[0]) && isFinite(p[1]));
      map.flyTo(s.lon, s.lat, s.span || 6, v, undefined, keep);
      if (playing) schedule(); else if (SPEECH.on) setTimeout(() => { if (story && story.steps[si] === s) speakStep(s); }, 60);
    }
    function nextOrEnd() { if (!story) return; if (si < story.steps.length - 1) goStep(si + 1); else { playing = false; renderSideNow(); } }
    function schedule() {
      clearTimeout(stTimer);
      const s = story.steps[si], S = story;
      if (SPEECH.on && SPEECH.ok) {
        // 読みおわってから、少し間をおいて次へ
        const txt = stepSpeech(s);
        // 声が出ない環境でも止まらないように、長めの予備のタイマーも置く
        stTimer = setTimeout(() => { if (story === S && playing) { SPEECH.stop(); nextOrEnd(); } }, 9000 + txt.length * 320);
        // テロップができてから読みはじめる（光らせる文の場所が必要なので）
        setTimeout(() => { if (story === S && playing) speakStep(s, () => { if (story === S && playing) { clearTimeout(stTimer); stTimer = setTimeout(nextOrEnd, 1200); } }); }, 60);
        return;
      }
      SPEECH.stop();
      const ms = 5200 + stepBody(s).length * 45;
      stTimer = setTimeout(nextOrEnd, ms);
    }
    function storyPanel() {
      const s = story.steps[si];
      const box = el(`<div class="story">
        <button type="button" class="backlink">← 物語をおわる</button><a class="backlink st-back" href="#stories">☰ 物語の一覧へ</a>
        <div class="muted" style="font-size:12.5px">${esc(story.period || '')}</div>
        <h2 style="margin-top:0">${esc(story.title)}</h2>
        <div class="st-dots"></div>
        <div class="st-card">
          <div class="st-when"><span class="num">${esc(yearLabel(s.year))}</span>${s.date ? ' ' + esc(s.date) : ''}<span class="st-place">📍 ${esc(s.place || '')}</span></div>
          <h3 class="st-title">${si + 1}．${esc(s.title)}</h3>
          ${figureHtml(s.imageKey || `story:${story.id}:${si + 1}`)}
          <p>${linkTerms(s.text || '')}</p>
          ${s.talk ? `<div class="st-talk"><b>🎙 語り</b>${linkTerms(s.talk)}</div>` : ''}
          ${s.why ? `<div class="st-why">🔗 ${esc(s.why)}</div>` : ''}
          <div class="st-people"></div>
        </div>
        <div class="st-ctl">
          <button type="button" class="btn" data-a="prev" ${si === 0 ? 'disabled' : ''}>◀ 前</button>
          <button type="button" class="btn primary" data-a="play">${playing ? '❚❚ 止める' : '▶ 自動で進む'}</button>
          <button type="button" class="btn" data-a="next" ${si === story.steps.length - 1 ? 'disabled' : ''}>次 ▶</button>
        </div>
        <div class="st-bar"><i style="width:${playing ? 0 : 100}%"></i></div>
        <label class="ttsrow"><input type="checkbox" class="ttsck" ${SPEECH.on ? 'checked' : ''} ${SPEECH.ok ? '' : 'disabled'}> 🔊 音声で読み上げる${SPEECH.ok ? '' : '（このブラウザでは使えません）'}</label>
        ${si === 0 ? `<p class="muted" style="font-size:13.5px">${esc(story.summary || '')}</p>` : ''}
        ${story.term && TERM[story.term] ? `<p style="font-size:13.5px">📘 用語集：<a class="term" data-term="${esc(story.term)}" href="#term/${encodeURIComponent(story.term)}">${esc(story.term)}</a></p>` : ''}
        ${(story.exam || []).length && (si === 0 || si === story.steps.length - 1) ? `<div class="st-exam"><b>✏ テストのポイント</b><ul>${story.exam.map(x => `<li>${linkTerms(x, story.term)}</li>`).join('')}</ul></div>` : ''}
        ${si === story.steps.length - 1 && !playing ? `<p style="font-weight:700">おわり。${esc(story.summary || '')}</p>` : ''}
      </div>`);
      $('.backlink', box).addEventListener('click', endStory);
      $('.ttsck', box).addEventListener('change', () => storyCtl('tts'));
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
        b.addEventListener('click', () => { endStory(); map.select({ type: 'person', id: p.id }); });
        pe.appendChild(b);
      });
      $$('.st-ctl button', box).forEach(b => b.addEventListener('click', () => storyCtl(b.dataset.a)));
      body.appendChild(box);
      // 自動で進むまでの残り時間のバー
      if (playing && !SPEECH.on) { const bar = $('.st-bar i', box); const ms = 5200 + (s.text || '').length * 45; bar.style.transition = `width ${ms}ms linear`; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; })); }
      renderCaption();
    }
    map.root.addEventListener('furigana', () => { if (story) renderSideNow(); });
    const onKey = e => {
      if (!story || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') goStep(si + 1); else if (e.key === 'ArrowLeft') goStep(si - 1);
      else if (e.key === ' ') { e.preventDefault(); storyCtl('play'); }
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
      else if (t === 'pl' && PLACE[id]) map.select({ type: 'place', id });
      else renderSide();
    } else renderSide();
    syncHash();

    // 物語・画像・用語などがあとから届いたら、横の欄をかき直す（物語の再生中はそのまま）
    const onLate = () => { if (!story) renderSideNow(); };
    window.addEventListener('lateready', onLate);
    return () => { SPEECH.stop(); clearInterval(lifeTimer); clearTimeout(timer); clearTimeout(stTimer); document.removeEventListener('keydown', onKey); window.removeEventListener('lateready', onLate); map.destroy(); };
  }
});

registerTool('story', { name: '物語', render(main, params) { return TOOLS.map.render(main, params); } });
