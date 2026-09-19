# 贸易小车（货运 / FreightPanel）功能交接文档

> **用途**：后续更新或**删除**本功能时的唯一索引。
> **状态**：首版已上线，仅实现「左侧物品列表 + 价格」；小车本体、订单页、市场买卖交互**未做**。
> **建立时间**：2026-09-19
>
> 相关文档：`freight-cart-recon.md`（游戏侧资源与数据勘察，含订单/市场全量数据说明）

---

## 一、这个功能是什么

游戏内正式名 **`FreightPanel`（货运）**——用小车运货做买卖，入口是营地 `carriage` 建筑。
游戏里是**双页签**（订单 / 市场）。网页版**只做了「市场货物列表 + 价格」这一块**，
并且因为不做小车本体，把原本「左侧列表 + 右侧小车」的布局改成了**列表铺满内容区**。

命名对照（避免对不上源码）：

| 位置 | 名称 |
| --- | --- |
| 游戏源码 / prefab / 数据表 | 货运、`FreightPanel`、`cart_*` |
| 网页导航与路由 | **贸易小车**、`/freight` |

---

## 二、文件清单

### 核心文件（删除时必删）

| 路径 | 说明 |
| --- | --- |
| `src/views/FreightView.vue` | 页面本体（12 KB） |
| `scripts/parse/freight.mjs` | 数据解析器（5 KB） |
| `public/data/parsed/freight.json` | 解析产物（26 KB，构建时重新生成） |
| `scripts/dev/import-freight-atlas.mjs` | 图集导入脚本（4 KB） |
| `public/images/FreightPanel_Atlas/` | **39 个 webp**，合计 0.97 MB（最大是 `cart_bg` 796 KB） |

### 需要改动的接入点（删除时逐项摘除）

| 文件 | 位置 | 内容 |
| --- | --- | --- |
| `scripts/parse/index.mjs` | L34 附近 | `import { buildFreightFile } from './freight.mjs'` |
| `scripts/parse/index.mjs` | jobs 数组 | `{ name: 'freight', build: () => buildFreightFile(), dependsOnItems: false },` |
| `src/router/index.js` | L54-58 | `{ path: '/freight', name: 'freight', component: () => import('../views/FreightView.vue') }` |
| `src/components/NavigationMenu.vue` | defaultNavList | `{ name: '贸易小车', path: '/freight', icon: '/images/FreightPanel_Atlas/cart_back.webp' }` |
| `src/components/NavigationMenuLite.vue` | 注释 | 仅一段说明「刻意不收录」的注释，无实际条目 |

> ⚠️ **精简导航里没有贸易小车**（按用户要求刻意排除），只留了注释说明。
> 完整导航（`NavigationMenu.vue`）里才有该条目。删功能时别只删一处。

### 勘察产物（`scripts/dev/scratch/codec/`，已被 gitignore，可随手删）

**仍可能有用**：

| 文件 | 用途 |
| --- | --- |
| `freight-prefab.txt` | **275 节点完整层级 + 设计坐标 + 精灵名 + Label 文案**（做订单页/小车时直接用） |
| `freight-left.txt` | 左侧列表子树（含全部元素坐标与颜色） |
| `dump-freight-full.py` | 导出上面那份层级的脚本（UnityPy 解析 `.asset`） |
| `dump-left-list.py` | 只导出 LeftUI 子树 |
| `check-freight-sprites-used.mjs` | 核对视图用到的 sprite 是否都已导入 |
| `audit-freight-footprint.mjs` | 盘点本功能全部文件与引用（写本文档用的） |

**验证脚本**（改动后建议保留并跑，见第六节）：

| 文件 | 用途 |
| --- | --- |
| `verify-freight-viewports.mjs` | 4 种视口（1912/1440/1280/390）布局与坏图检查 |
| `measure-distortion.mjs` | 量各图片元素是否被拉伸变形 |

**一次性排查脚本**（共 10 个，排查完即可删）：

```
audit-freight-assets.mjs   check-freight-titles.mjs   debug-freight-scale.mjs
dump-freight-prefab.py     extract-freight-layout.mjs find-freight-data.mjs
measure-freight-canvas.mjs measure-freight-view.mjs   parse-freight-asset.mjs
shot-freight-panel.mjs     trace-freight-height.mjs
```

**截图**（`freight-v3..v9.png`、`freight-*-zoom.png`、`nav-freight.png`）：**12 张、合计 15.4 MB**，可删。

