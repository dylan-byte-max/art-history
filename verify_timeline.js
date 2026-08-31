// 静态验证时间轴分带逻辑：不依赖浏览器，直接跑 app.js 里的同一套算法
const fs = require('fs');

global.window = {};
// 数据文件列表从 index.html 解析，避免硬编码导致新增数据文件被漏测
const htmlSrc = fs.readFileSync('./index.html', 'utf8');
const dataFiles = [...htmlSrc.matchAll(/data\/(part[\w-]+)\.js/g)].map(m => m[1]);
if (!dataFiles.length) throw new Error('未能从 index.html 解析出 part*.js 列表');
dataFiles.forEach(f => require('./data/' + f + '.js'));
console.log('已载入数据文件:', dataFiles.length, '个 →', dataFiles.join(', '));
const D = window.AH_DATA.slice().sort((a,b) => a.start - b.start);

// 从 app.js 中提取实际使用的 ERA_ORDER 与分行参数，确保测试和实现不脱节
const src = fs.readFileSync('./assets/app.js', 'utf8');
const orderMatch = src.match(/var ERA_ORDER = \[([\s\S]*?)\];/);
const ERA_ORDER = orderMatch[1].match(/'([^']+)'/g).map(s => s.replace(/'/g,''));
const minW = Number((src.match(/Math\.max\(x2-x1,(\d+)\)/g) || []).pop().match(/(\d+)\)/)[1]);
const gap  = Number(src.match(/if\(x1 > rows\[i\]\+(\d+)\)/)[1]);

const ERAS = [];
ERA_ORDER.forEach(e => { if (D.some(s => s.era === e)) ERAS.push(e); });
D.forEach(s => { if (ERAS.indexOf(s.era) < 0) ERAS.push(s.era); });

const STOPS = [[-3200,0],[-3000,60],[-1500,150],[-500,250],[1,330],[500,420],
  [1000,520],[1300,620],[1500,720],[1600,800],[1700,880],[1800,960],[1850,1080],
  [1900,1240],[1930,1420],[1960,1600],[2000,1780],[2026,1900]];
function xOf(y){
  for (let i=0;i<STOPS.length-1;i++){
    const [y1,x1]=STOPS[i], [y2,x2]=STOPS[i+1];
    if (y>=y1 && y<=y2) return x1 + (y-y1)/(y2-y1)*(x2-x1);
  }
  return y < -3200 ? 0 : 1900;
}

let fail = 0;
function assert(cond, msg){ if(!cond){ console.log('  FAIL ' + msg); fail++; } }

console.log('分行参数（自 app.js 提取）: minWidth=' + minW + ' gap=' + gap);
console.log('泳道顺序: ' + ERAS.join(' → '));
console.log('');

let totalLanes = 0, totalBars = 0;
const layout = {};
ERAS.forEach(era => {
  const list = D.filter(s => s.era === era).sort((a,b) => a.start - b.start);
  const rows = [];
  list.forEach(s => {
    const x1 = xOf(s.start), w = Math.max(xOf(s.end)-x1, minW);
    let placed = false;
    for (let i=0;i<rows.length;i++){
      if (x1 > rows[i]+gap){ rows[i]=x1+w; s._row=i; placed=true; break; }
    }
    if (!placed){ rows.push(x1+w); s._row=rows.length-1; }
    s._x = x1; s._w = w;
  });
  layout[era] = { list, lanes: rows.length };
  totalLanes += rows.length; totalBars += list.length;
  console.log('  ' + era.padEnd(12) + list.length + ' 派 → ' + rows.length + ' 行');
});

console.log('');
console.log('=== 断言 ===');
assert(totalBars === D.length, '所有流派都被放入某个带 (' + totalBars + '/' + D.length + ')');

// 每个带内不允许横向重叠
ERAS.forEach(era => {
  const byRow = {};
  layout[era].list.forEach(s => { (byRow[s._row] = byRow[s._row] || []).push(s); });
  Object.keys(byRow).forEach(r => {
    const arr = byRow[r].sort((a,b) => a._x - b._x);
    for (let i=0;i<arr.length-1;i++){
      assert(arr[i]._x + arr[i]._w <= arr[i+1]._x + 0.01,
        era + ' 第' + r + '行重叠: ' + arr[i].name + ' 与 ' + arr[i+1].name);
    }
  });
});

// 同一带内所有流派的 era 必须一致（分带语义的核心）
ERAS.forEach(era => {
  const bad = layout[era].list.filter(s => s.era !== era);
  assert(bad.length === 0, era + ' 带内混入了其他时期: ' + bad.map(s=>s.name));
});

// 关键用例：古典主义与巴洛克、洛可可同带；新古典主义在19世纪带
const eraOf = n => (D.find(s => s.name === n) || {}).era;
assert(eraOf('古典主义') === '巴洛克与洛可可', '古典主义应在「巴洛克与洛可可」带');
assert(eraOf('巴洛克')   === '巴洛克与洛可可', '巴洛克应在「巴洛克与洛可可」带');
assert(eraOf('洛可可')   === '巴洛克与洛可可', '洛可可应在「巴洛克与洛可可」带');
assert(eraOf('新古典主义') === '19世纪',       '新古典主义应在「19世纪」带');

// 平行传统必须排在西方主线之后
const westernLast = Math.max(...['古代文明','中世纪','文艺复兴','巴洛克与洛可可','19世纪','现代主义','战后与当代']
  .map(e => ERAS.indexOf(e)).filter(i => i >= 0));
['东亚传统','非西方传统'].forEach(e => {
  if (ERAS.indexOf(e) >= 0)
    assert(ERAS.indexOf(e) > westernLast, e + ' 应排在西方主线之后');
});

// 带内按起始年递增（同一行内）
ERAS.forEach(era => {
  const byRow = {};
  layout[era].list.forEach(s => { (byRow[s._row] = byRow[s._row] || []).push(s); });
  Object.keys(byRow).forEach(r => {
    const arr = byRow[r];
    for (let i=0;i<arr.length-1;i++){
      assert(arr[i].start <= arr[i+1].start,
        era + ' 第' + r + '行未按年代排序: ' + arr[i].name + ' → ' + arr[i+1].name);
    }
  });
});

console.log('');
console.log('总行数: ' + totalLanes + '（原贪心算法 12 行，但行号无语义）');
console.log(fail === 0 ? '全部断言通过 ✓' : fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
