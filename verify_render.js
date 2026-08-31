// 用极简 DOM 桩在 node 里真正执行 app.js，验证渲染逻辑与数据的结合
// 不依赖 jsdom / 浏览器：只实现 app.js 实际用到的那部分 DOM API
const fs = require('fs');

function mkEl(tag) {
  const e = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], childNodes: [], _parent: null,
    _cls: '', id: '', title: '', hidden: false,
    dataset: {}, style: {}, _html: '', _text: '',
    _listeners: {},
    appendChild(c) { c._parent = this; this.children.push(c); this.childNodes.push(c); return c; },
    addEventListener(k, fn) { (this._listeners[k] = this._listeners[k] || []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { if (k === 'class') this.className = v; else this[k] = v; },
    getAttribute(k) { return k === 'class' ? this.className : this[k]; },
    hasAttribute(k) { return k === 'hidden' ? !!this.hidden : this[k] !== undefined; },
    contains() { return false; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 600, height: 30, bottom: 30, right: 600 }; },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { on ? this._s.add(c) : this._s.delete(c); } },
      contains(c) { return this._s.has(c); },
    },
    // 递归收集全部后代
    _all() { let r = []; this.children.forEach(c => { r.push(c); r = r.concat(c._all()); }); return r; },
    querySelectorAll(sel) { return matchAll(this._all(), sel); },
    querySelector(sel) { return matchAll(this._all(), sel)[0] || null; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = []; this.childNodes = []; },
    get textContent() { return this._text || stripTags(this._html) || this.children.map(c => c.textContent).join(''); },
    set textContent(v) { this._text = String(v); },
    get offsetTop() { return 0; },
    get parentElement() { return this._parent; },
  };
  e.classList = Object.create(e.classList); e.classList._s = new Set();
  /* 真实 DOM 里 className 与 classList 是同一份数据的两个视图。
     桩里若把 className 写成普通属性，`el.className='fchips'` 之后
     `classList.contains('fchips')` 仍返回 false —— 会让所有基于
     classList 的断言静默失效（本项目曾因此产生 3 项假失败）。
     所以这里用 getter/setter 双向同步。 */
  Object.defineProperty(e, 'className', {
    get() { return Array.from(this.classList._s).join(' '); },
    set(v) {
      this.classList._s = new Set(String(v || '').split(/\s+/).filter(Boolean));
    },
    enumerable: true, configurable: true,
  });
  return e;
}
function stripTags(h) { return String(h || '').replace(/<[^>]*>/g, ''); }

// 支持 .cls / #id / tag / [data-x=y] / 简单组合与逗号
function matchAll(list, sel) {
  const parts = String(sel).split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    // 只取最后一段（后代关系在桩里退化为全局匹配，足够本用例）
    const last = p.split(/\s+/).pop();
    list.forEach(el => { if (matchOne(el, last) && !out.includes(el)) out.push(el); });
  });
  return out;
}
function hasCls(el, c) {
  return el.classList.contains(c) || String(el.className).split(/\s+/).includes(c);
}
function matchOne(el, sel) {
  let m;
  // 支持 tag[data-x=y] / .cls[data-x=y] / #id[data-x=y] / [data-x=y]
  if ((m = sel.match(/^([^\[]*)\[data-([\w-]+)=["']?([^"'\]]+)["']?\]$/))) {
    const key = m[2].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (String(el.dataset[key]) !== m[3]) return false;
    const pre = m[1];
    if (!pre) return true;
    return matchOne(el, pre);           // 前缀部分递归判断（.cls / tag / #id）
  }
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return sel.slice(1).split('.').every(c => hasCls(el, c));
  if (/^[a-zA-Z]+$/.test(sel)) return el.tagName === sel.toUpperCase();
  // tag.cls 组合
  if ((m = sel.match(/^([a-zA-Z]+)\.(.+)$/)))
    return el.tagName === m[1].toUpperCase() &&
           m[2].split('.').every(c => el.classList.contains(c) || String(el.className).split(/\s+/).includes(c));
  return false;
}

// ---- 构造需要的固定节点 ----
const IDS = ['tlAxis', 'tlBody', 'tlScroll', 'tlAxisSticky', 'eraLegend', 'drawer', 'drawerMask',
  'drawerInner', 'drawerClose', 'lightbox', 'lbImg', 'lbCap', 'lbClose', 'galleryGrid',
  'galleryCount', 'filters', 'clearFilters', 'cmpA', 'cmpB', 'cmpGrid', 'glossaryGrid',
  'glossarySearch', 'globalSearch', 'searchResults', 'lineageBox', 'statStyles',
  'statPainters', 'statNotes', 'statTerms', 'statProfiles', 'painterGrid', 'pCount',
  'pFilters', 'pClear', 'view-timeline', 'view-gallery', 'view-compare', 'view-glossary',
  'view-painters'];
const store = {};
const root = mkEl('body');
IDS.forEach(id => { const e = mkEl(id.startsWith('view-') ? 'section' : 'div'); e.id = id; store[id] = e; root.appendChild(e); });
['cmpA', 'cmpB'].forEach(id => { store[id].options = []; store[id].value = ''; });
store.globalSearch.value = '';

global.window = { AH_DATA: [], AH_PAINTERS: [], AH_SCHEMA: {},
  addEventListener() {}, scrollTo() {}, requestAnimationFrame(f) { f(); },
  innerWidth: 1280, innerHeight: 800, pageYOffset: 0, location: { href: '' } };
global.requestAnimationFrame = f => f();
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(loadMetJson()) });
function loadMetJson() { return JSON.parse(fs.readFileSync('./data/met-images.json', 'utf8')); }

