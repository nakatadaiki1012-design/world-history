/* 画面の切りかえ（地図と年表／挑戦／授業モード）と、URL の # による直接リンク */
const GROUPS = [
  { id: 'see', name: '地図<span class="lbl">と年表</span>', secs: [['map', '🗺 歴史地図'], ['stories', '▶ 物語でたどる'], ['events', '出来事'], ['chrono', '年表'], ['ptl', '人物年表'], ['econ', '人口と経済'], ['people', '人物図鑑'], ['glossary', '用語集']] },
  { id: 'try', name: '挑戦', secs: [['quiz', 'クイズ'], ['cards', '🃏 暗記カード'], ['record', '📊 学習の記録']] },
  { id: 'class', name: '授業<span class="lbl">モード</span>', secs: [['lessons/sogo', '歴史総合'], ['lessons/tankyu', '世界史探究']] }
];

// 地図に要らないデータ（物語・授業・画像・読み・用語・地形・経済）は、地図を出したあとで読みこむ
const LATE_FILES = ["causes", "lessons-sogo", "lessons-tankyu", "stories", "stories-prehistory", "stories-more", "stories-more2", "stories-people", "stories-people2", "stories-people3", "stories-people4", "stories-people5", "stories-themes","stories-terms-1","stories-terms-2","stories-terms-3","stories-terms-4","stories-terms-5","stories-terms-6", "story-talk", "story-talk-new", "people-detail", "event-fun", "event-fun-new", "person-fun", "images", "images-more", "images-more2","images-more3","images-more4","images-more5", "yomi-auto", "yomi-1", "yomi-2", "yomi-3", "yomi-4", "yomi-5", "yomi-6", "yomi-7", "yomi-8", "yomi-9", "glossary-1", "glossary-2", "glossary-3", "glossary-4", "terrain", "econ"];
// 2つに分けて読む：ふつうのデータ（用語・画像・読みなど）は地図のすぐあと、物語（いちばん大きい）は必要になったときに
const STORY_FILES = LATE_FILES.filter(f => /^stor/.test(f)), BASE_FILES = LATE_FILES.filter(f => !/^stor/.test(f));
let lateReady = false, baseReady = false, storiesReady = false, storiesP = null;
function loadFiles(list, cb) {
  let left = list.length; if (!left) { cb(); return; }
  const done = () => { if (--left === 0) cb(); };
  list.forEach(f => { const sc = document.createElement('script'); sc.src = `js/data/${f}.js`; sc.async = false; sc.onload = sc.onerror = done; document.head.appendChild(sc); });
}
function lateArrived() {
  absorbLate(); lateReady = baseReady && storiesReady;
  window.dispatchEvent(new Event('lateready'));
  if (waitingRoute && lateReady) { waitingRoute = false; route(); }
}
function loadLate() {
  if (baseReady || loadLate.started) return; loadLate.started = true;
  loadFiles(BASE_FILES, () => {
    baseReady = true; lateArrived();
    // パソコンなど力のある端末は、少ししてから物語も先に読んでおく（スマホは使うときに）
    if (!isPhone() && !/Mobi|Android/i.test(navigator.userAgent)) setTimeout(() => { if (window.requestIdleCallback) requestIdleCallback(() => ensureStories(), { timeout: 4000 }); else ensureStories(); }, 1500);
  });
}
function ensureStories() {
  if (storiesP) return storiesP;
  storiesP = new Promise(res => loadFiles(STORY_FILES, () => { storiesReady = true; if (baseReady) lateArrived(); res(); }));
  return storiesP;
}
window.ensureStories = ensureStories;
let waitingRoute = false;

// 上の切りかえボタン。スマホでは、えらんだ組の中のボタン（出来事・年表…）を2段目に横いっぱいに並べる
let navState = null;
const isPhone = () => window.matchMedia('(max-width: 720px)').matches;
// 画面ボタンを2段目に並べる幅（タブレットや小さいノートパソコンも）
const navTwoRows = () => window.matchMedia('(max-width: 1100px)').matches;
function renderNav() {
  if (!navState) return;
  const { own, secKey } = navState;
  const nav = $('#grpnav'), sub = $('#subnav'); nav.innerHTML = ''; sub.innerHTML = '';
  const phone = navTwoRows();
  GROUPS.forEach(g => {
    const b = el(`<button type="button" class="g" aria-current="${g === own}">${g.name}</button>`);
    b.addEventListener('click', () => { location.hash = '#' + g.secs[0][0]; });
    nav.appendChild(b);
    if (g !== own || g.secs.length < 2) return;
    const subs = el('<span class="subs"></span>');
    g.secs.forEach(([k, n]) => {
      const s = el(`<button type="button" aria-current="${k === secKey}">${n}</button>`);
      s.addEventListener('click', () => { location.hash = '#' + k; });
      subs.appendChild(s);
    });
    (phone ? sub : nav).appendChild(subs);
  });
  sub.hidden = !sub.children.length;
  const cur = $('button[aria-current="true"]', sub);
  if (cur) requestAnimationFrame(() => { sub.scrollLeft = Math.max(0, cur.offsetLeft - sub.clientWidth / 2 + cur.offsetWidth / 2); });
}
let wasPhone = navTwoRows();
window.addEventListener('resize', () => { if (navTwoRows() !== wasPhone) { wasPhone = navTwoRows(); renderNav(); setTopHeight(); } });

