# 形の精度を上げる作業の手順（作業者むけ）

目的：国・王朝の範囲（js/data/polities-*.js の shapes / spheres）を、手で描いたおおまかな輪から、
**今の州・省の境目・川・海岸線にそった、くわしい形**にする。元のデータファイルは書きかえない。
「作り方（recipe）」を tools/geo/recipes/<担当>.json に書き、tools/geo/build.js で js/data/shapes-precise.js を作る。
アプリは読みこむとき、PRECISE にある形で元の rings を置きかえる（キーは shape の from の年、勢力圏は "sphere:<番号>"）。

環境変数（毎回 export）:
  export GEO_DATA=/tmp/claude-0/-home-user/e6edaf2d-5a8c-5e6a-a2f2-1d6faa013f79/scratchpad/geo
  export GEO_NODE_MODULES=$GEO_DATA/tool/node_modules

道具（tools/geo/README.md も読む）:
  node tools/geo/find.js 河南           # 州・省のコードをさがす（日本語・英語・中国語・国コード CHN など）
  node tools/geo/find.js IRN            # その国の州・省の一覧
  node tools/geo/river.js Euphrates 35,30,48,40   # 川の座標（境目を川にそわせる add/clip/minus の輪づくりに使う）
  node tools/geo/build.js               # すべての recipes から shapes-precise.js を作る（ほかの作業者の分もまとめて作る。同時に動かしても大丈夫）
  node tools/preview.js <年> <view> out.png js/data/polities-<file>.js   # shapes-precise.js も自動で読む。Read ツールで画像を見て確かめる

recipe（1つの形の作り方）:
  { "adm1": ["CN-SN", ...], "adm0": ["KOR"], "iso": ["156"], "add": [[[lon,lat],...]], "minus": [[...]], "clip": [[...]], "tol": 0.04 }
  - 州・省を集めるのが基本。州の一部だけのときは、川や山脈にそった輪を clip（その内側だけ残す）や minus（引く）に使う。
  - 今の州・省で表せない境目（例：淮河の線、長城の線、ドナウ・ライン、ユーフラテス）は river.js の座標を使って輪を作る。
  - 同じ年にとなり合う国は、同じ州・省の境目や同じ川の線を使えば、境目が自然にぴったり合う。すき間・重なりを作らない。
  - tol：大帝国 0.05、ふつう 0.03〜0.04、小さい国 0.02。ファイルが大きくなりすぎないように（自分の担当で合計 600KB 以下が目安）。
  - 史実：教科書（山川『詳説世界史』の地図など）の範囲に合わせる。今の州・省の境目は、昔の境目と一致しない所が多いので、
    「その州の大部分を支配していたか」で入れる・入れないを決め、大きくずれる所は clip / add で直す。

recipes ファイルの形:
  { "tang": { "618": {recipe}, "751": {recipe}, "sphere:0": {recipe} }, "song-n": { ... } }
  キーの年は、そのポリティの shapes[*].from と完全に同じ（文字列）。shapes の数・年は変えない（足りなければ、その形は元のまま使われる）。

対象：担当ファイルの rank 1 と rank 2 の国・王朝のすべての shapes（rank 3 は大きいものだけでよい）。勢力圏 spheres も、範囲が州・省で表せるものはできるだけ。
iso だけで書かれている形（今の国境と同じ）は、すでに正確なので対象外。

確かめ方（必須）：担当の主な年を preview で描いて、Read ツールで見る。おかしい形（場所ちがい・抜け・大きな重なり・すき間）を直す。
最後に node tools/geo/build.js がエラーなしで終わること。ほかのファイル（js/data/*.js, js/*.js など）は書きかえない。git は使わない。
