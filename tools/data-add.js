#!/usr/bin/env node
/* データを安全に足す・書きかえる：node tools/data-add.js <どのデータ> <JSONファイル> [<JSONファイル> ...]
   どのデータ：
     event-fun     出来事の「💡 ここがおもしろい」   {"出来事の題": "一言", ...}             → js/data/event-fun-new.js
     person-fun    人物の「💡 実はこんな人」        {"人物id": ["一言", "一言", "一言"], ...} → js/data/person-fun.js
     person-detail 人物のくわしいページ            {"人物id": { catch, life, story, ... }, ...} → js/data/people-detail-2.js
     story-talk    物語の語り（場面の数だけ）      {"物語id": ["場面1の語り", ...], ...}    → js/data/story-talk-new.js
   やること：
     1. 今のファイルを読み、JSON の中身を足す（同じキーは新しいほうで書きかえ）
     2. いったん別の名前で書き出してから入れかえる（とちゅうで止まっても、こわれたファイルが残らない）
     3. tools/check-data.js でデータ全体を点検し、エラーが出たら元のファイルにもどす
   --dry-run をつけると、書きかえずに点検だけする。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = {
  'event-fun': { file: 'js/data/event-fun-new.js', global: 'EVENT_FUN', head: '// 出来事の「💡 ここがおもしろい」（EVENT_FUN）：出来事の題 → 一言。tools/data-add.js で足す' },
  'person-fun': { file: 'js/data/person-fun.js', global: 'PERSON_FUN', head: '// 人物の「💡 実はこんな人」（PERSON_FUN）：人物id → 一言3つ。tools/data-add.js で足す' },
  'person-detail': { file: 'js/data/people-detail-2.js', global: 'PERSON_DETAIL', head: '// 人物のくわしいプロフィール（PERSON_DETAIL）その2。書き方は docs/DATA_SPEC.md の 8・9。tools/data-add.js で足す' },
  'story-talk': { file: 'js/data/story-talk-new.js', global: 'STORY_TALK_NEW', head: '// 物語の語り（STORY_TALK_NEW）：物語id → 場面ごとの語り（場面の数と同じ数）。tools/data-add.js で足す' }
};

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const [name, ...files] = args.filter(a => a !== '--dry-run');
const T = TARGETS[name];
if (!T || !files.length) {
  console.log('使い方：node tools/data-add.js <' + Object.keys(TARGETS).join('|') + '> <JSONファイル> ... [--dry-run]');
  process.exit(2);
}

// 今の中身（このファイルが足す分だけ）を読む
const target = path.join(ROOT, T.file);
const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
const box = { window: {} };
if (before) vm.runInNewContext(before, box, { filename: T.file });
const cur = box.window[T.global] || {};

// 足すもの
let added = 0, replaced = 0;
for (const f of files) {
  let add;
  try { add = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`✗ ${f} が JSON として読めない：${e.message}`); process.exit(1); }
  if (!add || typeof add !== 'object' || Array.isArray(add)) { console.log(`✗ ${f} は {"キー": 中身, ...} の形にする`); process.exit(1); }
  for (const [k, v] of Object.entries(add)) { if (k in cur) replaced++; else added++; cur[k] = v; }
}

// 書き出す（JSON.parse で読む形。ブラウザが速く読める）
const q = JSON.stringify(cur).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const out = `${T.head}\n// 大きなデータは JSON.parse で読むほうが、ブラウザが速く読める（手で書きかえず、tools/data-add.js を使う）\nwindow.${T.global} = Object.assign(window.${T.global} || {}, JSON.parse('${q}'));\n`;
// 書いたものを読みもどして、同じ中身になるか確かめる
const box2 = { window: {} };
vm.runInNewContext(out, box2);
if (JSON.stringify(box2.window[T.global]) !== JSON.stringify(cur)) { console.log('✗ 書き出した中身が元とちがう（書き出しをやめました）'); process.exit(1); }

const tmp = target + '.tmp';
fs.writeFileSync(tmp, out);
fs.renameSync(tmp, target);
let ok = true;
try { execFileSync(process.execPath, [path.join(__dirname, 'check-data.js')], { stdio: 'inherit' }); }
catch (e) { ok = false; }
if (!ok || dry) {
  if (before) fs.writeFileSync(target, before); else fs.unlinkSync(target);
  console.log(ok ? '（--dry-run：点検だけして、元にもどしました）' : '✗ 点検でエラーが出たので、元のファイルにもどしました。');
  process.exit(ok ? 0 : 1);
}
console.log(`✓ ${T.file}：${added} 件を足し、${replaced} 件を書きかえました（全部で ${Object.keys(cur).length} 件）`);
