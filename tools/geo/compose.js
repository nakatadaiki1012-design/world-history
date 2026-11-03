// node tools/geo/compose.js recipe.json   → 輪（rings）を JSON で出力
const { compose } = require('./lib');
const rc = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const out = Array.isArray(rc) ? rc.map(compose) : compose(rc);
process.stdout.write(JSON.stringify(out) + '\n');
