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
const EVENTS = (() => { const seen = new Set(); return (window.EVENTS || []).filter(e => e && e.title && !seen.has(e.title) && seen.add(e.title)).sort((a, b) => a.year - b.year); })();
const LESSONS = (window.LESSONS || []).filter(l => l && l.id);
const PORTRAITS = window.PORTRAITS || {};
const STORIES = (window.STORIES || []).filter(s => s && s.id && s.steps && s.steps.length);
// 物語の「語り」（おもしろく話す版）を場面にくっつける
(function () { const T = window.STORY_TALK || {}; STORIES.forEach(s => { const a = T[s.id]; if (a) s.steps.forEach((st, i) => { if (a[i] && !st.talk) st.talk = a[i]; }); }); })();
const PERSON_DETAIL = window.PERSON_DETAIL || {};
// 歴史的な地名（時代によって名前が変わる町）
const PLACES = (window.PLACES || []).filter(p => p && p.id && p.names && p.names.length);
const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));
// その年の名前（その年にあてはまる名前がないときは null）
function placeNameAt(pl, y) { const n = pl.names.find(n => y >= n.from && y <= n.to); return n || null; }
// 近くの地名（度で 0.35 くらいまで）
function nearPlace(lon, lat, d = 0.35) {
  let best = null, bd = d;
  PLACES.forEach(p => { const dd = Math.hypot((p.lon - lon) * Math.cos(lat * Math.PI / 180), p.lat - lat); if (dd < bd) { bd = dd; best = p; } });
  return best;
}
const EVENT_FUN = window.EVENT_FUN || {};
const ERA_BINS = [[-9999, 500, '古代'], [500, 1500, '中世'], [1500, 1800, '近世'], [1800, 1914, '近代'], [1914, 9999, '現代']];
const eraOf = y => (ERA_BINS.find(b => y >= b[0] && y < b[1]) || ERA_BINS[0])[2];
const STORY = Object.fromEntries(STORIES.map(s => [s.id, s]));
const STORY_KIND = { event: 'できごと', person: '人物', theme: 'テーマ' };
const THEME_NAME = { land: '土地制度', religion: '宗教', war: '戦い方', trade: '交易と貨幣', state: '国家と官僚', science: '文字・科学', society: '社会' };
const storyKind = s => s.kind || 'event';
const lifeStoryOf = pid => STORIES.find(s => s.kind === 'person' && s.person === pid);

