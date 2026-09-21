# 关卡图鉴（/chapters）交接说明

> 写于 2026-09-20 会话结束前。用于下一个会话接手。
> 项目：`E:\Desktop\html\myrzg\vue-myrzg`（Vue 3 + Vite + Capacitor Android）

## 一、当前状态

- **分支**：`main`，本地领先 `origin/main` **10 个提交，全部未推送**（用户明确要求先本地开发）。
- **开发服务器**：后台任务已启动，地址 `http://127.0.0.1:4174/#/chapters`（`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort`）。新会话若已失效，用同样命令重启。
- **工作区干净**，无未提交改动。
- **网络**：本环境 `github.com` 被 DNS 劫持到 `28.0.0.x`，**推不上去**；但用户自己那台能推（前几轮他推成功过）。要推送就让用户推，或等他给代理。

## 二、这轮做了什么

`/chapters` 关卡图鉴页，从零到现在的样子：

1. **数据层** `scripts/parse/chapters.mjs` → `parsed/chapters.json`（249 KB）+ `parsed/stages/{id}.json`（92 个）。
2. **地图视图分两级**（互斥于列表视图）：
   - 未选章节 → **世界地图**（底图 + 6 块章节拼块，`ChapterMapCanvas.vue`）
   - 已选章节 → **地区路线图**（底图 + 节点 + 连线，`RegionRouteMap.vue`）
   - 「展开列表」切列表视图；列表里「进入地图」切回来。URL：`/#/chapters`（世界地图）、`?chapter=c1`（地区图）、`?view=list`（列表）。
3. **移动端不出地图**（< 767px 恒为列表），因为拼块里的章节名在 390px 下只有约 9px 高。
4. 顺手修了：黑名单漏出被隐藏地区（物品来源 / 副本卡片）、地图区多余滚动条、整张地图上下镜像。

## 三、上一轮待办：已全部完成（2026-09-21）

用户给了三张游戏截图，按「先量后写」把下面四项做完（详见 [2026-09-21 日报](dev-logs/2026-09/2026-09-21.md)）：

| # | 问题 | 结果 |
| --- | --- | --- |
| 1 | 副本 / 小地区 / 关卡名的位置没对齐 | 三类各自对齐游戏：关卡编号改成**无底板白字 + 深色描边**；地区名称牌挂圆盘下缘；副本名压进图标**自带的石牌**（y 148..165，距底 8.3%） |
| 2 | 副本图标大小不对 | 副本 72→74px；地区改成按 **sprite 圆盘比例**推算，盒子直接做成圆盘本身（56×56） |
| 3 | 地区立体图与附近关卡节点重叠 | 已修，且**锚点也修对了**（见下） |
| 4 | 缺「自由探索」小字与橙色装饰框 | 补了「自由探索」标签；橙环经确认是 `selectGo` **选中态**，按用户要求**不显示** |

**第二轮反馈（用户看了截图后）**：橙环去掉；「小地区和副本的图标怎么这么小、怎么都没有在节点上」——根因是**锚点**：两个节点图的锚点语义和「sprite 居中摆放」不一致。

- **副本入口图**：`InstanceRoomItemUI` 用 `MakePixelPerfect()`，图以**自身中心**落在节点坐标上。源码在那里多减了 75，但游戏截图里图标正落在节点上（**连线端点就在图标中心**），所以本站取 0。
- **地区立体图**：锚点在**圆盘中心**（sprite 高度的 75.4% 处，比 sprite 中心低 25.4%），改用 `.region-map__node-art { top: -17.8px }` 让圆盘中心落在节点坐标上。
- 判据工具：`scripts/dev/scratch/measure-link-endpoints.mjs`（把金色虚线打点画出来，端点就是节点坐标）。

**顺带修掉一个会写坏产物的坑**：`chapterMapLayout.mjs` 里 `AREA_TITLE_RECT` 等常量与图集 `mSprites` 表不符（`AREA_TITLE_RECT` 指到空白区域），重跑导入会切出空图。现在矩形全部取 `mSprites` 表的值，`ATLAS_PATH` 也改指完整尺寸的 `MapPanelAtlas #11770.png`（同目录 `MapPanelAtlas.png` 是缩略版，y 会越界）。核对入口 `scripts/dev/scratch/find-sprite-origin.mjs`。

**新增回归**：`tests/ui/chapters-map.spec.js`（5 例，仅 desktop，含「图形锚点落在节点坐标上」与「名称牌不会把石台压掉一半以上」两条断言）。

**仍待产品判断**：「自由探索」标签是静态文案（游戏里写死这块 `map_a_tag`，配置里无对应字段）。

## 四、关键实现要点（踩过的坑，别再踩）

### 坐标与素材