// 画面をつくりなおさずに、上の切りかえの表示だけ変える（物語をおえて地図にもどったときなど）
window.setNavSection = key => { const own = GROUPS.find(g => g.secs.some(s => s[0] === key)); if (!own) return; navState = { own, secKey: key }; renderNav(); document.title = `${TOOLS[key] ? TOOLS[key].name : ''} | 世界史クロノマップ`; };

let current = null;
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'map';
  const parts = h.split('/');
  const id = TOOLS[parts[0]] ? parts[0] : 'map';
  let params = {};
  if (id === 'lessons') params = { course: parts[1] || 'sogo', lesson: parts[2] };
  if (id === 'map') {
    const y = parseInt(parts[1], 10);
    params = { year: isFinite(y) ? fixYear(y) : undefined, view: GEO.VIEWS[parts[2]] ? parts[2] : undefined, sel: parts[3] };
  }
  if (id === 'story') params = { story: parts[1], step: parseInt(parts[2], 10) || 1 };
  if (parts[0] === 'term') { location.replace('#glossary/' + (parts[1] || '')); return; }
  if (id === 'glossary') params = { term: parts[1] };
  if (id === 'quiz') params = { review: parts[1] === 'review' };
  const secKey = id === 'lessons' ? `lessons/${params.course}` : id === 'story' ? 'stories' : id;
  const own = GROUPS.find(g => g.secs.some(s => s[0] === secKey)) || GROUPS[0];
  navState = { own, secKey };
  renderNav();
  if (current) { try { current(); } catch (e) { /* 片づけの失敗は無視 */ } }
  const main = $('#main');
  main.innerHTML = '';
  if (!lateReady && id !== 'map') {
    current = null; waitingRoute = true; loadLate(); ensureStories();
    main.appendChild(el('<p class="loading" style="text-align:center;margin-top:30vh;color:var(--muted)">物語や用語のデータを読みこんでいます…</p>'));
    setTopHeight(); return;
  }
  current = TOOLS[id].render(main, params) || null;
  const title = id === 'lessons' ? COURSE[params.course] : TOOLS[id].name;
  document.title = `${title} | 世界史クロノマップ`;
  setTopHeight();
  window.scrollTo(0, 0);
}
function setTopHeight() { document.documentElement.style.setProperty('--top-h', $('#top').offsetHeight + 'px'); }

// 明るさの切りかえ（自動 → 明るい → 暗い）
(function theme() {
  const order = ['auto', 'light', 'dark'], label = { auto: '🌓<span class="lbl"> 自動</span>', light: '☀<span class="lbl"> 明るい</span>', dark: '☾<span class="lbl"> 暗い</span>' };
  let t = store.get('theme', 'auto');
  const apply = () => { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); $('#themeBtn').innerHTML = label[t]; const nm = { auto: '自動', light: '明るい', dark: '暗い' }; $('#themeBtn').setAttribute('aria-label', `明るさ：いまは「${nm[t]}」（おすと切りかえ）`); $('#themeBtn').title = `明るさ：${nm[t]}`; };
  $('#themeBtn').addEventListener('click', () => { t = order[(order.indexOf(t) + 1) % 3]; store.set('theme', t); apply(); });
  apply();
})();

window.addEventListener('hashchange', route);
window.addEventListener('resize', setTopHeight);
route();
// 地図をかき終えてから、残りを読みこむ
// 地図の画面なら、地図を描き終えてから（描く前に重い読みこみが割りこまないように）。ほかの画面ならすぐ
let lateStarted = false;
const startLate = () => { if (lateStarted) return; lateStarted = true; setTimeout(loadLate, 30); };
if (/^#?(map|$)/.test(location.hash.replace(/^#/, '')) || !location.hash) { window.addEventListener('mapdrawn', startLate, { once: true }); setTimeout(startLate, 4000); }
else startLate();

// オフラインでも使えるように（ホーム画面に追加したアプリとしても動く）。ファイルを直接開いたときは使わない
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Android の Chrome など：「アプリにする」ボタンを出す
let installEv = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('#installBtn').hidden = false; setTopHeight(); });
$('#installBtn').addEventListener('click', async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; $('#installBtn').hidden = true; setTopHeight(); });
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });

$('#searchBtn').addEventListener('click', () => openSearch());
