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
const js = '// 自動生成（tools/geo/build.js）。今の州・省の境目と川から作った、くわしい形。手で書きかえないこと\nwindow.PRECISE = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '../../js/data/shapes-precise.js'), js);
console.log(`shapes ${n}, points ${pts}, size ${(js.length / 1024).toFixed(0)} KB`);
if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exitCode = 1; }
