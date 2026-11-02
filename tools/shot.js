// 開発用：画面をブラウザで開いて写真をとる  node tools/shot.js '<#hash>' out.png [幅] [高さ]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [hash = '', out = '/tmp/shot.png', w = 1366, h = 768] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + hash);
  await p.waitForTimeout(1200);
  if (process.env.CLICK) { for (const s of process.env.CLICK.split('|')) { await p.click(s); await p.waitForTimeout(500); } }
  await p.screenshot({ path: out });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
