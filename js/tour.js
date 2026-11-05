/* はじめての人への案内（使い方ツアー）。地図の画面を最初に開いたとき、大事な所を順に光らせて説明する */
(function () {
  const STEPS = [
    { sel: '.hm-slider', title: '① 年代のツマミ', text: '左右に動かすと年が変わり、地図の国・王朝や、そのころの人物・出来事が入れかわります。▶ をおすと自動で進みます。' },
    { sel: '.hm-stage', title: '② 地図', text: '色のついた国・人物の写真・地名をおすと、説明が出ます。指2本（パソコンはホイール）で拡大できます。' },
    { sel: () => [...document.querySelectorAll('#grpnav button, #subnav button')].find(b => b.textContent.includes('物語')), title: '③ 物語でたどる', text: '出来事・人物の一生・テストに出る用語を、地図が動きながら語ります。🎙 の語りつき。' },
    { sel: '#searchBtn', title: '④ 探す', text: '用語・人物・物語・出来事・地名を、まとめて探せます（ひらがなの読みでもOK）。' },
    { sel: () => [...document.querySelectorAll('#grpnav button')].find(b => b.textContent.includes('挑戦')), title: '⑤ 挑戦', text: 'クイズ・暗記カード・学習の記録。まちがえた問題は、あとで復習できます。' }
  ];
  function find(s) { const e = typeof s === 'function' ? s() : document.querySelector(s); return e && e.getBoundingClientRect().width ? e : null; }
  function run() {
    $$('.tour').forEach(x => x.remove());
    const steps = STEPS.filter(s => find(s.sel));
    if (!steps.length) return;
    let i = 0;
    const ov = el('<div class="tour" role="dialog" aria-label="使い方の案内"><div class="tour-hole"></div><div class="tour-tip"><b class="tt"></b><p class="tx"></p><div class="tour-btns"><button type="button" class="btn skip">スキップ</button><span class="tour-n muted"></span><button type="button" class="btn primary nx">次へ</button></div></div></div>');
    document.body.appendChild(ov);
    const hole = $('.tour-hole', ov), tip = $('.tour-tip', ov);
    const end = () => { ov.remove(); store.set('tourDone', 1); window.removeEventListener('resize', place); };
    function place() {
      const s = steps[i], e = find(s.sel); if (!e) { next(); return; }
      if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest' });
      const r = e.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, innerHeight * 0.7) + pad * 2 + 'px' });
      $('.tt', tip).textContent = s.title; $('.tx', tip).textContent = s.text;
      $('.tour-n', tip).textContent = `${i + 1} / ${steps.length}`;
      $('.nx', tip).textContent = i === steps.length - 1 ? 'はじめる' : '次へ';
      const W = Math.min(340, innerWidth - 24);
      tip.style.width = W + 'px';
      const below = r.bottom + 12 + 150 < innerHeight;
      tip.style.left = Math.max(12, Math.min(innerWidth - W - 12, r.left + r.width / 2 - W / 2)) + 'px';
      tip.style.top = (below ? Math.min(r.bottom, innerHeight * 0.7) + 14 : Math.max(12, r.top - 14 - tip.offsetHeight)) + 'px';
    }
    function next() { i++; if (i >= steps.length) end(); else place(); }
    $('.nx', tip).addEventListener('click', next);
    $('.skip', tip).addEventListener('click', end);
    window.addEventListener('resize', place);
    place();
  }
  window.startTour = run;
  // はじめて地図を開いたときだけ（地図が出て、少ししてから）
  window.addEventListener('mapdrawn', () => {
    if (store.get('tourDone', 0) || !/^#?(map|)$|^#map\//.test(location.hash || '#map')) return;
    setTimeout(() => { if (!store.get('tourDone', 0) && $('.hm-slider')) run(); }, 900);
  }, { once: true });
})();