> scratch 里 freight 相关合计 **29 个文件、15.43 MB**：脚本/文本 17 个（仅 55 KB）+ 截图 12 个（15.38 MB）。
> 删截图就能回收绝大部分空间。

### 数据源（项目外，只读，不要动）

| 路径 | 内容 |
| --- | --- |
| `../Config_decrypted/market.json` | 市场 51 商品（basePrice / maxNum / addNum / buyIn / sellOut） |
| `../Config_decrypted/newOrder.json` | 委托订单 40 条（已透传进产物，网页暂未用） |
| `vue-myrzg/raw/market.json`、`raw/newOrder.json` | 解析器实际读取位置（`raw/` 优先，缺则回落 `public/data/`） |
| `../UI_Atlases/FreightPanel_Atlas/sprites/` | 35 张图集切图（导入脚本的源） |
| `../4.24路资源包/assets/res/prefab/uiprefab/freightpanel/` | 预制体目录 + 4 张额外大图（`cart_order_botm` 等） |
| `../game.taptap.tqpmyrzg/assets/Android/AssetBundle/prefab/uiprefab/freightpanel/freightpanel.asset` | **UnityFS 二进制预制体**（坐标来源，756 KB） |
| `../源码/源码/Assembly-CSharp/Freight*.cs` | 11 个源码类（`FreightPanel` / `FreightOrderUI` / `FreightMarketUI` 等） |

---

## 三、删除步骤（照抄即可）

```bash
# 1. 删核心文件
rm src/views/FreightView.vue
rm scripts/parse/freight.mjs
rm scripts/dev/import-freight-atlas.mjs
rm public/data/parsed/freight.json
rm -rf public/images/FreightPanel_Atlas

# 2. 摘接入点（4 处，见上表）
#    - scripts/parse/index.mjs 的 import 与 jobs 条目
#    - src/router/index.js 的 /freight 路由
#    - src/components/NavigationMenu.vue 的「贸易小车」条目
#    - src/components/NavigationMenuLite.vue 的注释（可选）

# 3. 可选：删勘察产物
rm vue-myrzg/docs/dev-logs/2026-09/freight-cart-recon.md   # 若不再需要
rm -rf vue-myrzg/scripts/dev/scratch/codec/freight-*        # 截图与导出文本

# 4. 验证
npm run build
npm run verify          # 若脚本仍在
```

> `public/data/parsed/freight.json` 由 `npm run build` 的 `data:build` 阶段生成，
> 删掉解析器后该文件不会再出现；但**已提交的产物要手动 `git rm`**。

---

## 四、更新时必读：已知坑与设计取舍

### 1. 价格档位目前恒为 `ori`（同一底色）

`priceScale` 固定为 `1`（= 基准价），因为网页版不连服务器。
判定函数与字段都保留了，源码逻辑照抄在 `scripts/parse/freight.mjs` 的 `priceTier()`：

```
step = (priceMax - priceMin) / 5
priceScale > priceMin + step*4 → max；+3 → high；+2 → ori；+1 → low；否则 min
```

**要做本地价格模拟**：填真实 `priceScale` 即可，五档底色立刻能看出来。
（游戏里由服务器驱动，参数见 `market.priceRandomArea` / `priceMaxChange` / `priceInterval`。）

### 2. 面板高度必须用 `!important` 设置（否则页面被撑高、标题跑出视口）

`.freight-grid` 是 `UiCardGrid` 的根元素，自带 `flex: 0 0 auto / overflow-y: visible`，
会按内容撑高。**scoped CSS 规则匹配成功但被吃掉**——实测项目全局的 `transition: all`
会让不带 `!important` 的 `max-height` 失效（注入 `!important` 立即生效：h 2760 → 400）。

Vue 的 `:style` 绑定加不了 `!important`，故 `FreightView.vue` 用：

```js
grid.style.setProperty('max-height', `${h}px`, 'important')
grid.style.setProperty('overflow-y', 'auto', 'important')
```

高度由 `measure()` 按视口量取（`window.innerHeight - wrap.getBoundingClientRect().top - 24`）。
**改这个页面时别把这套机制当成冗余代码删掉。**

### 3. `class="freight-grid"` 会落在 `UiCardGrid` 的根元素上

不要给它设 `display: flex`——会覆盖组件自带的 `overflow-y: auto`，导致不再滚动、按内容撑高。

### 4. `UiVirtualGrid` 未从 `ui/index.js` 导出

