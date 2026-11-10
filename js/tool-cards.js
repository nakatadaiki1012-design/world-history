/* 暗記カード：用語集の語を、表（用語）・裏（説明）でめくって覚える。
   覚えた度合い（箱 1〜5）に合わせて、次に出す日をのばす（1・3・7・14・30日）。まちがえたカードはすぐまた出る。 */
const CARD_KEY = 'cardBox';
const CARD_DAYS = [0, 1, 3, 7, 14, 30];
function cardState() { return store.get(CARD_KEY, {}); }

registerTool('cards', {
  name: '暗記カード',
  render(main) {
    const box = el('<div class="cards"></div>');
    main.appendChild(box);
    let cfg = Object.assign({ rank: '3', course: '', region: '', era: '', dir: 'term', n: 20 }, store.get('cardCfg', {}));
    let onKey = null;
    const pool = () => GLOSSARY.filter(g => g.def && (!cfg.rank || String(g.rank || 1) === cfg.rank) && (!cfg.course || !(g.course || []).length || g.course.includes(cfg.course)) && (!cfg.region || g.region === cfg.region) && (!cfg.era || (g.year != null && eraOf(g.year) === cfg.era)));
    function setup() {
      if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
      const S = cardState(), now = Date.now(), P = pool();
      const due = P.filter(g => S[g.term] && S[g.term].due <= now).length, fresh = P.filter(g => !S[g.term]).length, learned = P.filter(g => S[g.term] && S[g.term].box >= 4).length;
      box.innerHTML = '';
      const s = el(`<div class="card setup">
        <h2 style="margin:0">🃏 暗記カード</h2>
        <p class="muted" style="font-size:13.5px;margin:4px 0 8px">おすと裏返ります。覚えたカードは、だんだん間をあけて出てきます（1・3・7・14・30日後）。「✕」のカードは、その回の最後にもう一度出ます。</p>
        <button type="button" class="btn primary go" style="margin-bottom:8px">はじめる</button>
        <div class="crow"><b>重要度</b></div><div class="crow"><b>科目</b></div><div class="crow"><b>表に出すもの</b></div><div class="crow"><b>枚数</b></div>
        <div class="lf-bar" style="margin:6px 0 10px"></div>
        <div class="cstat"></div>
      </div>`);
      const rows = $$('.crow', s);
      const chips = (row, items, key) => items.forEach(([v, n]) => {
        const b = el(`<button type="button" class="chip" aria-pressed="${String(cfg[key]) === String(v)}">${n}</button>`);
        b.addEventListener('click', () => { cfg[key] = v; store.set('cardCfg', cfg); setup(); });
        row.appendChild(b);
      });
      chips(rows[0], [['3', '★★★'], ['2', '★★'], ['1', '★'], ['', 'すべて']], 'rank');
      chips(rows[1], [['', 'すべて'], ['sogo', '歴史総合'], ['tankyu', '世界史探究']], 'course');
      chips(rows[2], [['term', '用語 → 説明'], ['def', '説明 → 用語']], 'dir');
      chips(rows[3], [[20, '20枚'], [40, '40枚']], 'n');
      const bar = $('.lf-bar', s);
      const sel = (key, items, label) => { const x = el(`<select aria-label="${label}">${items.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`); x.value = cfg[key] || ''; x.addEventListener('change', () => { cfg[key] = x.value; store.set('cardCfg', cfg); setup(); }); bar.appendChild(x); };
      sel('region', [['', '地域：すべて'], ...REGIONS.map(r => [r.id, r.name])], '地域');
      sel('era', [['', '時代：すべて'], ...ERA_BINS.map(b => [b[2], b[2]])], '時代');
      $('.cstat', s).innerHTML = `<div class="rec-tiles" style="margin-bottom:10px"><div class="rec-tile"><div class="muted" style="font-size:12px">この条件の用語</div><div class="big">${P.length}</div></div><div class="rec-tile"><div class="muted" style="font-size:12px">今日の復習</div><div class="big">${due}</div></div><div class="rec-tile"><div class="muted" style="font-size:12px">まだ見ていない</div><div class="big">${fresh}</div></div><div class="rec-tile"><div class="muted" style="font-size:12px">しっかり覚えた</div><div class="big">${learned}</div></div></div>`;
      $('.go', s).addEventListener('click', start);
      box.appendChild(s);
    }
    function start() {
      const S = cardState(), now = Date.now(), P = pool();
      // 今日の復習（期限が来たもの、箱の小さい順）→ 新しいカード（★の多い順・まぜる）
      const due = P.filter(g => S[g.term] && S[g.term].due <= now).sort((a, b) => S[a.term].box - S[b.term].box);
      const fresh = shuffle(P.filter(g => !S[g.term]));
      let deck = due.concat(fresh).slice(0, cfg.n);
      if (!deck.length) deck = shuffle(P).slice(0, cfg.n);   // 全部覚えたら、ふつうに練習
      let i = 0, flipped = false;
      const tally = { again: 0, hard: 0, good: 0 };
      function show() {
        if (i >= deck.length) return finish();
        const g = deck[i]; flipped = false;
        const yomi = g.yomi && g.yomi.replace(/[=＝・\s]/g, '') !== g.term.replace(/[=＝・\s]/g, '') ? g.yomi : '';
        const front = cfg.dir === 'term' ? `<div class="cterm">${esc(g.term)}</div><div class="muted">${esc(yomi)}</div>` : `<div class="cdef">${esc(hideTerm(g))}</div>`;
        const back = `<div class="cterm" style="font-size:24px">${esc(g.term)} <small class="muted">${esc(yomi)}</small></div>
          <div class="muted" style="font-size:12.5px">${esc(g.cat || '')}${REGION[g.region] ? '・' + esc(REGION[g.region].name) : ''}${g.year != null ? '・' + esc(yearLabel(g.year)) : ''}　${'★'.repeat(g.rank || 1)}</div>
          <div class="cdef">${esc(g.def)}</div>${(() => { const f = typeof quizFun === 'function' ? quizFun({ term: g.term }) : null; return f ? `<div class="ev-fun" style="margin-top:10px;text-align:left;font-size:14px">💡 <b>${esc(f.h)}</b>　${esc(f.t)}</div>` : ''; })()}`;
        box.innerHTML = '';
        const c = el(`<div class="cplay">
          <div class="qmeta"><span>${i + 1} / ${deck.length}</span><span>${S[g.term] ? '復習' : '新しい語'}</span></div>
          <div class="fcard" tabindex="0" role="button" aria-label="カード（おすと裏返る）"><div class="fin">${front}</div><div class="fhint muted">おすと裏返る</div></div>
          <div class="cbtns" hidden>
            <button type="button" class="btn again">✕ もう一度</button>
            <button type="button" class="btn hard">△ あやふや</button>
            <button type="button" class="btn primary good">◯ 覚えた</button>
          </div>
          <div class="clinks keys" hidden></div>
          <div style="text-align:center;margin-top:10px"><button type="button" class="btn quit" style="font-size:13px">やめる</button></div>
        </div>`);
        box.appendChild(c);
        const card = $('.fcard', c), btns = $('.cbtns', c), links = $('.clinks', c);
        const flip = () => {
          if (flipped) return; flipped = true;
          card.classList.add('flipped'); $('.fin', card).innerHTML = back; $('.fhint', card).remove();
          btns.hidden = false; links.hidden = false;
          links.appendChild(speakBtn(() => `${g.term}。${g.def}`, '🔊'));
          const ts = termStoryOf(g.term); if (ts) links.appendChild(el(`<a class="chip" href="#story/${esc(ts.id)}/1">▶ 物語で学ぶ</a>`));
          links.appendChild(el(`<a class="chip term" data-term="${esc(g.term)}" href="#term/${encodeURIComponent(g.term)}">📘 くわしく</a>`));
        };
        card.addEventListener('click', flip);
        const grade = k => {
          const st = cardState(), o = st[g.term] || { box: 0 };
          if (k === 'again') { o.box = 1; o.due = Date.now() + 60 * 1000; deck.push(g); }   // この回の最後にもう一度
          else if (k === 'hard') { o.box = Math.max(1, o.box); o.due = Date.now() + 864e5; }
          else { o.box = Math.min(5, (o.box || 0) + 1); o.due = Date.now() + CARD_DAYS[o.box] * 864e5; if (o.box >= 4) setMastered(g.term, true); }
          o.t = Date.now(); st[g.term] = o; store.set(CARD_KEY, st);
          tally[k]++; i++; show();
        };
        $('.again', c).addEventListener('click', () => grade('again'));
        $('.hard', c).addEventListener('click', () => grade('hard'));
        $('.good', c).addEventListener('click', () => grade('good'));
        $('.quit', c).addEventListener('click', () => { if (i === 0 || confirm('ここでやめますか？（ここまでの記録は残ります）')) finish(); });
        card.focus({ preventScroll: true });
      }
      function finish() {
        if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
        SPEECH.stop();
        const H = store.get('cardHist', []); H.push({ t: Date.now(), n: tally.again + tally.hard + tally.good, good: tally.good }); store.set('cardHist', H.slice(-200));
        box.innerHTML = '';
        const r = el(`<div class="card qbox" style="text-align:center">
          <div class="score">◯ ${tally.good}　△ ${tally.hard}　✕ ${tally.again}</div>
          <p>${tally.good && !tally.again ? 'よくできました！' : '「✕」のカードは、すぐにまた出てきます。'}</p>
          <button type="button" class="btn primary">つづける</button> <button type="button" class="btn">設定にもどる</button>
          <div style="margin-top:10px"><a class="chip" href="#record">📊 学習の記録を見る</a></div>
        </div>`);
        const bs = $$('button', r); bs[0].addEventListener('click', start); bs[1].addEventListener('click', setup);
        box.appendChild(r);
      }
      // キーボード：スペースで裏返す、1・2・3 で答える
      if (onKey) document.removeEventListener('keydown', onKey);
      onKey = e => {
        if (/input|select|textarea/i.test((e.target || {}).tagName || '')) return;
        const c = $('.cplay', box); if (!c) return;
        if (e.key === ' ' || e.key === 'Enter') { if (!flipped) { e.preventDefault(); $('.fcard', c).click(); } }
        else if (flipped && e.key === '1') $('.again', c).click();
        else if (flipped && e.key === '2') $('.hard', c).click();
        else if (flipped && e.key === '3') $('.good', c).click();
      };
      document.addEventListener('keydown', onKey);
      show();
    }
    // 説明の中の用語そのものはかくす（説明→用語のとき）
    function hideTerm(g) { let d = g.def; [g.term, ...g.term.split(/[=＝・]/).filter(x => x.length >= 2), ...(g.term.match(/[ァ-ヶー]{2,}|[一-龠々]{2,}/g) || [])].sort((a, b) => b.length - a.length).forEach(n => { d = d.split(n).join('〔　　〕'); }); return d; }   // 用語の中のカタカナ・漢字のまとまりも伏せる
    setup();
    return () => { if (onKey) document.removeEventListener('keydown', onKey); SPEECH.stop(); };
  }
});
