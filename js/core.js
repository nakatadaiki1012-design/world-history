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
const POLITY = Object.fromEntries(POLITIES.map(p => [p.id, p]));
const PEOPLE = (window.PEOPLE || []).filter(p => p && p.id && p.name).sort((a, b) => a.born - b.born);
const PERSON = Object.fromEntries(PEOPLE.map(p => [p.id, p]));
const EVENTS = (window.EVENTS || []).filter(e => e && e.title).sort((a, b) => a.year - b.year);
const LESSONS = (window.LESSONS || []).filter(l => l && l.id);
const PORTRAITS = window.PORTRAITS || {};
const STORIES = (window.STORIES || []).filter(s => s && s.id && s.steps && s.steps.length);
const STORY = Object.fromEntries(STORIES.map(s => [s.id, s]));
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
