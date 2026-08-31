// 验证地域归一化：确认每个 region 都能解析出至少一个标签，且标签总数收敛
const fs = require('fs');
global.window = { AH_PAINTERS: [] };
'abcdefghijklmn'.split('').forEach(k => require('./data/painters-' + k + '.js'));
const P = window.AH_PAINTERS;
new Function('window', fs.readFileSync('./data/regions.js', 'utf8'))(global.window);
const R = window.AH_REGION;

let fail = 0;
function ok(c, m){ console.log((c ? '  OK   ' : '  FAIL ') + m); if(!c) fail++; }

console.log('=== 1. 解析覆盖率 ===');
const unresolved = [];
const tagCount = {};
P.forEach(p => {
  const tags = R.of(p.region);
  if (!tags.length) unresolved.push(p.name + ' : ' + p.region);
  tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
});
console.log('  画家数:', P.length);
console.log('  无法解析出任何地域的:', unresolved.length);
unresolved.forEach(x => console.log('     ' + x));
ok(unresolved.length === 0, '所有画家都能解析出至少一个地域');

console.log('');
console.log('=== 2. 标签数量收敛 ===');
const tags = Object.keys(tagCount);
console.log('  原始 region 不同取值:', new Set(P.map(p => p.region)).size);
console.log('  归一化后标签数:', tags.length);
ok(tags.length <= 45, '标签数收敛到 45 以内（原为 173）');

console.log('');
console.log('=== 3. 标签覆盖分布（按画家数降序）===');
Object.entries(tagCount).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log('  ' + String(v).padStart(3) + '  ' + k);
});
const only1 = Object.entries(tagCount).filter(([,v]) => v === 1);
console.log('  只对应 1 位画家的标签:', only1.length, only1.map(([k])=>k).join('、') || '无');

console.log('');
console.log('=== 4. 多地域归属（迁徙路径应产生多个标签）===');
const cases = [
  ['布鲁塞尔→法国·巴黎', ['比利时','法国']],
  ['克里特→西班牙托莱多', ['希腊','西班牙']],
  ['韩国→日本→德国→美国', ['朝鲜半岛','日本','德国','美国']],
  ['意大利·佛罗伦萨与米兰', ['意大利']],
  ['法国·巴黎', ['法国']],
  ['荷兰→巴黎→纽约', ['荷兰','法国','美国']],
  ['美国·纽约', ['美国']],
  ['德意志→美国', ['德国','美国']],
  ['佛兰德斯与荷兰（哈勒姆、安特卫普）', ['比利时','荷兰']],
  ['中国·北宋陕西', ['中国']],
  ['澳洲·中部沙漠（安马杰拉族）', ['澳洲']],
  ['印度·帕哈里（古勒与贾斯罗塔）', ['印度']],
  ['波斯→印度莫卧儿', ['波斯','印度']],
  ['君士坦丁堡→俄国', ['奥斯曼','俄国']],
];
cases.forEach(([input, expect]) => {
  const got = R.of(input);
  const pass = JSON.stringify(got) === JSON.stringify(expect);
  ok(pass, input + ' → [' + got.join(',') + ']' + (pass ? '' : ' 期望[' + expect.join(',') + ']'));
});

console.log('');
console.log('=== 5. 排序表覆盖所有实际标签 ===');
const missingInOrder = tags.filter(t => R.order.indexOf(t) < 0);
ok(missingInOrder.length === 0,
   '所有标签都在 order 里' + (missingInOrder.length ? '：缺 ' + missingInOrder.join('、') : ''));

console.log('');
console.log(fail === 0 ? '全部通过 ✓' : fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
