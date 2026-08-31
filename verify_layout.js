// 静态验证布局与粘性坐标轴：解析 CSS 与 HTML，不依赖浏览器
const fs = require('fs');
const css = fs.readFileSync('./assets/style.css', 'utf8');
const html = fs.readFileSync('./index.html', 'utf8');

let fail = 0;
function ok(cond, msg){ console.log((cond ? '  OK   ' : '  FAIL ') + msg); if(!cond) fail++; }

// 取某个选择器的规则体（取最后一次出现，因为后面的会覆盖前面的）
function rule(sel){
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m, last = null;
  while ((m = re.exec(css)) !== null) last = m[1];
  return last;
}
function prop(sel, name){
  const body = rule(sel);
  if (!body) return null;
  const m = body.match(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}

console.log('=== 1. 宽度：说明区与时期标签应铺满容器 ===');
const introBody = rule('.view-intro');
ok(introBody !== null, '.view-intro 规则存在');
ok(!/max-width/.test(introBody || ''), '.view-intro 不再整块限宽（原 820px 导致只占一半）');
ok(/max-width:820px/.test(rule('.view-intro p') || ''), '.view-intro p 正文仍保留 820px 易读宽度');
ok(!/max-width/.test(rule('.howto') || ''), '.howto 不再限宽（原 940px）');
ok(!/max-width/.test(rule('.era-legend') || ''), '.era-legend 无宽度限制');

console.log('');
console.log('=== 2. DOM 结构：坐标轴必须在 overflow 容器「之外」 ===');
ok(/id="tlScroll"/.test(html), '滚动容器有 id=tlScroll');
ok(/id="tlAxisSticky"/.test(html), '存在 sticky 外壳 tlAxisSticky');
ok(html.indexOf('tlAxisSticky') < html.indexOf('id="tlScroll"'),
   '坐标轴在 tl-scroll 之前（浏览器实测：放进 overflow-x 容器内 sticky 会失效，top 变 -475）');
const scrollBlock = html.slice(html.indexOf('id="tlScroll"'), html.indexOf('id="tlScroll"') + 300);
ok(!/tlAxisSticky/.test(scrollBlock), '坐标轴不在 tl-scroll 内部（关键）');
ok(/tl-axis-clip/.test(html), '存在 .tl-axis-clip 裁剪层');

console.log('');
console.log('=== 3. 粘性 CSS ===');
ok(prop('.tl-axis-sticky','position') === 'sticky', '.tl-axis-sticky position:sticky');
ok(/--head-h/.test(prop('.tl-axis-sticky','top') || ''), '.tl-axis-sticky top 用 --head-h 避开固定表头');
ok(/62px/.test(rule(':root') || ''), ':root 定义 --head-h:62px（与 .head-inner 高度一致）');
ok(/var\(--panel\)/.test(prop('.tl-axis-sticky','background') || ''),
   '.tl-axis-sticky 有实心背景（否则粘住时内容会透过来）');
ok(prop('.tl-axis-clip','overflow') === 'hidden', '.tl-axis-clip overflow:hidden 负责裁剪');
ok(!prop('.tl-axis-sticky','overflow'), '.tl-axis-sticky 自身无 overflow（否则会形成新滚动上下文破坏 sticky）');
ok(prop('.tl-scroll','overflow-x') === 'auto', '.tl-scroll 保留横向滚动');
ok(!prop('.tl-scroll','overflow-y'), '.tl-scroll 不设 overflow-y（纵向交给页面，避免滚轮被困在框内）');
ok(/1900px/.test(prop('.tl-axis','min-width') || ''), '.tl-axis 与内容等宽 1900px');

console.log('');
console.log('=== 3b. JS 横向同步 ===');
const js = fs.readFileSync('./assets/app.js','utf8');
ok(/function syncAxis\(\)/.test(js), '存在 syncAxis()');
ok(/translateX\('\+\(-sc\.scrollLeft\)\+'px\)/.test(js), 'syncAxis 用 -scrollLeft 映射 translateX');
ok(/function bindAxisSync\(\)/.test(js), '存在 bindAxisSync()');
ok(/sc\.addEventListener\('scroll'/.test(js), '监听 tl-scroll 的 scroll 事件');
ok(/requestAnimationFrame/.test(js), '用 rAF 节流避免滚动卡顿');
ok(/^bindAxisSync\(\);$/m.test(js), '启动时调用了 bindAxisSync()');
ok(/syncAxis\(\);/.test(js), 'renderTimeline 内重渲染后重新同步一次');

console.log('');
console.log('=== 4. 层级：坐标轴须盖住内容，但带头标签不能盖住坐标轴 ===');
const zAxis = Number(prop('.tl-axis-sticky','z-index'));
const zHead = Number(prop('.tl-band-head','z-index'));
const zSep  = Number(prop('.tl-sep-lbl','z-index'));
ok(zAxis > zHead, '坐标轴层级(' + zAxis + ') 高于带头(' + zHead + ')');
ok(!Number.isNaN(zSep) ? zAxis > zSep : true, '坐标轴层级高于分隔说明(' + zSep + ')');
ok(/var\(--panel\)/.test(prop('.tl-band-head','background') || ''),
   '带头背景改为 panel（与容器一致，原为 bg 会有色差）');

console.log('');
console.log(fail === 0 ? '全部通过 ✓' : fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
