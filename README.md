# 美术史图谱 Art History Atlas

按时期、流派、画家、画作查询与理解美术史的静态网站。

**在线访问**：https://dylan-byte-max.github.io/art-history/

## 内容规模

- **58 个流派**，从古埃及到当代；西方主线之外含中国、朝鲜半岛、日本、印度、伊斯兰、亚洲佛教、非洲、大洋洲、澳洲原住民、前哥伦布美洲十条平行传统
- **285 位画家**，其中 **262 位附完整档案**（定位 + 生平 + 代表作）
  - 未建档的 12 项均为匿名创作集体（如贝宁王室铸工行会、玛雅宫廷画师），无个人生平可考，界面中已明确标注
- **807 篇作品逐幅赏析**（看什么、为什么重要）、**218 条术语**
- **365 张公版馆藏图**，来自 The Metropolitan Museum of Art Open Access（CC0）

## 四个查询入口

| 入口 | 用途 |
|------|------|
| **时间轴** | 45 个流派按年代横向排布，鼠标划过高亮其源流与影响关系 |
| **画家与画作** | 262 位画家档案，每位挂载本人代表作与逐幅赏析；可按时期/流派/地域筛选，支持「按画家」与「按作品」两种浏览模式 |
| **图墙** | 按时期 / 地域 / 题材 / 媒材四维反向筛选，适合「看到一幅画想知道属于哪派」 |
| **流派对比** | 并排双栏比较两个流派，内置 5 组高频易混对 |
| **术语词典** | 140 条术语按流派索引，读风格描述时速查 |

搜索支持模糊匹配：忽略间隔符（输入「达芬奇」可命中「达·芬奇」）、异体译名（凡高/梵高）、英文名与作品名片段。

每个流派详情含 8 个板块：风格主张（300-500 字）、5 个识别要点、馆藏图、代表画家、代表画作、历史背景、影响关系、典型色板。

## 目录结构

```
index.html              入口
assets/app.js           交互逻辑（时间轴布局、筛选、搜索、抽屉）
assets/style.css        样式
data/part1~part8.js     58 个流派的文字内容，按时期与主题分卷
data/met-images.json    272 张作品图索引（MET objectID + 图片 URL + 元数据）
data/schemas.js         无公版图流派的 SVG 风格示意图
data/painters-a~n.js    262 位画家档案：生平、定位、代表作与逐幅赏析
push.py                 通过 GitHub API 批量推送（git push 在部分环境静默失败时使用）
fetch_met.py            全量抓取 MET 公版作品图
fix_met.py              修正画家多样性（每位画家限额轮询）
fix_asia.py             修正亚洲部与伊斯兰部绘画抓取
fetch_classicism.py     单流派增量抓图模板（新增流派时复制修改即可）
fetch_new12.py          多流派批量抓图（画家型 / 地域型两种检索模式）
verify_timeline.js      时间轴分带逻辑静态断言（数据文件列表自 index.html 解析）
verify_layout.js        布局与 sticky 坐标轴的 CSS 断言
verify_render.js        用轻量 DOM 桩在 node 中真实执行 app.js，验证渲染与搜索
```

## 关于图片与版权

- 作品图与元数据来自 MET Open Access，标记 `isPublicDomain: true` 的作品为 CC0
- **1930 年后的作品多数仍在版权保护期**，因此野兽派、立体主义、抽象艺术、超现实主义、极少主义无公版图，改以 SVG 风格示意图呈现（已明确标注非原作复制），并保留代表作清单供自行检索
- 文字内容为本地数据，断网可正常阅读；图片需联网加载

## 扩展方式

新增流派：在 `data/part*.js` 的数组中追加一个对象，字段参照现有条目（`id / name / era / start / end / summary / traits / painters / works / context / from / to / terms / palette`）。
补充图片：重跑 `python fetch_met.py`，脚本按流派增量写入 `data/met-images.json`。

## 数据来源

The Metropolitan Museum of Art Collection API — https://metmuseum.github.io/
