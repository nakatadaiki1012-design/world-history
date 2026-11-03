/* 世界史ラボ：共通の部品（保存・地域・年の目盛り など） */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// --- 保存（ブラウザの中だけ。使えないときは保存しないで動く） ---
const store = {
  key: 'worldHistoryLab.v1',
  data: null,
  load() { if (this.data) return this.data; try { this.data = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { this.data = {}; } return this.data; },
  get(k, d) { const v = this.load()[k]; return v === undefined ? d : v; },
  set(k, v) { this.load()[k] = v; try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* 保存できない環境 */ } }
};

// --- 道具の登録 ---
const TOOLS = {};
function registerTool(id, def) { TOOLS[id] = Object.assign({ id }, def); }

// --- データ（読みこめなかったファイルがあっても動くように） ---
const POLITIES = (window.POLITIES || []).filter(p => p && p.id && p.name);
// 同じ地域の国は同じ系統の色なので、となりどうしが見分けやすいように、国ごとに色合い・明るさを少しずらす（いつも同じずらし方）
(function varyColors() {
  const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  POLITIES.forEach(p => {
    const c = d3.hsl(p.color || '#888'); if (!isFinite(c.h)) return;
    const a = hash(p.id), b = hash(p.id + '*');
    c.h = (c.h + (a - 0.5) * 56 + 360) % 360;
    c.s = Math.min(0.85, Math.max(0.3, c.s + 0.12));
    c.l = Math.min(0.62, Math.max(0.3, c.l + (b - 0.5) * 0.22));
    p.color = c.formatHex();
  });
})();
const POLITY = Object.fromEntries(POLITIES.map(p => [p.id, p]));
const PEOPLE = (window.PEOPLE || []).filter(p => p && p.id && p.name).sort((a, b) => a.born - b.born);
const PERSON = Object.fromEntries(PEOPLE.map(p => [p.id, p]));
const EVENTS = (window.EVENTS || []).filter(e => e && e.title).sort((a, b) => a.year - b.year);
const LESSONS = (window.LESSONS || []).filter(l => l && l.id);
const PORTRAITS = window.PORTRAITS || {};
const STORIES = (window.STORIES || []).filter(s => s && s.id && s.steps && s.steps.length);
const STORY = Object.fromEntries(STORIES.map(s => [s.id, s]));