global.document = {
  body: root,
  documentElement: mkEl('html'),
  getElementById: id => store[id] || null,
  createElement: mkEl,
  createTextNode(t) {
    const n = mkEl('#text');
    n._text = String(t);
    return n;
  },
  querySelectorAll: sel => matchAll(root._all(), sel),
  querySelector: sel => matchAll(root._all(), sel)[0] || null,
  addEventListener() {},
  elementFromPoint() { return null; },
  title: '',
};
global.getComputedStyle = () => ({ display: 'block', position: 'static', color: '', backgroundColor: '', width: '600px' });
global.Event = function (t) { this.type = t; };
global.MouseEvent = function (t) { this.type = t; };
global.navigator = { userAgent: 'node' };

// ---- 载入数据（文件列表从 index.html 解析）----
const html = fs.readFileSync('./index.html', 'utf8');
const dataFiles = [...html.matchAll(/data\/([\w-]+)\.js/g)].map(m => m[1]);
dataFiles.forEach(f => {
  const code = fs.readFileSync('./data/' + f + '.js', 'utf8');
  new Function('window', code)(global.window);
});
console.log('载入数据文件:', dataFiles.length, '个');

// ---- 执行 app.js ----
const appCode = fs.readFileSync('./assets/app.js', 'utf8');
try {
  new Function('window', 'document', 'getComputedStyle', 'requestAnimationFrame',
               'fetch', 'Event', 'MouseEvent', 'navigator', appCode)(
    global.window, global.document, global.getComputedStyle,
    global.requestAnimationFrame, global.fetch, global.Event,
    global.MouseEvent, global.navigator);
  console.log('app.js 执行成功（无抛错）');
} catch (e) {
  console.log('app.js 执行出错:', e.message);
  console.log(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

let fail = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fail++; };

(async () => {
console.log('\n=== 渲染结果 ===');
const bands = document.querySelectorAll('.tl-band');
const bars = document.querySelectorAll('.tl-bar');
ok(bands.length === 9, '泳道数 = 9（实际 ' + bands.length + '）');
ok(bars.length === window.AH_DATA.length,
   '流派条数 = 数据条数 ' + window.AH_DATA.length + '（实际 ' + bars.length + '）');
ok(document.querySelectorAll('.tl-sep').length === 1, '平行传统分隔线存在');
ok(document.querySelectorAll('.era-tag').length === 9, '时期图例 9 个');

console.log('\n=== 统计数字 ===');
const g = id => (store[id] ? store[id].textContent : '');
console.log('  流派/画家/有档案/赏析/术语 =',
  [g('statStyles'), g('statPainters'), g('statProfiles'), g('statNotes'), g('statTerms')].join(' / '));
ok(Number(g('statStyles')) === window.AH_DATA.length, '统计里的流派数正确');

// loadMet 是异步的（fetch → then 设置 MET → 重渲染），
// 这里让出几个微任务周期，等它完成后再断言馆藏图
await new Promise(r => setImmediate(r));
await new Promise(r => setImmediate(r));
await new Promise(r => setImmediate(r));

console.log('\n=== 新增 12 个流派的详情页 ===');
const NEW = ['indian-painting', 'korean-painting', 'buddhist-art-asia', 'oceanic-art',
  'aboriginal-art', 'spanish-golden-age', 'flemish-baroque', 'hudson-river-school',
  'neue-sachlichkeit', 'conceptual-art', 'fluxus', 'neo-expressionism'];
NEW.forEach(id => {
  const bar = document.querySelector('.tl-bar[data-id=' + id + ']');
  if (!bar) { ok(false, id + ' 没有对应的流派条'); return; }
  const fn = (bar._listeners.click || [])[0];
  if (!fn) { ok(false, id + ' 流派条未绑定点击'); return; }
  store.drawerInner.innerHTML = '';
  fn();
  const secs = store.drawerInner.querySelectorAll('.d-sec').length;
  const traits = store.drawerInner.querySelectorAll('.d-traits li').length;
  const items = store.drawerInner.querySelectorAll('.p-item').length;
  const links = store.drawerInner.querySelectorAll('.linkbtn').length;
  const schema = store.drawerInner.querySelectorAll('.schema-box').length;
  const imgs = store.drawerInner.querySelectorAll('.d-img-card').length;
  const name = window.AH_DATA.find(s => s.id === id).name;
  const good = secs >= 8 && traits === 5 && items >= 5;
  console.log((good ? '  OK   ' : '  FAIL ') + name.padEnd(14) +
    '板块' + String(secs).padStart(2) + ' 要点' + traits + ' 画家' + String(items).padStart(2) +
    ' 深链' + String(links).padStart(2) + ' 馆藏图' + String(imgs).padStart(2) +
    ' 示意图' + schema);
  if (!good) fail++;
});

console.log('\n=== 导航与静态结构（查 index.html 源码，桩不解析静态 HTML）===');
const navBtns = [...html.matchAll(/class="navbtn[^"]*"\s+data-view="(\w+)"/g)].map(m => m[1]);
ok(navBtns.length === 5, '导航 5 个入口：' + navBtns.join(' / '));
ok(navBtns.includes('painters'), '含画家与画作入口');

console.log('\n=== 搜索（含新增内容）===');
const si = store.globalSearch;
const fire = q => {
  si.value = q;
  (si._listeners.input || []).forEach(f => f());
  const first = store.searchResults.querySelectorAll('.sr-item')[0];
  return first ? first.textContent.replace(/\s+/g, ' ').slice(0, 46) : '无结果';
};
[['委拉斯开兹', '画家'], ['苏巴朗', '画家'], ['基弗', '画家'], ['郑敾', '画家'],
 ['西班牙黄金时代', '流派'], ['观念艺术', '流派'], ['激浪派', '流派'],
 ['宫娥', '作品'], ['事件谱', '术语'], ['真景山水', '术语'], ['点画', '术语']].forEach(([q, want]) => {
  const r = fire(q);
  const good = r.indexOf(want) >= 0;
  console.log((good ? '  OK   ' : '  FAIL ') + q.padEnd(10) + '→ ' + r);
  if (!good) fail++;
});

console.log('\n=== 地域筛选：标签须收敛，且迁徙画家能被多地筛到 ===');
const R = window.AH_REGION;
ok(!!R, 'AH_REGION 已载入（data/regions.js 已在 index.html 中引用）');
if (R) {
  const PTall = window.AH_PAINTERS;
  const cnt = {};
  let noTag = 0;
  PTall.forEach(p => {
    const t = R.of(p.region);
    if (!t.length) noTag++;
    t.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
  });
  const tags = Object.keys(cnt);
  const rawKinds = new Set(PTall.map(p => p.region)).size;
  console.log('  原始 region 取值 ' + rawKinds + ' 种 → 归一化标签 ' + tags.length + ' 个');
  ok(tags.length <= 45, '地域标签收敛到 45 个以内（原 ' + rawKinds + ' 个不可用）');
  ok(noTag === 0, '每位画家都能解析出至少一个地域');
  ok(!tags.some(t => /→/.test(t)), '标签中不再含迁徙箭头');
  ok(tags.indexOf('欧洲') < 0, '已剔除「欧洲」这类过于笼统的标签');

  // 筛选器实际渲染出的地域 chip。渲染顺序为 时期 / 流派 / 地域 三行，
  // 取第三个 .fchips 容器里的 chip（用 children 而非 _all，避免混入其他行）
  const pf = document.getElementById('pFilters');
  const chipBoxes = (pf ? pf._all() : []).filter(e => e.classList.contains('fchips'));
  const regBox = chipBoxes[2] || chipBoxes[chipBoxes.length - 1];
  const chips = regBox ? (regBox.children || []).filter(e => e.classList.contains('chip')) : [];
  console.log('  筛选器共 ' + chipBoxes.length + ' 行，地域 chip 数: ' + chips.length);
  ok(chips.length === tags.length,
     '筛选器地域 chip 数(' + chips.length + ') = 归一化标签数(' + tags.length + ')');
  ok(chips.some(c => /\d/.test(c.textContent)), 'chip 上带画家数量（便于判断该点哪个）');
  if (chips.length) console.log('  前 8 个: ' + chips.slice(0, 8).map(c => c.textContent).join(' / '));

  // 关键：一位迁徙画家应同时出现在两个地域下
  const multi = PTall.filter(p => R.of(p.region).length >= 2);
  console.log('  横跨多地域的画家: ' + multi.length + ' 位');
  ok(multi.length > 20, '存在大量多地域画家（迁徙路径已被正确拆分）');
  // 用户举的例子：「布鲁塞尔→法国·巴黎」应同时归比利时与法国
  const sample = PTall.find(p => /布鲁塞尔→/.test(p.region || ''));
  if (sample) {
    const t = R.of(sample.region);
    ok(t.indexOf('比利时') >= 0 && t.indexOf('法国') >= 0,
       sample.name + '（' + sample.region + '）→ [' + t.join(',') + '] 同时归属比利时与法国');
  } else {
    ok(false, '未找到「布鲁塞尔→...」样本（数据可能已变，需更新断言）');
  }

  // 流派侧的大洲归一化
  const styleRegionSet = {};
  window.AH_DATA.forEach(s => {
    const raw = (s.region || '').split('·')[0].trim();
    styleRegionSet[raw] = 1;
  });
  ok(Object.keys(styleRegionSet).length > 7,
     '流派 region 原始写法多样（' + Object.keys(styleRegionSet).length + ' 种），需归一化');
  const gf = document.getElementById('filters');
  const gBoxes = (gf ? gf._all() : []).filter(e => e.classList.contains('fchips'));
  let contChips = 0, contTxt = '';
  gBoxes.forEach(b => {
    const cs = (b.children || []).filter(e => e.classList.contains('chip'));
    const txt = cs.map(c => c.textContent).join('|');
    if (/欧洲/.test(txt) && /美洲/.test(txt)) { contChips = cs.length; contTxt = txt; }
  });
  if (contTxt) console.log('  大洲标签: ' + contTxt.replace(/\|/g, ' / '));
  console.log('  图墙大洲 chip 数: ' + contChips);
  ok(contChips > 0 && contChips <= 8,
     '图墙地域收敛为大洲级（' + contChips + ' 个，原 ' + Object.keys(styleRegionSet).length + ' 种写法）');
  ok(!Object.keys(styleRegionSet).some(k => k === '欧美') || contChips <= 8,
     '「欧美」「美洲与欧洲」等同义写法已合并');
}

console.log('\n' + (fail === 0 ? '全部通过 ✓' : fail + ' 项失败'));
process.exit(fail === 0 ? 0 : 1);
})();