必须直接引组件（与家具/物品图鉴一致）：

```js
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'
```

### 5. ⚠️ 游戏 prefab **自己就在拉伸这些图**，不要照抄尺寸

| sprite | 原图 | prefab 显示 | 拉伸 |
| --- | --- | --- | --- |
| `cart_num`（条目底） | **28×28** | 148×28 | **5.3×** |
| `cart_price_*`（价格底） | 64×28 | 148×28 | 2.3× |

照搬 prefab 尺寸 = 照搬变形（首版就踩了，被用户指出）。
当前做法：条目底改用**圆角半透明行底**；价格底只做**适度**横向铺满（104px ≈ 1.5×），纵向保真。

同理 `cart_order_botm` 是 **376×280 的小面板**九宫格，本页列表区远大于它，
`background-size:100% 100%` 与 border-image 九宫格都会失真，故改用半透明羊皮纸底。

### 6. 「货物行情」标题是**网页自加**，不是游戏里的

`cart_title` 这个 sprite **并未出现在 prefab 中**（别去 prefab 里找对应的标题节点）。
首版误把它当标题拉成 240×34 严重变形，现已改为纯文字 + 装饰线。

### 7. 精灵覆盖度：视图用到的 31 个 sprite 全部可得

- 35 张图集切图 + 4 张额外大图 = `public/images/FreightPanel_Atlas/`（39 个）
- 品质框复用 `ItemBagPanel/item_f_1..6`
- 货币图标复用 `Common_ItemIcon/item_00001`（银币，与源码 `playerServerData.Money` 一致）

核对脚本：`node scripts/dev/scratch/codec/check-freight-sprites-used.mjs`

---

## 五、未实现的部分（后续要做的方向）

数据与资源都已就绪，**不需要再从游戏里挖**（详见 `freight-cart-recon.md`）。

| 部分 | 可用资源 | 说明 |
| --- | --- | --- |
| **订单页**（页签 0） | `freight.json` 的 `orders`（40 条，含 `charaText`/`charaImg`/`items`/`baseValue`） | 委托人立绘 `cart_at_npc_*` 共 **70 张**在 `4../4.24包/Sprite/` |
| **市场买卖交互** | `FreightMarketUI.cs`（1019 行） | 买卖切换、价格波动、补货、载重 |
| **小车本体** | prefab 里 12 层 UITexture 拼装（hood/back/front/box/5 货箱/2 轮组） | 另有 Spine 模型 `Npc_cart` / `Npc_cart02`（需先导出静态图） |
| **发车三态**（Doing/WaitDo/Done） | prefab 坐标已导出在 `freight-prefab.txt` | 含进度条 `cart_bar_*`、状态角标 `cart_bar_tag_*` |
| **面板底图** | `cart_bg.png` 1680×1000 已导入 | 若恢复「列表 + 小车」双栏布局可用 |
| **音效** | `carriage1.wav` / `carriage2.wav` | 在 `4.24路资源包/assets/res/audio/effect/ui/` |

**双页签**：游戏是订单/市场两个 toggle（`cart_page` / `cart_page_on` 128×60，已导入）。
网页版若要加，可复用项目通用的 `UiSegmentedTabs` 或 `UiTabs`。

---

## 六、验证清单（改动后请跑）

```bash
npm run build                          # 含 data:build，会重新生成 freight.json
node scripts/dev/scratch/codec/check-freight-sprites-used.mjs   # sprite 覆盖度
node scripts/dev/scratch/codec/verify-freight-viewports.mjs     # 4 种视口（1912/1440/1280/390）
node scripts/dev/scratch/codec/measure-distortion.mjs           # 图片比例是否变形
npx playwright test tests/ui/filter-collapse.spec.js tests/ui/sidebar-mascot.spec.js
```

**预期**：

- 4 种视口均：无坏图、无横向溢出、无控制台错误
- 1912/1440 → 2 列；1280/390 → 1 列
- 条目框/图标/银币图标比例 1:1（无变形）
- 页面高度收在视口内（约 850px），标题不被顶出

---

## 七、当前状态快照（2026-09-19）

- **路由**：`/#/freight` 可用
- **导航**：完整导航 19 项含「贸易小车」；精简导航 7 项**不含**（刻意排除）
- **数据**：51 商品 / 40 订单（订单已透传未用）
- **资源**：39 个 webp，合计 0.97 MB
- **测试**：相关 UI 测试通过；全站坏图扫描 0
