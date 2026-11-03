// node tools/geo/find.js <ことば>  … 州・省をさがす（名前・日本語名・中国語名・コード・国コード）
const { adm1 } = require('./lib');
const q = process.argv.slice(2).join(' ');
adm1().filter(f => { const p = f.properties; return [p.iso_3166_2, p.adm0_a3, p.name, p.name_ja, p.name_zh].some(v => v && String(v).includes(q)); })
  .forEach(f => { const p = f.properties; console.log([p.iso_3166_2, p.adm0_a3, p.name, p.name_ja || '', p.name_zh || ''].join('\t')); });
