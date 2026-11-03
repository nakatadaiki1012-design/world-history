# 国・王朝の形を「今の州・省」と「川」から作る道具（開発用）

データ（アプリには入れない。毎回ダウンロードして作る）:
- Natural Earth `ne_10m_admin_1_states_provinces`（世界の州・省、4,596）
- Natural Earth `ne_10m_rivers_lake_centerlines`（川）

`GEO_DATA` 環境変数に、`adm1.geojson`（州・省を mapshaper で 8% に単純化したもの）と `rivers.geojson` を置いたフォルダを指定する。
node の部品 `polygon-clipping` `topojson-client` が必要（`GEO_NODE_MODULES` にそのフォルダ）。

- `node tools/geo/find.js 陝西` … 州・省を名前でさがす（日本語・英語・コード・国コード CHN など）
- `node tools/geo/river.js 黄河 [西,南,東,北]` … 川の線の座標（境目を川にそって引くとき）
- `node tools/geo/compose.js recipe.json` … 形を合成して、輪（rings）を出力

recipe の書き方:
```json
{
  "adm1": ["CN-SN", "CN-HA"],      // 州・省のコード（iso_3166_2）
  "adm0": ["KOR"],                   // 国まるごと（その国のすべての州・省。ISO 3文字）
  "iso": ["156"],                    // world-50m の国（数字コード）
  "add": [[[lon,lat], ...]],         // 手で描いた輪を足す
  "minus": [[[lon,lat], ...]],       // 手で描いた輪を引く
  "clip": [[[lon,lat], ...]],        // この輪の内側だけ残す（州の一部だけ使うとき）
  "tol": 0.04                        // 単純化の度合い（度。0.02〜0.08）
}
```
