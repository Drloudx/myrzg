# 深歌小助手 前端规范文档（SPEC）(UI & DRY 设计规范)

> ⚠️ 开发注意：`public/data/mon.json` 表自己修改较多，**不能直接替换**成别的来源版本，只能增量维护。
>
> 本文档基于重构后的代码编写，是全站 **UI 字典、通用配置、数据关联、页面规范** 的唯一权威说明。
> 后续开发必须遵守 **DRY（Don't Repeat Yourself）** 原则：凡本文档列出的映射与工具，**一律从对应模块 import，禁止在页面里各自写死**。

---

## 目录

1. [项目概览与技术栈](#一项目概览与技术栈)
2. [路由规范](#二路由规范)
3. [通用配置层（强制复用）](#三通用配置层强制复用)
4. [全局设计 Token 与 CSS 变量](#四全局设计-token-与-css-变量)
5. [全局通用布局与 UI 字典](#五全局通用布局与-ui-字典)
6. [全局公共组件规范](#六全局公共组件规范)
7. [工具函数层](#七工具函数层)
8. [状态管理（Pinia）](#八状态管理pinia)
9. [页面规范（每个页面）](#九页面规范每个页面)
10. [详情弹窗与 URL 双向同步规范](#十详情弹窗与-url-双向同步规范)
11. [数据管线（构建时清洗）](#十一数据管线构建时清洗)
12. [热更新与双轨分离架构](#十二热更新与双轨分离架构)
13. [DRY 红线清单](#十三dry-红线清单)

---

## 一、项目概览与技术栈

| 项 | 值 |
| :--- | :--- |
| 框架 | Vue 3（`<script setup>` 组合式 API） |
| 构建 | Vite 8 + `@vitejs/plugin-vue` |
| 路由 | vue-router 4（Hash 模式，全部路由懒加载） |
| 状态 | Pinia 4 + `pinia-plugin-persistedstate`（LocalStorage 持久化） |
| 原生壳 | Capacitor 8（Android）+ `@capgo/capacitor-updater` 热更 |
| 源码根目录 | `src/` |

```
src/
├── main.js                 # 应用入口（挂载 Pinia / Router / 全局样式）
├── App.vue                 # 全局壳：Header + 全局搜索 + 设置菜单 + 路由出口 + 全局弹窗
├── assets/theme.css        # 全局设计 Token + 通用布局类（唯一全局样式）
├── config/blacklist.js     # 全局黑名单配置（模糊/精确匹配）
├── router/index.js         # 路由表（全部懒加载，beforeEach 关物品弹窗）
├── stores/appState.js      # Pinia 持久化状态（成就收集）
├── utils/
│   ├── gameMappings.js     # ★ 全局映射与公共工具（全站唯一映射源）
│   ├── recipeUtils.js      # 食谱共享工具（预览清单 / 通用食材 / 食材组装）
│   ├── itemParser.js       # 物品/分类/奖励/符石/词条/套装解析（带缓存）
│   ├── heroParser.js       # 角色图鉴解析 + 属性/升级费用计算器
│   ├── petParser.js        # 魔物图鉴解析
│   ├── monsterParser.js    # 怪物图鉴 + 全怪物图鉴解析
│   ├── taskParser.js       # 任务图鉴解析
│   ├── itemModalState.js   # 物品详情弹窗的全局状态（含历史栈）
│   ├── request.js          # 智能 fetch（云端 → 本地降级）
│   ├── env.js              # 环境识别 + 资源路径规则
│   └── hotupdate.js        # Capgo 热更新检查/应用
├── components/             # 全局组件（见第六章）
└── views/                  # 12 个页面（见第九章）
```

---

## 二、路由规范

路由表位于 [src/router/index.js](file:///e:/Desktop/html/myrzg/vue-myrzg/src/router/index.js)，**全部使用动态 import 懒加载**（禁止静态 import 页面）。

| 路径 | 名称 | 页面组件 | 页面标题（App.vue pageTitle） |
| :--- | :--- | :--- | :--- |
| `/` | - | 重定向到 `/recipes` | - |
| `/recipes` | `RecipesView` | `views/RecipesView.vue` | 菜谱查询 |
| `/items` | `items` | `views/ItemsView.vue` | 物品图鉴 |
| `/heroes` | `heroes` | `views/HeroesView.vue` | 角色图鉴 |
| `/pets` | `pets` | `views/PetsView.vue` | 魔物图鉴 |
| `/petseggs` | `PetsEggsView` | `views/PetsEggsView.vue` | 魔物收益 |
| `/equip` | `equip` | `views/EquipsView.vue` | 装备图鉴 |
| `/monsters` | `monsters` | `views/MonstersView.vue` | 怪物图鉴 |
| `/achievement` | `AchievementView` | `views/AchievementView.vue` | 成就查询 |
| `/tasks` | `tasks` | `views/TasksView.vue` | 任务图鉴 |
| `/events` | `events` | `views/EventsView.vue` | 事件图鉴 |
| `/exchange` | `exchange` | `views/ExchangeView.vue` | 兑换 |
| `/dungeons` | `dungeons` | `views/DungeonsView.vue` | 副本图鉴 |
| `/rewards` | `RewardsView` | `views/RewardsView.vue` | 其他 |

**全局路由守卫**：`router.beforeEach` 统一调用 `closeItemDetail()`，确保切换页面时物品详情弹窗被关闭。

**侧边导航顺序**（[NavigationMenu.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/NavigationMenu.vue) 的 `navList`）：角色图鉴 → 魔物图鉴 → 菜谱查询 → 魔物收益 → 成就查询。这里只限制导航入口，不删除路由；物品、装备、怪物、任务、事件、副本、兑换和其他页面仍可通过原地址直接访问。完整导航组件备份在 `backups/navigation/2026-08-28/NavigationMenu.full.vue`，以后恢复入口时只需同步其中的 `navList`。

---

## 三、通用配置层（强制复用）

### 1. `src/utils/gameMappings.js` —— 全站唯一映射源

> 文件头注释即规范：「全站统一从这里取映射，禁止在页面里各自写死」。

| 导出 | 内容 | 说明 |
| :--- | :--- | :--- |
| `TASK_TYPE_LABELS` | `{1:'主线',2:'支线',3:'委托',4:'伙伴',5:'活动'}` | 任务类型中文名 |
| `TASK_TYPE_ORDER` | `{1:0,...,5:4}` | 任务类型排序 |
| `STEP_TYPE_NAMES` | 14 种步骤类型中文名 | 任务步骤类型 |
| `DIFFICULTY` | `{'1':'简单','2':'普通','3':'困难'}` | 副本难度 |
| `BASE_REWARD_ICONS` | `{money:'item_00001', ke:'item_00002', payKe:'item_00003', exp:'item_00004', ti:'item_00005', heroExp:'item_00006', equipExp:'item_00007', speed:'item_00008'}` | 基础货币/经验图标 ID |
| `BASE_REWARD_NAMES` | 与上对应的中文名 | 基础货币/经验名称 |
| `BASE_REWARD_PATHS` | 与上对应的完整图标路径 `/images/Common_ItemIcon/*.png` | **展示图标一律用它** |
| `REWARD_MODE_INFO` | `{money, randomMoney, ke}` → `{id, name, icon}` | 奖励 `rule.mode` → 展示信息 |
| `JOB_NAMES` | `{1:'近卫',2:'守护',3:'秘术',4:'射手',5:'突袭',6:'支援'}` | 职业中文名 |
| `JOB_SLUGS` | `{1:'zs',2:'qs',3:'fs',4:'yx',5:'ck',6:'fz'}` | 职业图标 slug |
| `ELEMENT_NAMES` | `{1:'水',2:'火',3:'风',4:'地'}` | 属性中文名 |
| `ELEMENT_SLUGS` | `{1:'Water',...}` | 属性 slug（大写开头） |
| `ELEMENT_SLUGS_LOWER` | `{1:'water',...}` | 属性 slug（全小写） |
| `RARITY_NAMES` | `{1:'普通',2:'稀少',3:'珍贵',4:'罕见',5:'传说'}` | 品质/稀有度中文名（**游戏官方体系** EatCookPanelUI.cs + lan.json equip_qual；物品/装备/事件探索全站统一） |
| `getRarityName(r)` | 查 `RARITY_NAMES`，兜底普通 | 品质名称工具 |
| `ITEM_CATEGORY_NAMES` | 包含所有大类、中类（11/12/13/14/16, 21/22/24, 31/32/33, 41~47, 51/52/54/55, 71~76）、小类的完整中文映射 | 物品与全局搜索分类映射 |
| `getCategoryName(code)` | 根据分类代号获取中文名 | 单个分类名称查询 |
| `buildFullCategoryTree(raw)` | 补全 gameSetting 缺失的中类小类树 | 物品图鉴级联分类树 |
| `resolveItemCategoryTags(category)` | 将 category 数组转为可读标签数组，剔除未映射纯数字 | 全局搜索与物品标签生成 |
| `STAT_NAMES` | 27 个战斗/基础属性中文名 | 属性翻译字典 |
| `translateStatName(key)` | 查 `STAT_NAMES`，兜底原 key | 属性翻译工具 |
| `getCleanSkillName(raw)` | 去掉技能名里的 `Lv: N` 后缀 | 技能名清洗 |
| `formatHighlightedText(text)` | `{数值}` / `<数值>` → 高亮 span | 技能/效果描述高亮 |
| `TAG_LABELS` | 20+ 个任务 tag 目标中文名 | 任务步骤 tag |
| `CALL_NAME_REPLACE` | `{callName1..4}` 占位替换 | 主角称呼占位 |
| `NAME_TEXT_REPLACERS` | `{myName}/[myName]/主角 → 小工匠` | 通用文本替换表 |
| `cleanDialogueBase(text)` | 标记 + 富文本（`[color=xxx]`/`[size=xx]`/`[wait=xx]`/`[b]` 家族）+ 称呼基础清洗 | 角色图鉴/任务图鉴对话共用 |
| `cleanDialogueLine(text)` | 基础清洗 + callName 主角称呼 | 任务/全局对话清洗 |
| `cleanMailContent(text)` | 称呼替换 + 邮筒占位 + `[hide]` 删除 | 邮件内容清洗 |
| `SKIP_SKINS` | 默认皮肤后缀列表 | 怪物头像跳过名单 |
| `getMonsterIcon(icon, skinName)` | avatar→colect、小写、跳默认皮肤 | 怪物头像规则 |
| `chapterSortKey(label)` / `subSortKey(type,label)` | 章节目录/二级分类排序 | 任务分类排序 |

### 2. `src/config/blacklist.js` —— 全局黑名单

| 导出 | 说明 |
| :--- | :--- |
| `FUZZY_BLACKLIST` | 模糊匹配名单：名称中包含该关键字即隐藏 |
| `EXACT_BLACKLIST` | 精确匹配名单：ID / typeId / 完整名称完全匹配才隐藏 |
| `isBlacklisted(item)` | 校验函数，支持 `{id,name,desc,tip,source,label,keywords,category,categories,place,mark}` 对象或字符串/数字 |

**生效范围**：全局搜索下拉、角色/装备/物品图鉴、成就查询、食谱配方、魔物收益、怪物图鉴、任务奖励数据、兑换页，以及构建脚本 `scripts/parse/search.mjs` 的搜索索引过滤。条目的 `category/categories` 分类字段也参与模糊匹配，因此配置 `未使用` 会同步隐藏兑换页中标记为该分类的条目。**新增条目时禁止重复添加**（名单需保持唯一）。

### 3. `src/utils/env.js` —— 环境与资源路径

| 导出 | 说明 |
| :--- | :--- |
| `CLOUD_URL` | 云端 CDN 域名 `https://myrzg.yxzmy.top` |
| `isNative` | 是否 Android 原生 APP 环境（Capacitor） |
| `getResourceBaseUrl()` | 资源基准路径：原生端在线→CDN、离线→本地；Web 端→空 |
| `getImageUrl(path)` | 图片全路径规则（见下） |

**`getImageUrl` 路径规则（全站图片唯一入口）**：
- `/ui/` 或 `ui/` 开头的 UI 图标：本地打包，不请求 CDN；
- 其他路径：自动补 `/images` 前缀（`/Common_ItemIcon/x.png` → `/images/Common_ItemIcon/x.png`）；
- 原生端在线时拼 `CLOUD_URL` 前缀，离线回退本地。

### 4. `src/utils/request.js` —— 智能 fetch

- `fetchWithFallback(relativePath)`：dev 环境 JSON 请求加时间戳防缓存；生产环境走 CDN/浏览器 HTTP 缓存（静态数据不重复下载）；云端失败自动降级读取本地打包资源，并发 `network-fallback` 事件供 UI 提示。**所有静态 JSON 数据获取统一走它**（页面内直接 `fetch` 仅限剧本分段等特殊场景）。

---

## 四、全局设计 Token 与 CSS 变量

全局变量定义于 [src/assets/theme.css](file:///e:/Desktop/html/myrzg/vue-myrzg/src/assets/theme.css)，支持亮色/暗色切换（`html.dark-mode`）。

### 1. 主题与基础调色板

| CSS 变量 | 亮色 `:root` | 暗色 `.dark-mode` | 用途 |
| :--- | :--- | :--- | :--- |
| `--primary` | `#557574` | `#7a9a99` | 主色调（湖泊暗青）、高亮、标签 |
| `--primary-hover` | `#2f4a49` | `#a8c6c5` | 悬停态主色 |
| `--bg` / `--bg-color` | `#bba282` | `#211710` | 页面背景（深色羊皮纸） |
| `--bg-card` / `--card-bg` | `#e9dcc3` | `#362a1d` | 卡片/弹窗背景（浅羊皮纸） |
| `--text-main` | `#3e2a14` | `#eaddc2` | 主文本（深棕墨水） |
| `--text-sub` | `#6b5134` | `#bca983` | 次要文本 |
| `--border-color` | `#8f7351` | `#8f7351` | 边框分割线 |
| `--hover-bg` | `rgba(85,117,116,0.14)` | `rgba(122,154,153,0.16)` | 悬浮背景 |
| `--icon-filter` | `invert(1) brightness(0.4) sepia(0.4)` | `none` | 图标主题变色（亮色下白图标反转为深棕） |
| `--icon-filter1` | `none` | `invert(1)` | 反向图标滤镜 |
| `--input-bg` / `--input-border` / `--input-border-focus` / `--input-text` | 见 theme.css | 同左（暗色为深木色） | 输入框体系 |
| `--modal-overlay` | `rgba(24,14,6,0.55)` | `rgba(8,5,2,0.7)` | 弹窗遮罩 |
| 别名 | `--bg=--bg-color=--paper-dark`、`--bg-card=--card-bg=--paper-soft`、`--primary=--accent`、`--primary-hover=--accent-ink`、`--text-sub=--text-muted`、`--text-color=--text-main` | - | 兼容别名，新代码直接用原名 |

### 2. 品质配色 Token 与类名

| 品质 | 变量 | 文本类 | 背景类 | 徽章类 |
| :--- | :--- | :--- | :--- | :--- |
| 传说 5 | `--rarity-legend` `#ffb64d` | `.quality-text-5` | `.quality-bg-5` | `.badge-5` |
| 史诗 4 | `--rarity-epic` `#ee62f1` | `.quality-text-4` | `.quality-bg-4` | `.badge-4` |
| 稀有 3 | `--rarity-rare` `#3fa2ff` | `.quality-text-3` | `.quality-bg-3` | `.badge-3` |
| 优秀 2 | - | `.quality-text-2` | `.quality-bg-2` | `.badge-2` |
| 普通 1 | `--q1` `#cfba96` | `.quality-text-1` | `.quality-bg-1` | `.badge-1` |

> 说明：`.quality-text-*` 与 `.filter-btn.quality-text-*.active` 已在 `theme.css` 全局定义（含 `!important`），页面 scoped 内**无需重复定义**；`.quality-bg-*` 页面可按需 scoped 定义（与全局 `.rarity-bg-*` 语义一致）。

> 颜色来源：游戏源码 `Const.cs` 的 `QualityColorString` / `ExtentionMethod.GetQulityColorString`；Q1=`#cfba96`、Q2=`#a7c037`、Q3=`#3fa2ff`、Q4=`#ee62f1`、Q5=`#ffb64d`。
>
> 可读性约定：`--q1` ~ `--q5` 始终保留游戏原色，用于品质边框、实底徽章和激活态背景；浅色羊皮纸上的文字使用 `--q1-text` ~ `--q5-text`，避免亮色原色直接落在浅底上造成低对比度。`--qN-bg` 是半透明品质浅底，详情面板等大块区域统一使用 `.quality-bg-N`。
>
> 叠加在插画上的小型品质角标使用 `--quality-label-bg` 不透明羊皮纸底，再叠加品质文字和边框；禁止使用半透明品质底直接压在复杂插画上。

### 字体渲染

- 全局正文和标题优先使用本地 `HarmonyOS` 常规/粗体，在 Android/无该字体环境回落 `Microsoft YaHei`，再回落 `MYR2Sans`。
- `html, body` 统一启用 `-webkit-font-smoothing: antialiased`、`-moz-osx-font-smoothing: grayscale` 和 `text-rendering: optimizeLegibility`。
- 任务剧情与物品详情标题不使用装饰性 `text-shadow`，避免小字号出现边缘毛刺；阴影仅用于图标或容器层次。
- 图鉴物品名称底板使用游戏 `PicHandBookPanel/colect_list_mx.png`，通过 CSS `border-image` 九宫格切片保留四角比例，禁止整张图片强制拉伸。

### 3. 安全区与布局变量

| 变量 | 表达式 | 用途 |
| :--- | :--- | :--- |
| `--safe-top` | `max(env(safe-area-inset-top),0px)` | 顶部刘海/状态栏 |
| `--safe-bottom` | `max(env(safe-area-inset-bottom),0px)` | 底部手势条 |
| `--safe-left` / `--safe-right` | `env(...)` | 横屏安全距离 |
| `--header-height` | `60px` | 顶部导航栏高度 |

---

## 五、全局通用布局与 UI 字典

所有业务无关的通用布局骨架定义于 `theme.css`，**子组件严禁重复定义**。

### 1. 页面容器

- `.page-view-container`：占满高度的页面主骨架（`width:100%; height:100%; display:flex; flex-direction:column; min-height:0`）。
- `.max-w-wrapper`：限宽 860px 居中容器（带 16px 安全 padding）。
- `.app-main`：路由出口容器（`width:100%; height:100%; overflow:hidden; position:relative; display:flex; flex-direction:column; min-width:0`），桌面端三栏 grid（左 250 / 中 1fr / 右 300，最大 1400px），≤1024px 移动端全屏单列；全屏详情覆盖层（如角色/魔物详情）使用 `position:absolute; inset:0` 挂在其内。
- `.filter-sticky-bar`：吸顶筛选栏（`max-height:55vh; overflow-y:auto` 防占屏）。
- `.data-grid-scroll`：可滚动数据区（`flex:1; overflow-y:auto`）。
- `.global-loading-state` / `.global-loading-spinner`：全站统一加载态。
- `.no-data`：空数据提示（`grid-column:1/-1; text-align:center`）。
- `.modal-body [class*="-list"]`：弹窗内列表不追加底部留白。

### 2. 筛选控件字典

- `.segmented-pill-container` + `.segmented-pill-item(.active)`：分段控制器（灰底圆角轨道 + 白底浮起 + `var(--primary)` 文字），用于成就/菜谱/魔物收益/任务/怪物页的 Tab 筛选。字号 13px，内边距 `6px 14px`。
- `.filter-btn(.active)`：普通筛选按钮（全局定义，含品质色 active 态）。
- `.filter-row` / `.filter-label`（52px 固定宽）/ `.filter-options`：筛选行结构。
- `.search-bar` / `.search-icon` / `.search-input`：页面内搜索栏（左图标 + 圆角输入框）。
- `.search-input-wrapper-full` / `.search-icon-img` / `.ach-search-input-full` / `.recipe-search-input-full`：全宽搜索栏（成就/任务/菜谱页款式）。
- `.clear-btn`：搜索框清空按钮（`✕`）。
- `.count-num`：计数高亮数字。

### 3. 卡片与标签字典

- `.category-tag-pill` / `.item-tag`：蓝色浮起标签（`color:var(--primary); background:#3b82f614; border:1px solid #3b82f62e; border-radius:4px; padding:3px 10px; font-size:11px; font-weight:700`）。
- `.mini-tag`（`.tag-time` / `.bg-gray`）：小号标签。
- `.badge` / `.type-N` / `.close-badge` / `.open-badge`：任务类型徽章（TasksView 内定义）。
- `.chip`：解锁任务/关卡小芯片。
- `.modal-btn-confirm`：弹窗确认按钮（全局定义，居中主色）。

### 4. 悬浮按钮

- `.nav-fab-btn`（功能导航）：右下角 `right:20px; bottom: calc(80px + var(--safe-bottom))`，44px 圆形木质按钮，三横线汉堡；`z-index:4000`，浮于详情弹窗之上可随时打开导航。
- `UiBackToTop`（[src/components/ui/UiBackToTop.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/ui/UiBackToTop.vue)）：右下角 `right:20px; bottom: calc(24px + var(--safe-bottom))`，44px 圆形木质按钮，向上箭头；`z-index:900`；仅滚动超过 100px 时显示（淡入淡出），监听指定滚动容器（`scroll-container` 选择器）。

---

## 六、全局公共组件规范

所有组件位于 `src/components/`。每个页面新增弹窗一律基于 `BaseModal`，**禁止再自建遮罩/弹窗骨架**。

### 1. `BaseModal.vue` 通用弹窗

| Prop | 类型 | 默认 | 说明 |
| :--- | :--- | :--- | :--- |
| `visible` | Boolean | `false` | 显隐 |
| `title` | String | `'提示'` | 标题（未传 header slot 时生效） |
| `maxWidth` | String | `'480px'` | 最大宽度 |

- Slots：`default`（主体）、`header`、`footer`。
- Events：`@close`（点遮罩/关闭按钮触发）。
- 使用 `<Teleport to="body">` + 淡入淡出过渡。

```html
<BaseModal :visible="isOpen" title="标题" @close="isOpen = false">
  内容
  <template #footer><button class="modal-btn-confirm" @click="isOpen = false">确定</button></template>
</BaseModal>
```

基于它的业务弹窗：`MenuModeModal`、`NoticeModal`、`VersionCheckModal`、`AboutModal`、`PetsEggsView` 详情、`RecipesView` 预览/任务详情。

### 2. `GlobalSearchBox.vue` 全局搜索框（App.vue 内）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `containerClass` | String | 外层附加类（`desktop-search` / `mobile-search`） |
| `modelValue` | String | 搜索关键词（v-model） |
| `isSearchOpen` | Boolean | 是否展开下拉 |
| `results` | Array | 过滤后的搜索结果（App.vue 的 `filteredSearchIndex`） |

- Events：`@focus`（打开下拉并懒加载搜索索引）、`@select`（点击结果项）。
- 桌面与移动端共用同一组件，仅外层容器类不同（CSS 由组件自带 scoped 样式 + App.vue 控制显隐）。

### 3. `NavigationMenu.vue` 功能导航（三模式）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `isOpen` | Boolean | 是否展开 |
| `menuMode` | String | `'side'`（默认）/ `'bottom'` / `'top'` |
| `isDesktop` | Boolean | 桌面端常驻侧边栏模式 |

- Events：`@close`。
- 菜单数据集中在 `navList`（路径/名称/图标），三模式共用。
- 图标统一走 `getImageUrl()`；菜单模式持久化在 `localStorage['menuMode']`。

### 4. `BackToTop.vue` 回到顶部

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `scrollContainer` | String | 滚动容器选择器（如 `#itemsGridScroll`），空则监听 window |

### 5. `ItemDetailModal.vue` 物品详情（全局全屏）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `visible` | Boolean | 显隐 |
| `item` | Object | 当前物品 |
| `categoryTree` | Array | 分类树（来源 `fetchItemData()`） |

- Events：`@update:visible`。
- 显示逻辑（全部复用 `itemParser`）：分类名、装备属性计算（品质/品阶滑条）、使用效果、符石效果、奖励掉落、装备组/套装/词条、解锁内容、获取途径分组、书籍内容、配方（复用 `recipeUtils`）。
- 内部通过 `pushItemDetail` / `popItemDetail` 维护查看历史栈，关闭时回溯而非直接关闭。

### 6. `MonsterDetailModal.vue` 怪物详情（全局全屏）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `visible` | Boolean | 显隐 |

- Events：`@update:visible`。
- 监听 `route.query.id`（仅 `/monsters` 路径）自动打开；形态 Tab 切换、等级成长模拟（`monLevelStrength.json` 系数）、弱点/携带效果/技能组/战利品展示。

### 7. 其他业务弹窗

| 组件 | Props | Events | 说明 |
| :--- | :--- | :--- | :--- |
| `MenuModeModal.vue` | `modelValue`、`mode` | `update:modelValue`、`update:mode` | 切换菜单模式（写 `localStorage['menuMode']`） |
| `NoticeModal.vue` | `modelValue` | `update:modelValue` | 公告列表 + 首次弹窗（`lastNoticeDate` 去重） |
| `VersionCheckModal.vue` | `modelValue` | `update:modelValue`、`request-update` | 版本检查；发现更新后发 `request-update` 交给 App.vue 调 UpdateModal |
| `AboutModal.vue` | `modelValue` | `update:modelValue` | 关于我们 |
| `UpdateModal.vue` | 无 | 无 | APK 大更新 / 热更小包下载；暴露 `startUpdateWithInfo(info)` |
| `TaskDialogLines.vue` | `lines` | 无 | 任务剧情对话行渲染（选项/文本两种行） |

---

## 七、工具函数层

### 1. `src/utils/recipeUtils.js`（食谱共享工具）

| 导出 | 说明 |
| :--- | :--- |
| `PREVIEW_AVAILABLE_IDS` | 预览大图可用料理 ID 集合（硬编码防 Vite 误打包） |
| `GENERIC_FOOD_TYPE_MAP` | 通用食材映射：`1→兽肉(item_10006)`、`2→野菜(item_10056)`、`3→浆果(item_10055)`、`4→地菇(item_10057)` |
| `buildRecipeIngredients(menuEntry, itemDict)` | 组装食材列表（`food` + `foodType` 两种来源），返回 `{typeId, name, count, icon(相对路径)}`，调用方再包 `getImageUrl` |

**RecipesView 与 ItemDetailModal 的食材组装一律使用该函数，禁止各自实现。**

### 2. `src/utils/itemParser.js`（物品解析，带模块级缓存）

| 导出 | 说明 |
| :--- | :--- |
| `fetchItemData()` | 加载 item/gameSetting/lan/avatars/reward/equipEnchant/skillTrigger/equipGroup/equipSuit/itemAffixes 并缓存；碎片名智能重命名 |
| `translateJob(jobIndices)` / `translateJobArray(jobIndices)` | 职业索引 → 中文名（字符串/数组） |
| `translateAttr(attrKey)` | 属性 key → lan.json 翻译 |
| `translateCategory(categoryArray, categoryTree)` | 分类数组 → 树形名称链（`A > B > C`） |
| `parseItemUnlocks(item)` | 使用效果（角色碎片/皮肤解锁）文本 |
| `getItemImageUrl(item)` | 物品图标智能路径（碎片用角色头像、其余用 img） |
| `parseItemRewards(item)` | 奖励掉落结构化解析（含概率计算，货币走 `REWARD_MODE_INFO`） |
| `getCachedItem(typeId)` / `getCachedItemDict()` | 缓存物品单查/整表字典 |
| `parseRuneEffect(item)` | 符石效果（含 `{值}` 高亮 HTML） |
| `parseEquipGroup(item)` / `parseEquipSuit(item)` / `parseItemAffixes(item)` | 装备组/套装/词条解析 |

### 3. `src/utils/heroParser.js`（角色解析 + 计算器）

| 导出 | 说明 |
| :--- | :--- |
| `fetchHeroData()` | 组装角色全量数据（基础/技能/星阶/天赋/档案/互动/星币上限），职业与元素映射来自 `gameMappings` |
| `calculateStats(unitData, level, rank, heroLevelConfig, heroRankConfig)` | 等级/品阶属性计算（成长率默认 5%，rank attUp 累加） |
| `calculateUpgradeCosts(targetLevel, targetRank, rarity, job, ...)` | 累计经验/银币/突破材料汇总 |

### 4. `src/utils/petParser.js`（魔物解析）

`fetchPetData()`：组装魔物全量数据（普攻/特性/主动技能、变异、基础属性、星级映射 `star + 2`）。元素映射与技能名清洗来自 `gameMappings`。

### 5. `src/utils/monsterParser.js`（怪物解析）

| 导出 | 说明 |
| :--- | :--- |
| `fetchMonsterLevelStrength()` | 等级强度系数表 |
| `fetchMonsterData()` | 官方图鉴（按 `skeletonName` 分组，fileMon 为主） |
| `fetchFullMonsterHandbook()` | 全怪物图鉴（mon.json 全量分组） |

- 两函数共用 `fetchMonsterBaseData()` / `isSummonOrEgg()` / `rankToQuality()` 内部工具。
- 头像规则复用 `gameMappings.getMonsterIcon`（含 egg / hero 皮肤特例）。

### 6. `src/utils/taskParser.js`（任务解析）

`loadTaskData()`：加载 17 张表，产出任务列表/二级分类选项/统计；步骤类型、难度、货币映射、怪物头像、分类排序全部来自 `gameMappings`；奖励图标基础货币用 `BASE_REWARD_PATHS`。

### 7. `src/utils/itemModalState.js`（物品弹窗全局状态）

| 导出 | 说明 |
| :--- | :--- |
| `itemModalState` | reactive：`visible / item / categoryTree / history` |
| `openItemDetail(item, categoryTree, isPush=false)` | 打开（可入栈） |
| `pushItemDetail(item)` / `popItemDetail()` | 查看历史栈进出 |
| `closeItemDetail()` | 关闭并清空历史 |

### 8. `src/utils/hotupdate.js`

- `checkHotUpdate()`：原生端先查 Gitee APK 大版本，再查云端 `hotupdate.json` 小包（版本比较 `compareVersions`）。
- `applyHotUpdate(manifest, onProgress)`：下载热更包、记录 `local_web_version`、`CapacitorUpdater.set()` 应用。
- manifest URL 基于 `CLOUD_URL` 拼接，禁止写死域名。

---

## 八、状态管理（Pinia）

位于 [src/stores/appState.js](file:///e:/Desktop/html/myrzg/vue-myrzg/src/stores/appState.js)，使用 `persist: true` 持久化到 `localStorage['appState']`。

| state | 说明 |
| :--- | :--- |
| `collectedAchievementIds: []` | 成就收集状态 |

| action | 说明 |
| :--- | :--- |
| `toggleAchievementCollected(achId)` | 切换成就收集（内部 `toggleInList` 工具） |

> 规范：收藏类状态若新增，统一用 `toggleInList(list, id)` 语义实现；导出/导入备份直接读写 `localStorage['appState']`。

---

## 九、页面规范（每个页面）

> 每个页面遵守：数据加载态用 `.global-loading-state`，列表滚动区配 `BackToTop`，筛选状态与 URL Query 双向同步，黑名单统一 `isBlacklisted` 过滤。

### 1. 物品图鉴 `/items` — `ItemsView.vue`

- **数据源**：`fetchItemData()`（item.json + gameSetting 分类树）。
- **筛选**：搜索（名称/描述/ID）、级联大类/中类/小类（分类树逐级 `category[0/1/2]`，大类 2 特判好感礼物 `fav_gift`）、稀有度（`getRarityName` 来自配置）。
- **排序**：大类 → 中类 → 小类 → 品质降序 → ID → 中文名。
- **交互**：点击卡片 `router.push({query:{...route.query, itemId}})` 唤起全局物品弹窗。
- **URL 参数**：`?itemId=` 打开物品详情（App.vue 全局监听）。

### 2. 装备图鉴 `/equip` — `EquipsView.vue`

- **数据源**：`fetchItemData()`，过滤 `category[0]==='4'`、剔除 `show_` 开头的容器项。
- **筛选**：部位（分类树节点 4 的子节点）、品阶（`equip.equipLevel` 1~5）、稀有度。
- **排序**：部位 → 品阶降序 → 品质降序 → ID。
- **交互**：点击唤起物品弹窗；弹窗内自动隐藏「包含内容/获取途径」（`isEquipsPage` 判断）。

### 3. 角色图鉴 `/heroes` — `HeroesView.vue`

- **数据源**：`fetchHeroData()`（heroParser）+ `consume.json`。
- **筛选**：搜索（名称/称号/描述/职业/属性）、稀有度（3/4/5 星）、职业（`JOB_NAMES`）。
- **卡片**：`/images/HeroBagPanel/card_{rare}.png` 边框 + `card_{rare}_botm.png` 底图 + `{img}_ka.png` 卡面 + 属性/职业图标（slug 来自 `gameMappings`）。
- **详情全屏覆盖层**（`position:absolute` 挂 app-main 内）四个 Tab：
  - **技能星阶**：主动技能/天赋选择（`formatHighlightedText` 高亮描述、升级计划消耗汇总）、星阶命座（碎片消耗、满命转化）；
  - **基础属性**：等级 1~80 滑条（品阶 0~5，各品阶等级上限 `{0:10,...,5:60}`）、成长/静态属性、累计升级与突破消耗（`calculateStats` / `calculateUpgradeCosts`）；
  - **角色档案**：好感档案（`cleanDialogueBase` 清洗任务文本、`cleanMailContent` 清洗信件、剧情奖励、内嵌剧情展开）；
  - **互动**：好感对话/营地事件/局内探索/摸头/路过/自言自语（剧情动态加载 `data/dialogs/*.json`）。
- **URL 参数**：`?id=` 打开详情（watcher 同步）。
- 喜爱礼物点击 → `?itemId=` 唤起物品弹窗。

### 4. 魔物图鉴 `/pets` — `PetsView.vue`

- **数据源**：`fetchPetData()`。
- **筛选**：搜索、稀有度（3/4/5 星，`starDisplay`）、形态（可变异）。
- **卡片**：`petcard_{starDisplay}.png` 边框 + `petcard_botm_{starDisplay}.png` 底图 + `PicHandBookPanel/{monImg}.png` 头像（变异 `_a` 后缀）。
- **详情全屏覆盖层**两个 Tab：
  - **技能特性**：普攻/特性/主动技能选择、技能等级滑条、突破要求（`petSetting.petTpExp` / `petTjExp`）；
  - **基础属性**：基础值/成长区间、成长系数调参（C/B/A/S 评级：区间前 25%/50%/75% 划分）、等级模拟（`petLevel.json` 累计经验）、好感配置。
- **URL 参数**：`?id=` 打开详情。

### 5. 魔物收益 `/petseggs` — `PetsEggsView.vue`

- **数据源**：直接 `fetchWithFallback('data/pet.json')`（注意：与 petParser 用途不同，本页只取蛋收益指标）。
- **筛选**：行 1（全部/金币池/氪金池/3星/4星/5星，池名单 `goldPoolNames`/`premiumPoolNames`）、行 2（全部/卖/喂/按需选择）+ 重置按钮。
- **显示字段控制**：8 个可选列（时间/金币/经验/金币分/经验分/金效/经效/优先级），默认 `['sellPrice','exp','recommend']`，列序固定按 `allFields` 定义。
- **排序**：默认星级降序，点击表头切换升降序。
- **处置推荐规则**：`R = sellPrice / exp`；`R > 3.0` → **卖**，`R < 2.2` → **喂**，`2.2 ≤ R ≤ 3.0` → **按需选择**。
- **URL 参数**：`?pool=gold|premium`、`?tag=3星|4星|5星|卖|喂|按需选择`、`?id=` 打开详情弹窗。

### 6. 怪物图鉴 `/monsters` — `MonstersView.vue`

- **数据源**：`fetchMonsterData()`（官方）+ `fetchFullMonsterHandbook()`（全怪物）。
- **Tab**：怪物图鉴（按 `label` 种类筛选）/ 全怪物图鉴。
- **搜索**：`keywords` 模糊匹配。
- **图标**：`/images/MonstersView/{icon}.png`，加载失败依次回退 `PicHandBookPanel` → `colectr_mon_070_1` 拼写变体 → rawIcon。
- **交互**：点击 `?id=` 唤起 `MonsterDetailModal`。

### 7. 成就查询 `/achievement` — `AchievementView.vue`

- **数据源**：`achievement.json` + `reward.json` + `item.json`。
- **奖励拼装**：银币/氪金图标**必须**用 `REWARD_MODE_INFO`（禁止手写路径）；道具图标 `getImageUrl('/Common_ItemIcon/...')`；隐藏名称提取进 `rewardItemNames` 供搜索。
- **筛选**：状态（全部/已收集/未收集，Pinia `collectedAchievementIds`）、分类（adv/exp/live/hide）、搜索（名称/描述/奖励名）。
- **交互**：自定义开关切换收集；`?id=/?q=` 定位并高亮卡片（`.card-highlight-pulse`）。
- **URL 参数**：`?status=/?category=/?q=` 双向同步。

### 8. 菜谱查询 `/recipes` — `RecipesView.vue`

- **数据源**：`menu.json` + `item.json` + `buff.json` + `gameSetting.json`（分类编码树）。
- **食材组装**：一律用 `recipeUtils.buildRecipeIngredients`；图标 `item.img` 优先。
- **预览**：`PREVIEW_AVAILABLE_IDS.has(typeId)` 时显示预览按钮 → `/menu_prev/{typeId}_prev.png`。
- **Buff**：`buffDes` 纯文本（`{值}` 去花括号）。
- **获取途径**：`RECIPE_SOURCE_CONFIG` 表（`targetType`：`achievement` → 跳成就查询 `?id=&q=`；`task` → 跳任务图鉴详情 `?task=任务id`，任务名以任务图鉴为准）。
- **成品点击**：卡片头部（图标/名称/食材区）`handleRecipeClick` → `?itemId=` 唤起全局物品详情弹窗。
- **URL 参数**：`?tag=/?q=` 双向同步；`?id=/?q=` 定位高亮；`?itemId=` 唤起物品弹窗。

### 9. 任务图鉴 `/tasks` — `TasksView.vue`

- **数据源**：`loadTaskData()`（taskParser，17 张表，含 `data/parsed/dialogIndex.json` + `data/parsed/dialogSegments.json` 剧情分段索引）。
- **开发者开关**：`HIDE_CLOSED_TASKS = true`（隐藏已下架任务）。
- **筛选**：一级类型（1~5，`TASK_TYPE_LABELS`）、二级分类（数据驱动 `subOptions`，分段标签均分 + `.sub-wrap` 允许换行）、搜索。
- **委托分类地图名**：委托任务（taskType 3）的二级分类 C0~C5 经 `formatEntrustLabel` 直接显示大地图名（去掉 C 前缀，如 `C1`→秋日荒野；C0→求生者草原…C5→霜烬平原）。
- **详情全屏**：接取信息（NPC/条件/交互对话/剧情）、解锁任务/关卡、奖励、步骤列表（可展开，含 NPC/怪物/道具/剧情），剧情动态加载 `data/taskDialogs/{dialogId}.json`。
- **数量计数器**：`共 X 个任务` 显示在搜索框下方、居左（`.control-row-4`，`.collection-counter` 内联 `margin-left:0; padding:0`）。
- **URL 参数**：`?type=/?sub=/?q=` 双向同步；`?task=` 直达详情。

### 9.5 事件图鉴 `/events` — `EventsView.vue`

**两个 Tab**（`?tab=` 切换）：`random` 随机事件 / `explore` 探索区域，共用图片网格与详情弹层。

- **地图筛选**：`UiSegmentedTabs`（全部+5 大地图：秋日荒野/索利德山地/魔爪湖畔/黑森林/霜烬平原），两 Tab 共用，手机端自动适配；大地图名由预解析 `events.json.mapNameMap` 提供。

- **随机事件 Tab**：
  - 数据源：`data/randomEventInfo.json`（20 个）+ `data/randomEventArea.json`（事件→地图/分组/概率 chance）+ `data/reward.json` + `data/item.json` + `data/area.json`（大地图名）。
  - 卡片：**纯图片网格**（`UiCardGrid` + `UiItemCard`，桌面 3 列 / 手机 2 列），16:9 cover 大图 + 底部名称胶囊 + 右下角分组徽标（普通 rare1 / 稀有 rare2；颜色映射到品质体系 rare1→q1 灰、rare2→q3 蓝，与物品页面统一）。
  - 详情：事件大图、描述、交互按钮、出现地图（chip）、刷新概率（chance%）、冷却 CD、**事件奖励**（`reward-grid` 同任务样式，点击 `goToItem` 打开物品）。
  - URL：`?tab=random&map=&q=&event=`。
- **数量计数器**：`共 X 个事件/探索区域` 显示在搜索框下方、居左（`.control-row-4`，同任务图鉴）。
- **探索区域 Tab**：
  - 数据源：`data/exploreArea.json`（80 个探索区域，地图归属按 id 前缀 explore1→c1_map…）+ `data/mon.json`（敌人名）+ `data/consume.json`（消耗银币 explore001=200G/002=400G/003=600G）+ `data/reward.json`。
  - 卡片：同图片网格（`ts_*`/`explore*` 场景图），右下角品质徽标（名称 `getRarityName`：普通/稀少/珍贵，颜色走 theme.css 品质色 `--qN`）。
  - 详情：区域描述、所属地图、探索等级 Lv、耗时（分钟）、队伍人数、消耗（G）、探索点位、遭遇敌人（chip）、**探索奖励**（同任务样式）。
  - URL：`?tab=explore&map=&q=&explore=`。
- **图片**：`/images/event/{img}.png`（事件+探索场景图共 60 张，源目录 `新建文件夹/assets/res/texture/area/event`；`ts_*` 为探索区域图，`ts`=探索拼音缩写）。
- **卡片名称**：使用 `UiItemCard` 默认名称胶囊（底部、暖棕羊皮纸底）。
- **奖励解析**：复用 `gameMappings.parseRewardEntries`（任务/事件共用，输出 `{entries, text}`）+ `reward.json` 的 `items[].rules[]`。

### 9.6 兑换 `/exchange` — `ExchangeView.vue`

- **数据源**：`parsed/parsed-exchange.json`（[scripts/parse/exchange.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/exchange.mjs) 从 `itemExchange.json` 生成，联 `reward.json` 奖励 + `consume.json` 消耗 + `item.json` 图标名）。
- **模型**：以 `itemExchange.json`（590 条、55 个 team 组）为主。每条兑换 = `reward`（得）+ `consume`（耗）+ `limitCondition`（每日/每周/每月/全局 + 次数）+ `category`（子分类）。
- **一级分类**（下拉菜单 `.cat-select`，12 个大类）：委托兑换 / 商人购买 / 符石合成 / 兔子商人 / 活跃兑换 / 商店积分 / 种子兑换 / 礼包补给 / 爬塔兑换 / 皮肤购买 / PVP兑换 / 通用兑换。原始 `itemExchange.json` 中的 `baodimap1~5`、`baodimap1_1~5_1` 虽标注为“装备兑换”，但没有正式游戏 UI 入口，属于旧的固定品质配置，兑换页构建时过滤，不展示。锻造台“装备制作”是独立模块，不在此页推导。排除 `equipQualityUpgrade001~3`、`chouka`、缺失 `skillTwo23101` 的旧 `team/team1...` 测试组，以及原始奖励备注为“工资——暂时不用”的停用 `weituogongzi` 组。
- **二级子分类**（Tab 分段 `.sub-wrap` 可换行）：按 `category[1]`（c1~c5 → 地图名用 `gameMappings.getMapName`；每日/绿/蓝/白/紫/s1/宝石等）。地图页签严格按 `MAP_NAMES` 的 c0→c5 顺序；其余子分类按业务顺序排列。兔子商人额外生成“全部”子分类并默认选中，全部列表按紫→蓝→绿→白排序。一级只含一个子分类时隐藏 Tab。`weiTuoBanDay` 的“每日”条目来自正式 `itemExchange` 配置（委托板每日 100 氪金，消耗 1 枚荒野纪念币，限购每日 1 次）；`weituogongzi` 的 9999 消耗条目不展示。
- **卡片**：使用 `UiExchangeTrade` 多列羊皮纸卡片网格；每条 `itemExchange` 记录独立占一张卡片。卡片内部为顶部标题/限购、中部居中的获得物品图标×N、底部可换行的消耗物品图标×N，不额外显示“兑换”文字。无正式 UI 入口的 `baodimap*` 固定品质记录已在构建阶段过滤，不并入本页；锻造台是 `ProducePanel → SmithPanelUI` 的独立模块，读取 `itemExchangeRandom.json`，不并入本页。PVP 多奖励卡片使用较小的奖励图标，避免奖励列过高；奖励条目保持统一宽度。桌面卡片最小宽度 180px、间距 12px，手机端固定两列、间距 8px；礼包补给可在标题前使用 `PackPane/shop_goods_pack_*.png` 顶部图片区。点击物品 → `?itemId=` 打开物品详情。消耗和奖励的 items 结构不同（consume 直接 `{typeId,num}`，reward 用 `{rules:[...]}`），解析器兼容两者。
- **地图名全局映射**：`gameMappings.MAP_NAMES` / `getMapName`（c0~c5 及 C0/C5/c0_map 归一化）。
- **URL 参数**：`?cat=/?sub=/?q=` 双向同步。
- **PVP 兑换**：`pvp` 一级分类里包含（现有 RewardsView「挑战赛奖励-兑换奖励」也有一份，暂并存，待定保留哪个）。

### 9.7 副本图鉴 `/dungeons` — `DungeonsView.vue`

- **详情区块**：“特殊掉落”“通关结算掉落”“副本预览掉落”使用 `UiSection` 折叠结构，打开关卡时默认收起；“首次通关奖励”保持直接展示。
- **预览来源**：`showReward` 展示名统一为“副本预览掉落”；奖励池按物品与当前关卡的 `reward`、BOSS 自动掉落链交叉匹配，标注“通关结算”或“BOSS 掉落”，无法由配置证明时显示“预览配置未注明”。禁止仅凭同名物品推断宝箱或采集来源。
- **房间标题**：布局节点的 `room.name` 可能是 `1/2/3`、`A/B`、`start/boss` 等内部布局标记，不作为房间卡片标题展示；页面只展示解析后的实际房间内容名称、等级与隐藏状态。

### 10. 其他 `/rewards` — `RewardsView.vue`

- **数据源**：`parsed/parsed-pvp.json`（挑战赛）、`parsed/parsed-hidden.json`（隐藏物品）、`petSetting`（槽位消耗）。
- **Tab**：挑战赛奖励（兑换/段位/排名/战斗结算）、被隐藏的物品（按大地图分组）、育室槽位消耗（银币/氪金扩建，图标用 `REWARD_MODE_INFO`）、占位奖励。
- **被隐藏的物品点位预览图**：`parsed-hidden.json` 条目带 `prevImg`（`/images/hidden_prev/{点位名}_prev.{png|jpg}`），有图则显示缩略图（`.hidden-prev-img`，点击全屏查看 `.prev-img-overlay`），无图不显示；图片来自 TapTap 帖子《被隐藏的物品点位》（27 张），映射表维护在 `scripts/parse/hidden-rewards.mjs` 使用的 `HIDDEN_PREV_MAP`（roomId → 文件名，见 `src/utils/hiddenRewardsData.js`），重新生成数据不丢失。
- **交互**：物品点击 → `?itemId=` 唤起物品弹窗。
- **URL 参数**：`?id=pvpExchange*/tier/rank/pvpWin/pvpFailure/hidden-*` 定位并高亮对应区块。

---

## 十、详情弹窗与 URL 双向同步规范

满足"外部组件/页面全局唤起详情"统一性，图鉴详情一律走 **URL Query 监听 + 顶层/全局弹窗**，避免路由跳转丢状态。

| 参数 | 含义 | 监听方 | 弹窗 |
| :--- | :--- | :--- | :--- |
| `?itemId=` | 物品详情（全站通用） | `App.vue` watcher | `ItemDetailModal` |
| `?id=` | 角色/魔物/怪物/魔物蛋详情 | 对应视图 | 各视图弹窗/覆盖层 |

**双向同步约定**：
1. 列表点击 → `router.push({ query: { ...route.query, itemId: item.id } })`（或 `id`），**不直接操作弹窗 visible**；跨页面点击物品时不得写死跳转 `/items`，必须保留当前页面路径及已有查询参数；
2. 弹窗关闭 → 必须清除对应 URL 参数（`router.replace`），触发 watcher 自动隐藏；
3. 顶层 watcher（App.vue）统一处理 `itemId`，其他 `id` 由各视图处理；
4. 物品弹窗内部历史栈（`pushItemDetail`/`popItemDetail`）用于"查看上一个"回退。

---

## 十一、数据管线（构建时清洗）

> **目录约定**：`public/data/` 只放**原始表**（游戏导出/精简复制）；一切**处理后生成的表**统一写入 `public/data/parsed/`（`dist/data/parsed/` 同步），源码一律从 `data/parsed/...` 读取，禁止直接读生成物在根目录的旧路径。

- 预处理脚本（统一入口 `node scripts/parse/index.mjs`，即 `npm run data:build`；`npm run build` 自动先执行，全部产物再生成）：
  - [scripts/parse/search.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/search.mjs) → 生成 `parsed/search-index.json`、`parsed/item-sources.json` + `src/types/data-types.d.ts`（内部合并 PVP/隐藏来源）
  - [scripts/parse/pvp.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/pvp.mjs) → `parsed/parsed-pvp.json`、`parsed/parsed-pvp-sources.json`
  - [scripts/parse/hidden-rewards.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/hidden-rewards.mjs)（场景宝箱）→ `parsed/parsed-hidden.json`、`parsed/parsed-hidden-sources.json`；**注意其房间定位数据源是完整版 `room主.json`**（`room.json` 是 check-task-data 裁剪后的精简版，只有 battleData，读不到采集物引用）；条目带 `prevImg` 点位预览图（映射表 `HIDDEN_PREV_MAP`，图片在 `images/hidden_prev/`）
  - [scripts/parse/affixes.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/affixes.mjs) → `parsed/itemAffixes.json`
  - [scripts/parse/exchange.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse/exchange.mjs) → `parsed/parsed-exchange.json`
  - [scripts/parse/items.mjs / tasks.mjs / heroes.mjs / pets.mjs / monsters.mjs / recipes.mjs / achievements.mjs / events.mjs / pet-eggs.mjs / dungeons.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/parse) → 各页面级预解析单文件（items/tasks/heroes/pets/monsters/recipes/achievements/events/pet-eggs/dungeons.json，纯函数与浏览器端共用）
  - [scripts/dev/check-task-data.mjs](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/dev/check-task-data.mjs)（任务图鉴数据维护，开发机手动执行）→ 生成 `parsed/dialogIndex.json`（剧情名称索引）、`parsed/dialogSegments.json`（分段事件索引）+ 同步裁剪 battle/room、复制 taskDialogs。
 - 产物统一在 `public/data/parsed/`：`search-index.json`、`item-sources.json`、`dialogIndex.json`、`dialogSegments.json`、`parsed-pvp.json`、`parsed-pvp-sources.json`、`parsed-hidden.json`、`parsed-hidden-sources.json`、`itemAffixes.json`、`parsed-exchange.json` 及页面级 `items/tasks/heroes/pets/monsters/recipes/achievements/events/pet-eggs/dungeons.json`；副本详情另按关卡生成在 `parsed/dungeons/*.json`。
  - 副本数据链：`instance.json` 的副本入口 → `dungeonBattle.json`（战斗结算/预览/首次通关）与 `dungeonBattleRooms.json`（从解密 `battle.json`、`room.json` 提取的正式房间/随机候选）→ `reward/showReward/firstReward`，或房间 `spObj.caijiTypeId` / 怪物 `caijiTypeId` → `roomCollect.json` 的 `collectTypeId` → `roomCollectType.json` → `reward.json` 奖励组 → `item.json` 图标与名称；禁止跳过 `roomCollect.json` 直接用场景采集对象 ID 查询采集类型。关卡与采集类型的 `consume` 另关联 `consume.json`，页面必须显示其中的实际体力/货币/物品消耗，不得暴露 `consume_battle_d`、`collect_white` 等内部编号。路线图另由解密 `battle.json` 提取为 `dungeonBattleRoutes.json`，保留每个随机布局的 `map.levelRoom` 节点坐标、`map.link` 连线、起点/终点及布局概率。`parsed/dungeons.json` 只保存副本/关卡摘要、搜索词和详情文件引用；路线、房间、怪物、采集与掉落按关卡写入 `parsed/dungeons/{battleId}.json`，点击关卡时按需加载并在会话内缓存，禁止重新把全部详情嵌入索引。详情文件应尽量移除无用重复字段、保持较小体积，但不设置固定大小上限；`npm run verify` 必须报告最大详情文件及大小作为优化提示，不得仅因超过某个体积阻断构建。完整配置中的女神房 `buffGive`、泉水房 `spObjAddBuff` 必须在维护时通过 `npm run data:dungeons:effects` 提取为结构化效果，页面显示全队 Buff 候选或实际恢复比例，不得只显示“女神房/泉水房”名称，也不得暴露内部 Buff ID。具体装备规则 `mode:'equip'` 必须保留装备 ID、品质、装备等级和奖励组概率；`mode:'equipGroup'` 必须按 `equipGroup.showItemTypeId` 和 `qualityGroup` 匹配游戏中的展示物品图标与品质，存在 `showItemTypeId` 时应允许打开对应物品详情。`roomCollect.name` 中的 `3boos大` 等值是内部掉落池名称，不是实际物品，不得作为“可能掉落”展示或参与可见内容搜索。同一房间重复摆放的相同采集实体必须合并为“名称 ×数量”；房间掉落摘要按物品 ID 去重并按品质降序展示。房间 `name` 与 `typeId` 相同或路线节点标为“未命名关卡”时，展示层必须使用实际房间类型兜底，不得暴露内部 ID；场景制作描述 `desc` 不在房间详情展示。多波战斗必须保留 `monRounds` 的逐波怪物与数量，按“第 N 波”展示，不得用跨波合计反推。房间对象的 `layer` 仅为配置布局数组索引，不代表玩家可见的真实楼层，不得在房间标题中展示。配置/战斗名称含“停用”的入口仅在运行期过滤，不删除原始 JSON；“大扫除/回忆/测试”或 ID 为 `sldsd_*` 且未停用的入口归入剧情折叠区；`dungeonD`（蛇腹矿坑）属于主线矿坑与日常元素石采集混合配置，不纳入标准副本卡片；每张副本卡固定显示“剧情”栏，无入口时显示 `0 个 · 展开` 且不可点击；正式副本为 0 的地图/卡片不显示。路线节点点击后只展示配置能证明的怪物、事件、宝箱、采集与掉落，未提供的连接关系不得自行推断。索利德山地两个正式副本的铜箱奖励组和房间均已配置：蔓晶采石场仅 `c2_d1/c2_d1_2` 路线引用铜箱，`c2_d2/c2_d2_d` 未引用；阿娜希塔遗迹仅 `c2_d3/c2_d3_2` 引用铜箱，`c2_d4/c2_d4_d` 未引用。展示层必须遵循每个关卡的实际路线引用，不得把前段铜箱补进后段或噩梦关卡。
- 搜索索引构建来源：hero / item（含碎片名智能映射）/ pet / achievement / menu / buff / mon / fileMon / task / randomEventInfo + randomEventArea / exploreArea / itemExchange / parsed-hidden（覆盖 13 类：角色、物品、装备、魔物、魔物蛋、成就、料理、怪物、任务、事件、探索、兑换、隐藏宝箱）。
  索引维护：`npm run search:update` 仅重建搜索索引/来源/类型文件（几秒）；全量 `npm run data:build`。
  匹配规则（App.vue filteredSearchIndex）：多词查询按空格切词 AND 匹配（每个词都命中 keywords 即命中），排序 精确 > 前缀 > 包含。
- 反向来源表：怪物掉落、成就奖励、任务奖励、配方制作 + 合并 PVP/隐藏来源（隐藏来源依赖完整房间表 `room主.json`）。
- 黑名单在**构建期**即过滤搜索索引与兑换预解析（`isBlacklisted`），运行期列表页再过滤一次。

---

## 十二、热更新与双轨分离架构

### 1. 双轨架构

- **轨道 A（核心代码）**：`dist` 产物（HTML/JS/CSS），走 Capgo Updater 原生持久化热更（zip 增量包）。
- **轨道 B（海量素材）**：图片/大 JSON 走云端 CDN（`getResourceBaseUrl` 劫持），WebView 缓存托管；断网由 `request.js` 降级本地打包资源。

### 2. 发版流程

1. `npm run build`；
2. 将 `dist/` 全部文件（`index.html` 必须位于 zip 第一层根目录）打包为 `dist-{version}.zip`；
3. 上传 CDN，更新云端 `hotupdate.json`：

```json
{
  "version": "1.0.1",
  "downloadUrl": "https://myrzg.yxzmy.top/update/dist-1.0.1.zip",
  "body": "更新说明"
}
```

4. App 启动 `checkHotUpdate()` 比对版本（先查 Gitee APK 大版本，再查小包）→ `UpdateModal` 提示下载。

### 3. 发布前检查清单

发布前逐项确认，全部通过再打热更包：

- [ ] `npm run data:build` 已执行且无报错（parsed 产物为最新）
- [ ] `npm run verify` 通过（产物齐全 + 无旧脚本残留 + build 成功）
- [ ] `grep` 无旧脚本/旧文件残留（clean-data、common.css、*.bak、UI_REFACTOR_GUIDE）
- [ ] `dist/` 含 `data/parsed/` 全部新产物（页面级 + 既有表）
- [ ] 版本号一致：`dist-{version}.zip` 文件名、`hotupdate.json.version`、`downloadUrl` 三处同步
- [ ] 轨道 A/B 双轨齐备：热更 zip（核心代码）+ CDN 素材（图片/大 JSON）
- [ ] 数据管线变更时已同步 `docs/SPEC.md`（数据管线章节）+ `docs/ARCHITECTURE.md`（数据流）

---

## 十三、DRY 红线清单

以下内容**禁止**在页面/解析器内重新定义，必须从对应模块 import：

| 内容 | 唯一来源 |
| :--- | :--- |
| 货币/氪金/经验的名称、图标 ID、图标路径 | `gameMappings.BASE_REWARD_*`、`REWARD_MODE_INFO` |
| 奖励 `rule.mode`（money/randomMoney/ke）展示 | `REWARD_MODE_INFO` |
| 职业/属性（元素）中文名与 slug | `gameMappings.JOB_*`、`ELEMENT_*` |
| 稀有度名称 | `gameMappings.RARITY_NAMES` / `getRarityName` |
| 属性 key 中文名 | `gameMappings.STAT_NAMES` / `translateStatName` |
| 技能名清洗（去 `Lv: N`） | `gameMappings.getCleanSkillName` |
| 技能/效果描述 `{值}` / `<值>` 高亮 | `gameMappings.formatHighlightedText` |
| 对话/邮件文本清洗 | `gameMappings.cleanDialogueBase/cleanDialogueLine/cleanMailContent` |
| 怪物头像规则（avatar→colect） | `gameMappings.getMonsterIcon` + `SKIP_SKINS` |
| 食谱预览清单、通用食材映射、食材组装 | `recipeUtils.PREVIEW_AVAILABLE_IDS / GENERIC_FOOD_TYPE_MAP / buildRecipeIngredients` |
| 物品/分类/奖励解析与缓存 | `itemParser` 各导出 |
| 全局黑名单 | `blacklist.isBlacklisted` |
| 图片/资源路径 | `env.getImageUrl` |
| JSON 数据获取 | `request.fetchWithFallback` |
| 弹窗骨架 | `BaseModal` |
| 全局搜索框 | `GlobalSearchBox` |
| 回到顶部 | `UiBackToTop`（`src/components/ui/UiBackToTop.vue`） |

**新增代码检查清单**：先用 `grep` 确认 gameMappings / recipeUtils / itemParser 是否已有同功能；有了就复用，没有才新增到对应模块（而不是页面里）。凡新增全局映射，一律放进 `gameMappings.js` 并在此文档补一行。

---

## 十四、文档维护约定

> 目的：保证文档与代码现状一致，同时避免连续微调产生大量低价值文档。开发记录按“连续任务批次”维护，同一天、同一功能的一组修改合并到一份日志，在阶段完成、提交或发布前统一补全。

| 操作类型 | 必须更新的 md |
| :--- | :--- |
| 代码/数据/配置形成可交付批次 | [docs/dev-logs](file:///e:/Desktop/html/myrzg/vue-myrzg/docs/dev-logs)（同一天、同一功能复用一份 `YYYY-MM-DD_任务主题.md`，格式见 [docs/dev-logs/README.md](file:///e:/Desktop/html/myrzg/vue-myrzg/docs/dev-logs/README.md)） |
| 路由 / 页面结构 / 通用规范变更 | `docs/SPEC.md`（总规范） |
| 目录结构 / 分层 / 数据流 / 构建链变更 | `docs/ARCHITECTURE.md` |
| UI 组件库 / 设计系统 / 页面骨架变更 | `docs/UI_COMPONENT_LIBRARY.md` |
| 数据管线（预处理脚本 / parsed 产物）变更 | `docs/SPEC.md`（「数据管线」章节）+ `docs/ARCHITECTURE.md`（数据流） |

**自检规则**：无需在每次小调整后立即写日志；在连续任务阶段完成、提交或发布前，运行 `npm run verify`（产物齐全 + 旧脚本残留 + build），集中更新批次日志及受影响的权威文档，并在 dev-log「文档同步动作」标记结果。
