// 修正影响链：新增 12 个流派后，让相邻的已有流派也指向它们（双向连通）
const fs = require('fs');

const PATCH = {
  // 已有流派 -> 需要追加的 to / from
  'baroque':           { to: ['spanish-golden-age', 'flemish-baroque'] },
  'mannerism':         { to: ['spanish-golden-age'] },
  'northern-renaissance': { to: ['flemish-baroque'] },
  'dutch-golden-age':  { to: ['hudson-river-school'] },
  'romanticism':       { to: ['hudson-river-school'] },
  'classicism':        { to: ['hudson-river-school'] },
  'realism':           { from: ['spanish-golden-age', 'hudson-river-school'] },
  'impressionism':     { from: ['spanish-golden-age', 'hudson-river-school'] },
  'expressionism':     { to: ['neue-sachlichkeit'] },
  'dada':              { to: ['neue-sachlichkeit', 'fluxus', 'conceptual-art'] },
  'minimalism':        { to: ['conceptual-art', 'fluxus'] },
  'pop-art':           { to: ['conceptual-art', 'neo-expressionism'] },
  'abstract-expressionism': { to: ['neo-expressionism'] },
  'social-realism':    { from: ['neue-sachlichkeit'] },
  'surrealism':        { from: ['neue-sachlichkeit'] },
  'contemporary':      { from: ['conceptual-art', 'fluxus', 'neo-expressionism',
                                'aboriginal-art'] },
  'islamic-art':       { to: ['indian-painting'] },
  'chinese-painting':  { to: ['korean-painting'], from: ['buddhist-art-asia'] },
  'japanese-painting': { from: ['korean-painting', 'buddhist-art-asia'] },
  'ancient-greece':    { to: ['buddhist-art-asia'] },
  'cubism':            { from: ['oceanic-art'] },
  'surrealism2':       {},   // 占位，忽略
  'academic-art':      { from: ['flemish-baroque'] },
  'rococo':            { from: ['flemish-baroque'] },
  'symbolism':         { from: ['indian-painting'] },
  'art-nouveau':       { from: ['indian-painting'] },
};

const files = ['part1-ancient-renaissance', 'part2-baroque-19c', 'part3-modernism',
               'part4-contemporary-nonwestern', 'part5-supplements',
               'part6-classicism', 'part7-regional', 'part8-schools'];

let edits = 0;
files.forEach(fn => {
  const path = './data/' + fn + '.js';
  let t = fs.readFileSync(path, 'utf8');
  const before = t;

  Object.keys(PATCH).forEach(id => {
    const anchor = "id:'" + id + "'";
    const i = t.indexOf(anchor);
    if (i < 0) return;
    // 条目体：从 anchor 到下一个 "id:'" 之前（或文件尾）
    const nextI = t.indexOf("\n  id:'", i + 5);
    const end = nextI > 0 ? nextI : t.length;
    let seg = t.slice(i, end);
    const segBefore = seg;

    ['from', 'to'].forEach(key => {
      const add = PATCH[id][key];
      if (!add || !add.length) return;
      const re = new RegExp(key + ":\\[([^\\]]*)\\]");
      const m = seg.match(re);
      if (!m) { console.log('  未找到', id, key); return; }
      const cur = m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
      const merged = cur.slice();
      add.forEach(a => { if (!merged.includes(a)) merged.push(a); });
      if (merged.length === cur.length) return;
      const newStr = key + ':[' + merged.map(s => "'" + s + "'").join(',') + ']';
      seg = seg.replace(m[0], newStr);
      console.log('  ' + id.padEnd(24) + key + ': +' +
                  add.filter(a => !cur.includes(a)).join(','));
      edits++;
    });

    if (seg !== segBefore) t = t.slice(0, i) + seg + t.slice(end);
  });

  if (t !== before) fs.writeFileSync(path, t, 'utf8');
});
console.log('\n共修改', edits, '处');