// --- 画像資料（ウィキメディア・コモンズから読みこむ。ネットにつながっていないときは出さない） ---
const IMAGES = {};
(window.IMAGES || []).forEach(m => { if (m && m.key && m.file) (IMAGES[m.key] = IMAGES[m.key] || []).push(m); });
const commonsUrl = (file, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${w}`;
function figureHtml(key, max = 1) {
  const ms = (IMAGES[key] || []).slice(0, max);
  return ms.map(m => `<figure class="fig"><img src="${esc(commonsUrl(m.file, 480))}" data-big="${esc(commonsUrl(m.file, 1400))}" alt="${esc(m.what || '')}" loading="lazy" onerror="this.closest('figure').remove()">
    <figcaption>${esc(m.what || '')}<span class="credit">${m.artist ? esc(m.artist) + '・' : ''}${esc(m.license || '')}・<a href="${esc(m.page || '#')}" target="_blank" rel="noopener">コモンズ</a></span></figcaption></figure>`).join('');
}
// 一覧のカード用の小さな画像（リンクを入れない）
function thumbHtml(key) {
  const m = (IMAGES[key] || [])[0];
  return m ? `<img class="thumbimg" src="${esc(commonsUrl(m.file, 360))}" alt="" loading="lazy" onerror="this.remove()">` : '';
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
// 読み上げの基本の語（辞書ファイルがなくても使う）
const SPEECH_BASE = { 元首: 'げんしゅ', 元老院: 'げんろういん', 清教徒: 'せいきょうと', 金印: 'きんいん', 冊封: 'さくほう', 羈縻: 'きび', 藩部: 'はんぶ', 都護府: 'とごふ', 朝貢: 'ちょうこう',
  匈奴: 'きょうど', 鮮卑: 'せんぴ', 柔然: 'じゅうぜん', 突厥: 'とっけつ', 吐蕃: 'とばん', 渤海: 'ぼっかい', 靖康: 'せいこう', 澶淵: 'せんえん', 両税法: 'りょうぜいほう', 均田制: 'きんでんせい',
  府兵制: 'ふへいせい', 租調庸: 'そちょうよう', 一条鞭法: 'いちじょうべんぽう', 地丁銀: 'ちていぎん', 八旗: 'はっき', 緑営: 'りょくえい', 公行: 'こうこう', 洋務運動: 'ようむうんどう', 変法: 'へんぽう',
  義和団: 'ぎわだん', 辛亥: 'しんがい', 盧溝橋: 'ろこうきょう', 満洲: 'まんしゅう', 廃兵院: 'はいへいいん', 三部会: 'さんぶかい', 球戯場: 'きゅうぎじょう', 大陸封鎖令: 'たいりくふうされい', 贖宥状: 'しょくゆうじょう' };
const SPEECH = {
  ok: typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  on: store.get('tts', false),
  rate: store.get('ttsRate', 1.0),
  voiceName: store.get('ttsVoice', ''),
  tok: 0,
  // 日本語の声を「自然さ」の順に並べる（ニューラル音声 → Google → 高品質版 → そのほか）
  voices() {
    if (!this.ok) return [];
    const score = v => {
      const n = v.name;
      if (/Natural|Neural|Online/i.test(n)) return 0;
      if (/Google/i.test(n)) return 1;
      if (/Premium|Enhanced|拡張|高品質/i.test(n)) return 2;
      if (/Kyoko|O-ren|Otoya|Hattori|Nanami|Haruka|Ayumi|Sayaka|Ichiro/i.test(n)) return 3;
      return 4;
    };
    return speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)).sort((a, b) => score(a) - score(b) || (b.localService ? 0 : 1) - (a.localService ? 0 : 1));
  },
  voice() {
    const vs = this.voices();
    return vs.find(v => v.name === this.voiceName) || vs[0] || null;
  },
  // 読み仮名の辞書：YOMI（js/data/yomi-*.js）＋ 人物の読み（people.js の kana）＋ 基本の語
  _dict: null,
  dict() {
    if (this._dict) return this._dict;
    const map = Object.assign({}, SPEECH_BASE, window.YOMI || {});
    // 人名：漢字だけの名前（例：李白）に読み（りはく）があれば使う。「劉邦（高祖）」のようなものは、かっこの前だけ
    (window.PEOPLE || []).forEach(p => {
      if (!p.kana) return;
      const nm = String(p.name).replace(/（.*?）|\(.*?\)/g, '').trim(), kn = String(p.kana).replace(/（.*?）|\(.*?\)/g, '').trim();
      if (/^[一-龥々]{2,}$/.test(nm) && /^[ぁ-んー・ 　]+$/.test(kn) && !map[nm]) map[nm] = kn.replace(/[・ 　]/g, '');
    });
    const keys = Object.keys(map).filter(k => k.length >= 2 && map[k]).sort((a, b) => b.length - a.length);
    const esc2 = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this._dict = { map, re: keys.length ? new RegExp(keys.map(esc2).join('|'), 'g') : null };
    return this._dict;
  },
  // 歴史の文を、読みまちがえにくい形に
  clean(t) {
    let s = String(t || '');
    s = s.replace(/(紀元)?前\s*(\d+)/g, 'きげんぜん$2').replace(/(きげん)+ぜん/g, 'きげんぜん')
      .replace(/(\d+)〜(\d+)年/g, '$1年から$2年').replace(/〜/g, 'から')
      .replace(/[=＝・]/g, (m, i) => (m === '・' ? '、' : ''))
      .replace(/[「」『』]/g, '').replace(/📍|🔗/g, '').replace(/→/g, '、そして、')
      .replace(/[（(]/g, '、').replace(/[）)]/g, '、')
      .replace(/、\s*、/g, '、').replace(/、。/g, '。');
    // 読み仮名の辞書（長い語から先に置きかえる）
    const D = SPEECH.dict();
    if (D.re) s = s.replace(D.re, w => D.map[w]);
    // 王朝の名前（1文字）：あとに「の・は・が・朝・代…」が続くときだけ、読みをひらがなに
    const DYN = { 殷: 'いん', 周: 'しゅう', 秦: 'しん', 漢: 'かん', 魏: 'ぎ', 呉: 'ご', 蜀: 'しょく', 晋: 'しん', 隋: 'ずい', 唐: 'とう', 宋: 'そう', 遼: 'りょう', 元: 'げん', 明: 'みん', 清: 'しん', 金: 'きん' };
    s = s.replace(/(^|[^一-龥々])([殷周秦漢魏呉蜀晋隋唐宋遼元明清])(?=(の|は|が|を|に|と|で|も|へ|や|朝|代|軍|帝|王|、|。|$))/g, (m, pre, c) => pre + DYN[c]);
    return s;
  },
  // 文ごとに分ける（句点・感嘆符・疑問符のあと）
  sentences(t) {
    return String(t || '').split(/(?<=[。！？!?])\s*/).map(x => x.trim()).filter(x => x.replace(/[。、\s]/g, '').length);
  },
  // parts を順に読む。onPart(i) で今どの文かを知らせる
  speakParts(parts, onend, onPart) {
    if (!this.ok) { if (onend) setTimeout(onend, 4000); return; }
    speechSynthesis.cancel();
    const tok = ++this.tok;
    const v = this.voice();
    let i = 0;
    const next = () => {
      if (tok !== this.tok) return;
      if (i >= parts.length) { this.tok++; if (onend) onend(); return; }
      if (onPart) onPart(i);
      const u = new SpeechSynthesisUtterance(this.clean(parts[i]));
      u.lang = 'ja-JP'; u.rate = this.rate; u.pitch = 1;
      if (v) u.voice = v;
      i++;
      // 文と文のあいだに少し間をおく（題のあとは長めに）
      const gap = i === 1 && parts.length > 1 ? 380 : 220;
      u.onend = () => setTimeout(next, gap);
      u.onerror = e => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; setTimeout(next, gap); };
      speechSynthesis.speak(u);
    };
    next();
  },
  speak(text, onend, onPart) { this.speakParts(this.sentences(text), onend, onPart); },
  speaking() { return this.ok && speechSynthesis.speaking; },
  stop() { this.tok++; if (this.ok) speechSynthesis.cancel(); },
  setOn(v) { this.on = v; store.set('tts', v); if (!v) this.stop(); },
  setRate(r) { this.rate = r; store.set('ttsRate', r); },
  setVoice(n) { this.voiceName = n; store.set('ttsVoice', n); }
};
if (SPEECH.ok) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices()); }
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