// --- 画像資料（ウィキメディア・コモンズから読みこむ。ネットにつながっていないときは出さない） ---
const IMAGES = {};
(window.IMAGES || []).forEach(m => { if (m && m.key && m.file) (IMAGES[m.key] = IMAGES[m.key] || []).push(m); });
const commonsUrl = (file, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${w}`;
function figureHtml(key, max = 1) {
  const ms = (IMAGES[key] || []).slice(0, max);
  return ms.map(m => `<figure class="fig"><img src="${esc(commonsUrl(m.file, 480))}" data-big="${esc(commonsUrl(m.file, 1400))}" alt="${esc(m.what || '')}" loading="lazy" onerror="this.closest('figure').remove()">
    <figcaption>${esc(m.what || '')}<span class="credit">${m.artist ? esc(m.artist) + '・' : ''}${esc(m.license || '')}・<a href="${esc(m.page || '#')}" target="_blank" rel="noopener">コモンズ</a></span></figcaption></figure>`).join('');
}
// 画像をおすと大きく
document.addEventListener('click', e => {
  const img = e.target.closest('.fig img');
  if (!img) return;
  const ov = el(`<div class="lightbox" role="dialog" aria-label="画像を大きく"><img src="${esc(img.dataset.big || img.src)}" alt=""><div class="cap">${img.closest('figure').querySelector('figcaption').innerHTML}</div></div>`);
  ov.addEventListener('click', ev => { if (!ev.target.closest('a')) ov.remove(); });
  document.body.appendChild(ov);
});

// --- 原因と結果 ---
const EVENT_IDX = Object.fromEntries(EVENTS.map((e, i) => [e.title, i]));
const CAUSES = (window.CAUSES || []).filter(c => c && EVENT_IDX[c.from] != null && EVENT_IDX[c.to] != null);
const STORY_CAUSES = window.STORY_CAUSES || {};
const CAUSE_KIND = { background: '背景', cause: '原因', trigger: 'きっかけ', result: '結果' };
const causesOf = i => CAUSES.filter(c => c.to === EVENTS[i].title).map(c => ({ i: EVENT_IDX[c.from], kind: c.kind, why: c.why }));
const resultsOf = i => CAUSES.filter(c => c.from === EVENTS[i].title).map(c => ({ i: EVENT_IDX[c.to], kind: c.kind, why: c.why }));
// 出来事から原因をさかのぼって、地図でたどれる「物語」を作る
function spanForEvent(e) { return e.kind === 'war' ? 14 : 10; }
function eventStep(i, why) {
  const e = EVENTS[i];
  return { year: e.year, title: e.title, text: e.text || '', place: e.place, lon: e.lon, lat: e.lat, span: spanForEvent(e), why, imageKey: 'event:' + e.title, eventIdx: i };
}
function chainStory(target, depth = 3, max = 9) {
  const seen = new Map([[target, null]]);
  let frontier = [target];
  for (let d = 0; d < depth && seen.size < max; d++) {
    const next = [];
    frontier.forEach(i => causesOf(i).sort((a, b) => ({ trigger: 0, cause: 1, background: 2, result: 3 }[a.kind] - { trigger: 0, cause: 1, background: 2, result: 3 }[b.kind]))
      .forEach(c => { if (!seen.has(c.i) && seen.size < max) { seen.set(c.i, { to: i, kind: c.kind, why: c.why }); next.push(c.i); } }));
    frontier = next;
  }
  const order = [...seen.keys()].sort((a, b) => EVENTS[a].year - EVENTS[b].year || (a === target ? 1 : b === target ? -1 : 0));
  const steps = order.map(i => {
    const l = seen.get(i);
    return eventStep(i, l ? `${CAUSE_KIND[l.kind] || '原因'} → 「${EVENTS[l.to].title}」：${l.why}` : '');
  });
  const e = EVENTS[target];
  return { id: 'chain:' + target, title: `なぜ「${e.title}」は起きた？`, period: `${yearLabel(EVENTS[order[0]].year)}〜${yearLabel(e.year)}`, region: e.region,
    view: REGION_VIEW_OF[e.region] || 'world', summary: `「${e.title}」の背景・原因・きっかけを、古い順にたどります。`, steps, generated: true };
}
const REGION_VIEW_OF = { east: 'eastasia', inner: 'inner', south: 'southasia', sea: 'seasia', west: 'westasia', europe: 'europe', africa: 'africa', america: 'america', oceania: 'world' };
const SPHERE_KIND = { tribute: '朝貢・冊封の範囲', suzerain: '宗主権・保護国', influence: '勢力範囲', bloc: '陣営・同盟', claim: '名目上の支配' };
// 人物の肖像（ないときは頭文字のメダル）
function portraitImg(p, cls = 'pimg') {
  const ph = PORTRAITS[p.id];
  const c = (REGION[p.region] || {}).color || '#555';
  if (ph) return `<img class="${cls}" src="${esc(ph.src)}" alt="${esc(p.name)}" loading="lazy" style="border-color:${c}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} ini',textContent:'${esc(p.name[0])}'}))">`;
  return `<span class="${cls} ini" style="background:${c}">${esc(p.name[0])}</span>`;
}

const REGIONS = [
  { id: 'east', name: '東アジア', color: '#c0392b' },
  { id: 'inner', name: '内陸アジア', color: '#a0522d' },
  { id: 'south', name: '南アジア', color: '#e69b00' },
  { id: 'sea', name: '東南アジア', color: '#7cb342' },
  { id: 'west', name: '西アジア・北アフリカ', color: '#1e8449' },
  { id: 'europe', name: 'ヨーロッパ', color: '#1f5f8b' },
  { id: 'africa', name: 'アフリカ', color: '#d4ac0d' },
  { id: 'america', name: 'アメリカ', color: '#148f77' },
  { id: 'oceania', name: 'オセアニア', color: '#5d6d7e' }
];
const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r]));
const KIND = { politics: '政治', war: '戦争', culture: '文化・宗教', economy: '経済・交易', society: '社会' };
const KIND_COLOR = { politics: '#1f4e79', war: '#c0392b', culture: '#7d3c98', economy: '#b9770e', society: '#2c8350' };
const COURSE = { sogo: '歴史総合', tankyu: '世界史探究' };

const yearLabel = y => GEO.yearLabel(Math.round(y));
const span = (a, b) => `${yearLabel(a)}〜${b >= 2025 ? '現在' : yearLabel(b)}`;
function lifeSpan(p) { return `${p.about ? 'ごろ ' : ''}${yearLabel(p.born)}〜${yearLabel(p.died)}`.replace(/^ごろ (.*)$/, '$1ごろ'); }

// --- 年のツマミの目盛り（古い時代は粗く、新しい時代はこまかく） ---
const YEAR_MIN = -3000, YEAR_MAX = 2025;
const YSEG = [[-3000, 0], [-1000, 8], [0, 22], [1000, 47], [1500, 62], [1800, 80], [2025, 100]];
function yearToPos(y) {
  for (let i = 1; i < YSEG.length; i++) {
    const [y0, p0] = YSEG[i - 1], [y1, p1] = YSEG[i];
    if (y <= y1) return p0 + (clamp(y, y0, y1) - y0) / (y1 - y0) * (p1 - p0);
  }
  return 100;
}
function posToYear(p) {
  for (let i = 1; i < YSEG.length; i++) {
    const [y0, p0] = YSEG[i - 1], [y1, p1] = YSEG[i];
    if (p <= p1) return Math.round(y0 + (clamp(p, p0, p1) - p0) / (p1 - p0) * (y1 - y0));
  }
  return YEAR_MAX;
}
function fixYear(y) { y = Math.round(clamp(y, YEAR_MIN, YEAR_MAX)); return y === 0 ? 1 : y; }
// 年の加算（紀元0年をとばす）
function addYear(y, d) { let n = y + d; if (y < 0 && n >= 0) n += 1; else if (y > 0 && n <= 0) n -= 1; return fixYear(n); }

// 時代の名前（大まかな目安）
const ERAS = [
  [-3000, -800, '古代文明の時代'], [-800, -330, 'ギリシア・春秋戦国・ペルシアの時代'], [-330, 200, '秦漢帝国とローマ帝国の時代'],
  [200, 600, '民族移動と分裂の時代'], [600, 900, '唐とイスラームの拡大'], [900, 1200, '宋とセルジューク・十字軍の時代'],
  [1200, 1370, 'モンゴル帝国の時代'], [1370, 1500, '明・ティムール・オスマンの時代'], [1500, 1650, '大航海時代とアジアの帝国'],
  [1650, 1770, '主権国家と近世の帝国'], [1770, 1850, '環大西洋革命と産業革命'], [1850, 1914, '帝国主義の時代'],
  [1914, 1945, '二つの世界大戦'], [1945, 1991, '冷戦と脱植民地化'], [1991, 2026, 'グローバル化の時代']
];
function eraName(y) { const e = ERAS.find(e => y >= e[0] && y < e[1]); return e ? e[2] : ''; }

// 色が明るいか（文字を黒にするか）
function isLight(c) { const x = d3.color(c); if (!x) return false; const { r, g, b } = x.rgb(); return (r * 299 + g * 587 + b * 114) / 1000 > 165; }

// 授業でよく使う「地図で見る」リンク
function mapHash(year, view, extra) { return `#map/${year}/${view || 'world'}${extra ? '/' + extra : ''}`; }

// --- 音声の読み上げ（ブラウザに入っている日本語の声を使う。インターネットは不要なことが多い） ---
const SPEECH = {
  ok: typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  on: store.get('tts', false),
  rate: store.get('ttsRate', 1.05),
  tok: 0,
  voice() {
    const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
    return vs.find(v => /Google|Nanami|Kyoko|Haruka|Ayumi|O-ren|Otoya/i.test(v.name)) || vs[0] || null;
  },
  // 読みやすく：前221年→紀元前221年、チンギス=カン→チンギスカン、〜→から
  clean(t) {
    return String(t || '').replace(/前(\d+)年/g, '紀元前$1年').replace(/前(\d+)/g, '紀元前$1').replace(/[=＝]/g, '').replace(/〜/g, 'から')
      .replace(/[「」『』]/g, '').replace(/📍|🔗|→/g, '、');
  },
  speak(text, onend) {
    if (!this.ok) { if (onend) setTimeout(onend, 4000); return; }
    speechSynthesis.cancel();
    const tok = ++this.tok;
    const u = new SpeechSynthesisUtterance(this.clean(text));
    u.lang = 'ja-JP'; u.rate = this.rate;
    const v = this.voice(); if (v) u.voice = v;
    const done = () => { if (tok === this.tok) { this.tok++; if (onend) onend(); } };
    u.onend = done; u.onerror = done;
    speechSynthesis.speak(u);
  },
  speaking() { return this.ok && speechSynthesis.speaking; },
  stop() { this.tok++; if (this.ok) speechSynthesis.cancel(); },
  setOn(v) { this.on = v; store.set('tts', v); if (!v) this.stop(); }
};
if (SPEECH.ok) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
// 「🔊 読み上げ」ボタン（もう一度おすと止まる）
function speakBtn(getText, label = '🔊 読み上げ') {
  const b = el(`<button type="button" class="chip speak">${label}</button>`);
  if (!SPEECH.ok) { b.disabled = true; b.title = 'このブラウザでは読み上げが使えません'; }
  b.addEventListener('click', () => {
    if (b.classList.contains('on')) { SPEECH.stop(); b.classList.remove('on'); return; }
    $$('.speak.on').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    SPEECH.speak(getText(), () => b.classList.remove('on'));
  });
  return b;
}
