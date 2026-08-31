// 修正已有画家档案的 styles 归属：把新建的流派加进去（放在合适位置）
const fs = require('fs');
const files = fs.readdirSync('./data').filter(f => /^painters-.*\.js$/.test(f));

// id -> 新的 styles 数组
const FIX = {
  'velazquez':  ['spanish-golden-age', 'baroque'],
  'rubens':     ['flemish-baroque', 'baroque'],
  'elgreco':    ['mannerism', 'spanish-golden-age'],
};

let changed = 0;
files.forEach(f => {
  const path = './data/' + f;
  let t = fs.readFileSync(path, 'utf8');
  const before = t;

  Object.keys(FIX).forEach(id => {
    const anchor = "id:'" + id + "'";
    const i = t.indexOf(anchor);
    if (i < 0) return;
    // 在该条目 300 字符内找 styles:[...]
    const seg = t.slice(i, i + 300);
    const m = seg.match(/styles:\[[^\]]*\]/);
    if (!m) { console.log('  未找到 styles:', id, f); return; }
    const oldStr = m[0];
    const newStr = 'styles:[' + FIX[id].map(s => "'" + s + "'").join(',') + ']';
    if (oldStr === newStr) { console.log('  已是目标值:', id); return; }
    t = t.slice(0, i) + seg.replace(oldStr, newStr) + t.slice(i + 300);
    console.log('  ' + id.padEnd(12) + f.padEnd(16) + oldStr + '  ->  ' + newStr);
  });

  if (t !== before) { fs.writeFileSync(path, t, 'utf8'); changed++; }
});
console.log('修改文件数:', changed);
