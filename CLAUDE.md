# 世界史クロノマップ：作業のきまり

静的サイト（`index.html` を開くだけで動く）。データは `js/data/*.js`、書き方は `docs/DATA_SPEC.md`。

## データを壊さないために（必ず守る）

1. **コミットの前に `node tools/check-data.js` を実行し、「エラーなし ✓」を確かめる。**
   - 全データを読みこみ、読めないファイル・id の重なり・切れたつながり（人物→国、物語→人物、画像→物語、💡→出来事 など）・おかしな年や経度緯度を調べる。
   - エラーがあればコミットしない。`--warnings` をつけると注意も出る。
   - GitHub でも同じ点検が自動で走る（`.github/workflows/check-data.yml`）。
   - 自分のパソコンで、コミット前に自動で点検したいときは一度だけ `git config core.hooksPath tools/git-hooks`。
2. **JSON.parse 形式の大きなデータ（下の4つ）は手で書きかえず、`tools/data-add.js` で足す。**
   ```
   node tools/data-add.js event-fun     足すもの.json   # js/data/event-fun-new.js   {"出来事の題": "一言"}
   node tools/data-add.js person-fun    足すもの.json   # js/data/person-fun.js      {"人物id": ["一言", ...]}
   node tools/data-add.js person-detail 足すもの.json   # js/data/people-detail-2.js {"人物id": {catch, life, story, ...}}
   node tools/data-add.js story-talk    足すもの.json   # js/data/story-talk-new.js  {"物語id": ["場面1の語り", ...]}
   ```
   足したあと全体を点検し、エラーなら元のファイルにもどす（`--dry-run` で点検だけ）。
3. **出来事の題・人物や国の id を変えるときは、つながっている所も直す。** 💡（EVENT_FUN）・原因と結果（CAUSES）・画像（IMAGES）は出来事の題で、物語・画像・くわしいページは id でつながっている。変えたら必ず点検する。
4. 新しいデータファイルを作ったら、`index.html`（地図より前に要るもの）か `js/main.js` の `LATE_FILES`（あとから読むもの）に入れる。入れ忘れも点検で見つかる。

## アプリ側の守り

- `js/core.js` の `absorbLate` は、形のおかしいデータをとばして読む（1つが壊れても、ほかは使える）。
- 学習の記録（ブラウザの localStorage）は、変えるたびに少しあとで控え（`.bak`）も保存する。記録が壊れていたら `.broken` に取っておき、控えからもどす。

## 文章のきまり

- です・ます調。史実をまげない。伝説は「〜と伝えられています」、学説の分かれるものは「〜という説もあります」。
- 戦争・虐殺などは中立に、敬意をもって。犠牲者数は「推計」や幅で書く。