- **Y 轴要翻转**：配置是 Unity UI 的 `localPosition`（+y 向上），CSS 的 `top` 是 +y 向下。统一 `y_css = size.h − y_unity`，**节点、连线、底图中心都要翻**，摆放偏移（地区 −80、副本 −75）在 Unity 坐标里先加再翻。判据：游戏截图里 2-6 在 2-5 上方，配置 `y(2-6)=1095 > y(2-5)=957`。
- **节点字段别用错**：副本节点用 `map.instance[].img`（`map_w1_cN_dM`），**不是** `instance.icon`（那是平面图标）；地区节点用 `area.icon`。
- **关卡石台**：在 `atlas/uiatlas/mappanel/MapPanelAtlas.png` 里。该图集**不透明**且排得密，「整列全空」式分段无效（切出 1 段 0 候选），必须用**连通域标记**。石台在 x=402 那一竖列（126×126）。
- **三颗宝石是叠上去的**：石台本体只有灰/橙两态，宝石各自一张 sprite（`levelSpList` 三层）。中间大 `blue-2`（atlas 558,490，38×39）、两侧小 `blue-3`（atlas 2010,1288，30×30）。
- **地区名称牌** `map_a_title`（atlas 317,683，164×52），走 `border-image`（`slice: 0 34 fill`）而不是整张缩放，否则两端菱形被拉扁。
- **副本图自带名称牌**：`map_w1_cN_dM` 里已含「迷宫挑战」徽标 + 一块空牌子，所以副本名直接压在图上，**不要**再套地区那层边框。
- 所有图集裁剪矩形固化为 `scripts/parse/chapterMapLayout.mjs` 的常量，导入脚本 `scripts/dev/import-chapter-map-assets.mjs`（默认预览，`--apply` 才写，写入后逐文件校验 SHA-256）。

### 交互

- 地区路线图 viewport 上有拖动监听并会 `setPointerCapture`，**任何按钮上都不启动拖动**，否则按钮的 `click` 不触发（缩放条、返回、节点全是按钮）。
- **只有关卡节点可点**：地区/副本/探索点是装饰（源码里地区节点的 `BoxCollider` 是 `enabled = false`），用非按钮元素 + `pointer-events: none`，否则立体图会盖住关卡节点吃掉点击。
- 平移用**显式偏移**而不是 `scrollLeft`（缩到比容器小时 `scrollLeft` 恒为 0，拖动完全失效）。
- 节点标记按 `1/zoom` **反向缩放**，屏幕上恒定大小。
- 初始视图**贴合节点包围盒**再 ×1.4（不是整张画布，节点通常只占画布一小块）。

### 布局

- 地图区高度 = **左右面板底部 − 地图区顶部**，由 `ChaptersView` 测一次给两个地图组件共用。取左右面板而不是视口（面板要留底部安全区）。
- 有 1px 边框的元素必须 `box-sizing: border-box`，否则比传入高度多占 2px，地图区比面板高、页面多一条滚动条。
- **绝对定位的 `<button>` 里不要用百分比宽度**：按钮 shrink-to-fit，与子元素百分比宽度形成循环依赖，浏览器退化成「按钮撑满、内容居中」（标题条踩过）。
- 画布底部**不留外边距**，留了同样会超出面板。

### 环境

- **PowerShell 的 `Set-Content` / `Out-File` 会毁掉 UTF-8 中文**（转乱码、连引号都可能变 `?`）。改文件一律用编辑工具，或 `node -e` 里 `fs.writeFileSync(p, t, 'utf8')`。写 git commit message 用 node 写文件（PowerShell 会加 BOM，项目历史里没有）。
- `npx` 被 PowerShell 执行策略拦，用 `node node_modules/vite/bin/vite.js`、`node node_modules/@playwright/test/cli.js`。
- Playwright 配置 `reuseExistingServer: false`，要复用正在跑的服务器得设 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174`。
- 改 hash 的 `page.goto` 不会重新加载文档，测多章节要先跳一个别的路由再回来。

## 五、验证脚本（都在 `scripts/dev/scratch/`，gitignored）

| 脚本 | 用途 |
| --- | --- |
| `verify-region-route.mjs` | 世界地图 → 地区 → 点节点开详情 → 返回 → 列表，全流程 |
| `verify-region-all.mjs` | 四个可见章节的节点/连线数与底图是否加载 |
| `verify-no-leak-pages.mjs` | 17 条路由扫描，查被隐藏地区名是否泄漏 |
| `measure-crystal-boxes.mjs` | 从石台图量水晶包围盒（**先量后写的范例**） |
| `measure-platform-crystals.mjs` | 从橙色光晕推宝石位置（上一版，已被上面那个取代） |
| `extract-atlas-sprites.mjs` | 图集连通域切分，找石台 |
| `find-blue-stars.mjs` / `find-name-bars.mjs` | 按颜色/形状找图集里的 sprite |

## 六、项目规范提醒

- 改完 → 跑对应验证 → 写 `docs/dev-logs/2026-09/2026-09-20.md` → 同步 `docs/SPEC.md` / `docs/ARCHITECTURE.md` → 再 commit。
- 一次提交一个主题；数据 + 代码混合改动可拆。
- 图片默认用原图，压缩要用户明确授权 + 备份到 `../vue-myrzg备份-资源/`。
- 黑名单匹配**按地区名（`mapName`）而不是章节代号（`c4`）**，用代号匹配不到，会出现「筛选按钮隐藏了、来源或卡片还在」。
- 测试里 `app-shell.spec.js` 有 3 个**既有失败**（改动前的 HEAD 上同样失败），不用管。
