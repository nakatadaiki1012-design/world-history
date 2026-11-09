// node tools/geo/build.js  … tools/geo/recipes/*.json の「作り方」から、js/data/shapes-precise.js を作る
// recipes の書き方: { "<国・王朝の id>": { "<形の from の年>": recipe, "sphere:<番号>": recipe } }
const fs = require('fs'), path = require('path');
const { compose } = require('./lib');
const dir = path.join(__dirname, 'recipes');
const out = {}; let n = 0, pts = 0; const errs = [];
fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().forEach(f => {
  const R = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  Object.entries(R).forEach(([id, shapes]) => Object.entries(shapes).forEach(([key, rc]) => {
    try { const rings = compose(rc); (out[id] = out[id] || {})[key] = rings; n++; pts += rings.reduce((a, r) => a + r.length, 0); }
    catch (e) { errs.push(`${f} ${id} ${key}: ${e.message}`); }
  }));
});
// 小さくするため、点は「0.01度単位の整数で、前の点からの差」を平らな列にして書く（geo.js の decodePrecise でもどす）
const enc = r => { let px = 0, py = 0; const o = []; r.forEach(([x, y]) => { const X = Math.round(x * 100), Y = Math.round(y * 100); o.push(X - px, Y - py); px = X; py = Y; }); return o; };
const packed = {}; Object.entries(out).forEach(([id, m]) => { packed[id] = {}; Object.entries(m).forEach(([k, rings]) => { packed[id][k] = rings.map(enc); }); });
const js = '// 自動生成（tools/geo/build.js）。今の州・省の境目と川から作った、くわしい形。手で書きかえないこと\n// 点は 0.01度単位の差で書いてある（geo.js でもどす）。大きなデータは JSON.parse で読むほうが、ブラウザが速く読める\nwindow.PRECISE_D = JSON.parse(\'' + JSON.stringify(packed).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\');\n';
fs.writeFileSync(path.join(__dirname, '../../js/data/shapes-precise.js'), js);
console.log(`shapes ${n}, points ${pts}, size ${(js.length / 1024).toFixed(0)} KB`);
if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
