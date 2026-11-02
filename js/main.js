/* 画面の切りかえ（地図と年表／挑戦／授業モード）と、URL の # による直接リンク */
const GROUPS = [
  { id: 'see', name: '地図と年表', secs: [['map', '🗺 歴史地図'], ['chrono', '年表'], ['people', '人物図鑑']] },
  { id: 'try', name: '挑戦', secs: [['quiz', 'クイズ']] },
  { id: 'class', name: '授業<span class="lbl">モード</span>', secs: [['lessons/sogo', '歴史総合'], ['lessons/tankyu', '世界史探究']] }
];

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
  const secKey = id === 'lessons' ? `lessons/${params.course}` : id;
  const own = GROUPS.find(g => g.secs.some(s => s[0] === secKey)) || GROUPS[0];
  const nav = $('#grpnav'); nav.innerHTML = '';
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
    nav.appendChild(subs);
  });
  if (current) { try { current(); } catch (e) { /* 片づけの失敗は無視 */ } }
  const main = $('#main');
  main.innerHTML = '';
  current = TOOLS[id].render(main, params) || null;
  const title = id === 'lessons' ? COURSE[params.course] : TOOLS[id].name;
  document.title = `${title} | 世界史ラボ`;
  setTopHeight();
  window.scrollTo(0, 0);
}
function setTopHeight() { document.documentElement.style.setProperty('--top-h', $('#top').offsetHeight + 'px'); }

// 明るさの切りかえ（自動 → 明るい → 暗い）
(function theme() {
  const order = ['auto', 'light', 'dark'], label = { auto: '🌓<span class="lbl"> 自動</span>', light: '☀<span class="lbl"> 明るい</span>', dark: '☾<span class="lbl"> 暗い</span>' };
  let t = store.get('theme', 'auto');
  const apply = () => { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); $('#themeBtn').innerHTML = label[t]; };
  $('#themeBtn').addEventListener('click', () => { t = order[(order.indexOf(t) + 1) % 3]; store.set('theme', t); apply(); });
  apply();
})();

window.addEventListener('hashchange', route);
window.addEventListener('resize', setTopHeight);
route();
