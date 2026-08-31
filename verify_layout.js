// 静态验证布局与粘性坐标轴：解析 CSS 与 HTML，不依赖浏览器
const fs = require('fs');
const css = fs.readFileSync('./assets/style.css', 'utf8');
const html = fs.readFileSync('./index.html', 'utf8');

let fail = 0;
function ok(cond, msg){ console.log((cond ? '  OK   ' : '  FAIL ') + msg); if(!cond) fail++; }

/* 提取规则时必须区分「顶层规则」与「@media 内的覆盖」。
   原实现取最后一次匹配，一旦某选择器在 @media 里被重新声明
   （如 .tl-axis 在 560px 断点里只改 margin），就会读到那个简化版本，
   从而误报顶层属性缺失（曾导致 3 项假失败）。
   解法：先把所有 @media{...} 块按花括号配平剥掉，只在顶层 CSS 里查。 */
const cssTop = (() => {
  let out = '', i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at < 0) { out += css.slice(i); break; }
    out += css.slice(i, at);
    let brace = css.indexOf('{', at);
    if (brace < 0) break;
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return out;
})();

function ruleIn(src, sel){
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m, last = null;
  while ((m = re.exec(src)) !== null) last = m[1];
  return last;
}
// 默认只查顶层规则；需要断言断点内样式时用 ruleInMedia
function rule(sel){ return ruleIn(cssTop, sel); }
function ruleInMedia(sel){ return ruleIn(css, sel); }
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
// 表头 z-index 40：坐标轴必须接近它，否则一旦位置有偏差就会被表头压住
const zSite = Number(prop('.site-head','z-index'));
ok(zAxis >= zSite - 1,
   '坐标轴层级(' + zAxis + ') 不低于表头(' + zSite + ')太多，避免被表头盖住');

console.log('');
console.log('=== 5. 移动端：表头换行变高，sticky 偏移必须动态实测 ===');
const js5 = fs.readFileSync('./assets/app.js','utf8');
// 曾出现的 bug：--head-h 写死 62px，但移动端表头换行后实际 106px，
// 导致坐标轴被表头盖住 44px，手机上看起来「完全没粘住」。
ok(/function syncHeadHeight\(\)/.test(js5),
   '存在 syncHeadHeight()：实测表头高度而非写死');
ok(/setProperty\('--head-h'/.test(js5),
   'syncHeadHeight 把实测值写入 --head-h');
ok(/getBoundingClientRect\(\)\.height/.test(js5),
   '用 getBoundingClientRect 取真实高度');
ok(/orientationchange/.test(js5),
   '监听 orientationchange（手机转屏后表头高度会变）');
ok(/document\.fonts[\s\S]{0,40}then\(syncHeadHeight\)/.test(js5),
   '字体载入完成后重测（衬线字体会影响表头高度）');
ok(/window\.addEventListener\('resize'/.test(js5) && /syncHeadHeight\(\); syncAxis\(\)/.test(js5),
   'resize 时同时重测表头高度与横向偏移');
ok(/@media\(max-width:560px\)/.test(css),
   '存在 560px 手机断点');
const mHead = ruleInMedia('.head-inner');
ok(mHead !== null && /padding/.test(mHead),
   '窄屏压缩了表头内边距（减少换行后的高度）');
ok(/-webkit-overflow-scrolling:touch/.test(css),
   '横向滚动容器启用 iOS 惯性滚动');
// sticky top 仍须引用变量，不能被改回硬编码
ok(/var\(--head-h/.test(prop('.tl-axis-sticky','top') || ''),
   '.tl-axis-sticky top 仍引用 --head-h 变量（不可硬编码）');

console.log('');
console.log(fail === 0 ? '全部通过 ✓' : fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
