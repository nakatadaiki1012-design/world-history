// node tools/geo/river.js <川の名前（英語）> [西,南,東,北] [tol]  … 川の線の座標を出す（境目を川に沿わせるとき）
const { rivers, simplifyRing } = require('./lib');
const [q, bb, tol] = process.argv.slice(2);
const box = bb ? bb.split(',').map(Number) : null;
rivers().filter(f => [f.properties.name, f.properties.name_alt].some(v => v && v.toLowerCase().includes(q.toLowerCase()))).forEach(f => {
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  lines.forEach(l => {
    let pts = box ? l.filter(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]) : l;
    if (pts.length < 2) return;
    pts = simplifyRing(pts, +tol || 0.03).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    console.log(f.properties.name, JSON.stringify(pts));
  });
});
