#!/usr/bin/env node
/* データの点検：node tools/check-data.js
   アプリと同じ順番で js/data/*.js を全部読みこみ、次のようなことを調べる。
   - ファイルが読みこめるか（書きまちがいで壊れていないか）、使われていないファイル・見つからないファイルはないか
   - それぞれのデータに必要な項目があるか、年・経度・緯度・地域などの値がおかしくないか
   - ほかのデータへのつながり（人物 → 国、物語 → 人物、画像 → 物語、用語 → 出来事 など）が切れていないか
   - id や題が重なっていないか（重なると、アプリが黙って片方を捨ててしまう）
   問題があれば「エラー」として表示し、終了コード 1 で終わる（コミット前の点検・GitHub の自動点検で使う）。
   「注意」は、すぐには壊れないが見ておきたいもの。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'js/data');
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------- 1. 読みこむファイルの一覧（index.html と js/main.js の LATE_FILES から） ----------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const early = [...html.matchAll(/<script src="js\/data\/([^"?]+)\.js/g)].map(m => m[1]);
const mainJs = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
const lateM = mainJs.match(/const LATE_FILES = (\[[^\]]*\])/);
const late = lateM ? JSON.parse(lateM[1]) : [];
if (!lateM) err('js/main.js', 'LATE_FILES が見つからない');
const listed = [...early, ...late];
listed.filter((f, i) => listed.indexOf(f) !== i).forEach(f => err('読みこみ一覧', `${f}.js が2回読まれる`));
const onDisk = fs.readdirSync(DATA).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''));
listed.filter(f => !onDisk.includes(f)).forEach(f => err('読みこみ一覧', `js/data/${f}.js がない`));
onDisk.filter(f => !listed.includes(f)).forEach(f => warn('js/data', `${f}.js はどこからも読まれていない`));

// ---------- 2. ブラウザと同じように、順番に読みこむ ----------
const sandbox = {};
sandbox.window = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of listed) {
  const file = path.join(DATA, f + '.js');
  if (!fs.existsSync(file)) continue;
  try { vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: `js/data/${f}.js` }); }
  catch (e) {
    const line = (e.stack || '').split('\n').find(l => l.includes(`js/data/${f}.js`)) || '';
    err(`js/data/${f}.js`, `読みこめない（${e.message}）${line.trim()}`);
  }
}
const W = sandbox;
const arr = v => (Array.isArray(v) ? v : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// ---------- 3. 共通の決まり ----------
const REGIONS = new Set(['east', 'inner', 'south', 'sea', 'west', 'europe', 'africa', 'america', 'oceania']);
const isYear = y => Number.isInteger(y) && y >= -10000000 && y <= 2100;   // 先史時代（人類の誕生など）も入る
const isLon = x => typeof x === 'number' && isFinite(x) && x >= -180 && x <= 180;
const isLat = y => typeof y === 'number' && isFinite(y) && y >= -90 && y <= 90;
const str = s => typeof s === 'string' && s.trim().length > 0;
const dupes = (list, key) => { const seen = new Set(), d = new Set(); list.forEach(x => { const k = key(x); if (seen.has(k)) d.add(k); seen.add(k); }); return [...d]; };
function checkLL(where, o) { if (!isLon(o.lon) || !isLat(o.lat)) err(where, `経度・緯度がおかしい（${o.lon}, ${o.lat}）`); }
function checkPts(where, pts) { if (!Array.isArray(pts) || pts.length < 2) { err(where, '点の列（pts）が2点未満'); return; } pts.forEach((p, i) => { if (!Array.isArray(p) || !isLon(p[0]) || !isLat(p[1])) err(where, `pts[${i}] の経度・緯度がおかしい`); }); }

// ---------- 4. 国・王朝（POLITIES） ----------
const POL = arr(W.POLITIES);
const polIds = new Set(POL.map(p => p.id));
dupes(POL, p => p.id).forEach(id => err('国・王朝', `id「${id}」が重なっている`));
POL.forEach(p => {
  const w = `国・王朝 ${p.id || '(idなし)'}`;
  if (!str(p.id) || !str(p.name)) err(w, 'id か name がない');
  if (!REGIONS.has(p.region)) err(w, `region「${p.region}」が決まりにない`);
  if (!isYear(p.start) || !isYear(p.end) || p.start > p.end) err(w, `start/end がおかしい（${p.start}〜${p.end}）`);
  if (!/^#[0-9a-f]{3,8}$/i.test(p.color || '')) warn(w, `色（color）が #xxxxxx でない：${p.color}`);
  arr(p.shapes).forEach((s, i) => {
    if (!isYear(s.from) || !isYear(s.to) || s.from > s.to) err(w, `shapes[${i}] の from/to がおかしい`);
    if (!s.rings && !s.iso) err(w, `shapes[${i}] に形（rings か iso）がない`);
    arr(s.rings).forEach((r, j) => { if (!Array.isArray(r) || r.length < 3 || r.some(q => !Array.isArray(q) || !(Math.abs(q[0]) <= 360) || !isLat(q[1]))) err(w, `shapes[${i}].rings[${j}] の点がおかしい`); });   // 日付変更線をまたぐ形は 180 度をこえて書いてよい
  });
  if (p.capital) checkLL(`${w} の都`, p.capital);
  arr(p.capitals).forEach((c, i) => { checkLL(`${w} の都[${i}]`, c); if (!isYear(c.from) || !isYear(c.to)) err(w, `capitals[${i}] の from/to がおかしい`); });
  if (p.label && (!isLon(p.label[0]) || !isLat(p.label[1]))) err(w, 'label の経度・緯度がおかしい');
});
// くわしい形（shapes-precise.js）：国の id と形の年が、POLITIES にあるか
const PRE = obj(W.PRECISE_D || W.PRECISE);
Object.entries(PRE).forEach(([id, m]) => {
  const p = POL.find(x => x.id === id);
  if (!p) { err('くわしい形', `国「${id}」が POLITIES にない`); return; }
  Object.keys(m).forEach(k => {
    if (k.startsWith('sphere:')) { if (!arr(p.spheres)[+k.slice(7)]) err('くわしい形', `${id} の ${k} にあたる勢力圏がない`); }
    else if (!arr(p.shapes).some(s => String(s.from) === k)) err('くわしい形', `${id} の形「${k}年から」が POLITIES にない`);
    arr(m[k]).forEach((r, i) => { if (W.PRECISE_D && (!Array.isArray(r) || r.length % 2 || r.some(v => !Number.isInteger(v)))) err('くわしい形', `${id} ${k} の輪 ${i} の数の列がおかしい`); });
  });
});

// ---------- 5. 人物（PEOPLE） ----------
const PPL = arr(W.PEOPLE);
const pid = new Set(PPL.map(p => p.id));
dupes(PPL, p => p.id).forEach(id => err('人物', `id「${id}」が重なっている`));
PPL.forEach(p => {
  const w = `人物 ${p.id || '(idなし)'}`;
  if (!str(p.id) || !str(p.name)) err(w, 'id か name がない');
  if (!isYear(p.born) || !isYear(p.died) || p.born > p.died) err(w, `生没年がおかしい（${p.born}〜${p.died}）`);
  if (p.died - p.born > 110) warn(w, `生きた年数が ${p.died - p.born} 年`);
  if (!REGIONS.has(p.region)) err(w, `region「${p.region}」が決まりにない`);
  if (p.polity && !polIds.has(p.polity)) err(w, `polity「${p.polity}」という国がない`);
  if (!arr(p.places).length) err(w, '足あと（places）がない');
  arr(p.places).forEach((pl, i) => {
    checkLL(`${w} の足あと[${i}]`, pl);
    if (!isYear(pl.from) || pl.from < p.born - 1 || pl.from > p.died + 1) err(w, `足あと[${i}]「${pl.name}」の年 ${pl.from} が生没年の外`);
  });
});

// ---------- 6. 出来事（EVENTS） ----------
const EV = arr(W.EVENTS);
const evT = new Set(EV.map(e => e.title));
dupes(EV, e => e.title).forEach(t => err('出来事', `題「${t}」が重なっている（アプリは片方を捨てる）`));
EV.forEach(e => {
  const w = `出来事「${e.title}」`;
  if (!str(e.title)) err('出来事', '題（title）のないものがある');
  if (!isYear(e.year)) err(w, `年がおかしい（${e.year}）`);
  if (e.end != null && (!isYear(e.end) || e.end < e.year)) err(w, `end がおかしい（${e.end}）`);
  if (!REGIONS.has(e.region)) err(w, `region「${e.region}」が決まりにない`);
  checkLL(w, e);
  if (!str(e.text)) warn(w, '説明（text）がない');
});

// ---------- 7. 歴史的な地名（PLACES） ----------
const PL = arr(W.PLACES);
const plIds = new Set(PL.map(p => p.id));
dupes(PL, p => p.id).forEach(id => err('地名', `id「${id}」が重なっている`));
PL.forEach(p => {
  const w = `地名 ${p.id}`;
  checkLL(w, p);
  if (!arr(p.names).length) err(w, 'names がない');
  arr(p.names).forEach((n, i) => { if (!str(n.name) || !isYear(n.from) || !isYear(n.to) || n.from > n.to) err(w, `names[${i}] がおかしい`); });
});

// ---------- 8. 物語（STORIES）と語り ----------
const ST = arr(W.STORIES);
const stById = new Map(ST.map(s => [s.id, s]));
dupes(ST, s => s.id).forEach(id => err('物語', `id「${id}」が重なっている`));
ST.forEach(s => {
  const w = `物語 ${s.id}`;
  if (!str(s.id) || !str(s.title)) err(w, 'id か title がない');
  if (!arr(s.steps).length) { err(w, '場面（steps）がない'); return; }
  if (s.person && !pid.has(s.person)) err(w, `person「${s.person}」という人物がない`);
  s.steps.forEach((st, i) => {
    const ws = `${w} 場面${i + 1}`;
    if (!isYear(st.year)) err(ws, `年がおかしい（${st.year}）`);
    if (!str(st.title) || !str(st.text)) err(ws, 'title か text がない');
    checkLL(ws, st);
    if (st.span != null && !(st.span > 0)) err(ws, `span がおかしい（${st.span}）`);
    arr(st.people).forEach(x => { if (!pid.has(x)) err(ws, `人物「${x}」がない`); });
    arr(st.polities).forEach(x => { if (!polIds.has(x)) err(ws, `国「${x}」がない`); });
    arr(st.marks).forEach((m, j) => checkLL(`${ws} の印[${j}]`, m));
    arr(st.routes).forEach((r, j) => checkPts(`${ws} の進路[${j}]`, r.pts));
    arr(st.lines).forEach((r, j) => checkPts(`${ws} の線[${j}]`, r.pts));
  });
});
Object.entries(obj(W.STORY_TALK)).forEach(([id, a]) => { if (!stById.has(id)) warn('語り（story-talk）', `物語「${id}」がない`); });
Object.entries(obj(W.STORY_TALK_NEW)).forEach(([id, a]) => {
  const s = stById.get(id);
  if (!s) { err('語り（story-talk-new）', `物語「${id}」がない`); return; }
  if (!Array.isArray(a) || a.length !== s.steps.length) err('語り（story-talk-new）', `物語「${id}」：語りの数 ${arr(a).length} と場面の数 ${s.steps.length} がちがう（アプリは使わない）`);
  arr(a).forEach((t, i) => { if (!str(t)) err('語り（story-talk-new）', `物語「${id}」場面${i + 1} の語りが空`); });
});
Object.keys(obj(W.STORY_CAUSES)).forEach(id => { if (!stById.has(id)) err('物語の原因', `物語「${id}」がない`); });

// ---------- 9. 「💡」の一言・人物のくわしいページ ----------
Object.entries(obj(W.EVENT_FUN)).forEach(([t, v]) => {
  if (!evT.has(t)) err('ここがおもしろい', `出来事「${t}」がない（題が変わった？）`);
  if (!str(v)) err('ここがおもしろい', `「${t}」が空`);
});
Object.entries(obj(W.PERSON_FUN)).forEach(([id, a]) => {
  if (!pid.has(id)) err('実はこんな人', `人物「${id}」がない`);
  if (!Array.isArray(a) || !a.length || a.some(t => !str(t))) err('実はこんな人', `「${id}」の形がおかしい（文の並びにする）`);
});
Object.entries(obj(W.PERSON_DETAIL)).forEach(([id, d]) => {
  const w = `くわしいページ ${id}`;
  if (!pid.has(id)) { err(w, 'この人物がない'); return; }
  if (!str(d.catch)) err(w, 'catch がない');
  if (!arr(d.story).length || d.story.some(t => !str(t))) err(w, 'story（本文の段落）がおかしい');
  arr(d.life).forEach((l, i) => { if (!isYear(l.year) || !str(l.text)) err(w, `年表[${i}] がおかしい`); });
  arr(d.episodes).forEach((e, i) => { if (!str(e.title) || !str(e.text)) err(w, `エピソード[${i}] に title か text がない`); });
  if (d.quote && !str(d.quote.text)) err(w, 'quote.text がない');
});
PPL.forEach(p => { if (!obj(W.PERSON_DETAIL)[p.id]) warn(`人物 ${p.id}`, 'くわしいページがない'); });

// ---------- 10. 画像（IMAGES）・肖像（PORTRAITS） ----------
const lesIds = new Set(arr(W.LESSONS).map(l => l.id));
arr(W.IMAGES).forEach((m, i) => {
  const w = `画像 ${m.key}`;
  if (!str(m.key) || !str(m.file)) { err(`画像[${i}]`, 'key か file がない'); return; }
  if (!str(m.license)) warn(w, 'ライセンス（license）がない');
  const [kind, id, n] = m.key.split(':');
  if (kind === 'story') { const s = stById.get(id); if (!s) err(w, '物語がない'); else if (n && (+n < 1 || +n > s.steps.length)) err(w, `場面 ${n} がない`); }
  else if (kind === 'person') { if (!pid.has(id)) err(w, '人物がない'); }
  else if (kind === 'polity') { if (!polIds.has(id)) err(w, '国がない'); }
  else if (kind === 'event') { if (!evT.has(m.key.slice(6))) err(w, '出来事がない'); }
  else if (kind === 'place') { if (!plIds.has(id)) err(w, '地名がない'); }
  else if (kind === 'lesson') { if (!lesIds.has(id)) err(w, '授業がない'); }
  else err(w, `種類「${kind}」が決まりにない`);
});
Object.entries(obj(W.PORTRAITS)).forEach(([id, ph]) => {
  if (!pid.has(id)) warn('肖像', `人物「${id}」がない`);
  if (ph.src && !/^https?:/.test(ph.src) && !fs.existsSync(path.join(ROOT, ph.src))) err('肖像', `${id} の画像ファイル ${ph.src} がない`);
});

// ---------- 11. 原因と結果（CAUSES）・授業（LESSONS）・用語（GLOSSARY） ----------
const KINDS = new Set(['background', 'cause', 'trigger', 'result']);
arr(W.CAUSES).forEach((c, i) => {
  if (!evT.has(c.from)) err('原因と結果', `[${i}] from「${c.from}」という出来事がない`);
  if (!evT.has(c.to)) err('原因と結果', `[${i}] to「${c.to}」という出来事がない`);
  if (!KINDS.has(c.kind)) err('原因と結果', `[${i}] kind「${c.kind}」が決まりにない`);
});
dupes(arr(W.LESSONS), l => l.id).forEach(id => err('授業', `id「${id}」が重なっている`));
arr(W.LESSONS).forEach(l => { if (!['sogo', 'tankyu'].includes(l.course)) err(`授業 ${l.id}`, `course「${l.course}」が決まりにない`); });
const GL = arr(W.GLOSSARY);
dupes(GL, g => g.term).forEach(t => err('用語', `「${t}」が重なっている`));
GL.forEach(g => { if (!str(g.term) || !str(g.def)) err('用語', `「${g.term}」に term か def がない`); if (g.year != null && !isYear(g.year)) err(`用語「${g.term}」`, `year がおかしい（${g.year}）`); });

// ---------- 12. 文の中の壊れたしるし（どのデータでも） ----------
const BAD = /\bundefined\b|\bNaN\b|\[object Object\]|�/;
function scan(where, v, depth = 0) {
  if (depth > 6 || v == null) return;
  if (typeof v === 'string') { if (BAD.test(v)) err(where, `文に壊れたしるし：…${v.slice(Math.max(0, v.search(BAD) - 15), v.search(BAD) + 20)}…`); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => scan(where, x, depth + 1)); return; }
  if (typeof v === 'object') Object.values(v).forEach(x => scan(where, x, depth + 1));
}
['POLITIES', 'PEOPLE', 'EVENTS', 'PLACES', 'STORIES', 'STORY_TALK_NEW', 'EVENT_FUN', 'PERSON_FUN', 'PERSON_DETAIL', 'GLOSSARY', 'LESSONS', 'CAUSES'].forEach(k => scan(k, W[k]));

// ---------- 結果 ----------
const counts = `国 ${POL.length}・人物 ${PPL.length}・出来事 ${EV.length}・地名 ${PL.length}・物語 ${ST.length}・用語 ${GL.length}・画像 ${arr(W.IMAGES).length}`;
console.log(`データの点検：${counts}`);
if (process.argv.includes('--warnings') && warnings.length) { console.log(`\n注意 ${warnings.length} 件：`); warnings.forEach(w => console.log('  - ' + w)); }
else if (warnings.length) console.log(`注意 ${warnings.length} 件（くわしくは --warnings をつけて実行）`);
if (errors.length) {
  console.log(`\nエラー ${errors.length} 件：`);
  errors.slice(0, 80).forEach(e => console.log('  ✗ ' + e));
  if (errors.length > 80) console.log(`  …ほか ${errors.length - 80} 件`);
  process.exitCode = 1;
} else console.log('エラーなし ✓');
