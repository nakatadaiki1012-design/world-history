// 国・王朝の形をたしかめるための画像を作る（開発用）
// 使い方: node tools/preview.js <年> <view> <出力.png> [データファイル...]
//   例: node tools/preview.js 750 eastasia /tmp/a.png js/data/polities-asia.js
//   view: world eastasia inner southasia seasia westasia med europe africa america atlantic
//   データファイルを省くと js/data/ のすべて
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ['vendor/d3.min.js', 'vendor/topojson-client.min.js', 'vendor/world-50m.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^/, ''), ctx, { filename: f });
}
const [year, view = 'world', out = '/tmp/preview.png', ...files] = process.argv.slice(2);
const dataFiles = files.length ? files : fs.readdirSync(path.join(root, 'js/data')).filter(f => /^polities.*\.js$/.test(f)).map(f => 'js/data/' + f);
for (const f of dataFiles) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext(fs.readFileSync(path.join(root, 'js/geo.js'), 'utf8'), ctx, { filename: 'js/geo.js' });
const W = 1200, H = 760;
const svg = vm.runInContext(`GEO.previewSVG(${+year}, ${JSON.stringify(view)}, ${W}, ${H})`, ctx);
const html = `<html><body style="margin:0">${svg}</body></html>`;
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(html); await p.screenshot({ path: out }); await b.close();
  console.log('saved', out);
})();
