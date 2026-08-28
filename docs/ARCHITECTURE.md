# 项目架构说明（深歌小助手 / vue-myrzg）

> 本文档描述 `vue-myrzg` 项目的整体架构、目录职责、数据流与 UI 设计体系。
> UI 组件库使用规则见 [docs/UI_COMPONENT_LIBRARY.md](./UI_COMPONENT_LIBRARY.md)。

## 1. 项目概览

- **项目名称**：深歌小助手（深渊之歌 Wiki 工具）
- **技术栈**：Vue 3（Composition API + `<script setup>`）、Vite、Pinia（persistedstate）、Vue Router（hash 模式）、Capacitor（Android 原生壳）
- **形态**：Web 单页应用 + Android App（Capacitor 打包）
- **数据来源**：`public/data/` 下静态 JSON（原始表 + `parsed/` 预处理表），由构建脚本 `scripts/parse/index.mjs`（一键数据入口）生成派生数据

## 2. 目录结构

```
vue-myrzg/
├── index.html                  # 入口 HTML（挂载 #app）
├── vite.config.js
├── capacitor.config.json       # Capacitor 原生壳配置
├── public/                     # 静态资源
│   ├── data/                   # 原始游戏数据 JSON
│   │   ├── hero/ equip/ pet/ task/ ...   # 各类原始表
│   │   └── parsed/             # 构建时生成的派生数据（search-index、item-sources 等）
│   ├── images/                 # 游戏图片资源（图鉴立绘/图标）
│   ├── ui/                     # UI 图标、logo、地图背景 map_w1_bg.png
│   └── fonts/                  # 本地字体（HarmonyOS Sans）
├── scripts/
│   ├── parse/                   # 一键数据预处理（npm run data:build / build 自动执行）
│   │   ├── index.mjs            # 统一入口（遗留表 + 页面级预解析）
│   │   └── *.mjs                # pvp/hidden/search/affixes/exchange + 页面级域脚本
│   └── dev/                     # 开发机工具：check-task-data.mjs（数据同步）、verify.mjs（npm run verify 验收）
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 本文档
│   ├── UI_COMPONENT_LIBRARY.md # UI 组件库规则
│   └── dev-logs/               # 开发记录（同日同功能按批次合并）
└── src/
    ├── main.js                 # 应用入口：挂载 Pinia/Router/theme.css
    ├── App.vue                 # 应用外壳：顶栏/侧边导航/路由出口/全局弹窗
    ├── assets/
    │   └── theme.css           # ★ 羊皮纸主题设计系统（CSS 变量/品质色/全局类）
    ├── router/
    │   └── index.js            # 12 条路由（hash 模式，懒加载）
    ├── stores/
    │   └── appState.js         # Pinia：成就收集状态（localStorage 持久化）
    ├── config/
    │   └── blacklist.js        # 黑名单（剧透屏蔽等）
    ├── utils/                  # 业务工具层（纯逻辑，与 UI 无关）
    │   ├── env.js              # 环境/资源路径（CDN、getImageUrl）
    │   ├── request.js          # fetchWithFallback（多路径回退）
    │   ├── itemParser.js       # 物品数据解析（装备属性/符石/套装/奖励）
    │   ├── monsterParser.js    # 怪物数据解析
    │   ├── heroParser.js       # 角色数据解析
    │   ├── petParser.js        # 魔物数据解析
    │   ├── taskParser.js       # 任务数据解析
    │   ├── recipeUtils.js      # 菜谱/配方工具
    │   ├── gameMappings.js     # 品质色、属性名翻译、文本高亮
    │   ├── itemModalState.js   # 物品详情弹窗栈（push/pop）
    │   └── hotupdate.js        # 热更新检查/应用
    ├── types/
    │   └── data-types.d.ts     # 构建生成的类型定义
    ├── components/             # 组件层
    │   ├── ui/                 # ★ UI 组件库（羊皮纸设计系统组件，见组件库文档）
    │   │   ├── index.js        # 统一出口
    │   │   └── Ui*.vue         # 20+ 通用组件
    │   ├── App 外壳组件        # NavigationMenu / GlobalSearchBox / BackToTop 等
    │   ├── 弹窗组件             # BaseModal / AboutModal / NoticeModal / MenuModeModal /
    │   │                       #   VersionCheckModal / UpdateModal
    │   └── 详情弹窗             # ItemDetailModal / MonsterDetailModal（全屏详情）
    └── views/                  # 13 个页面视图（路由组件）
        ├── ItemsView.vue       # 物品图鉴  /items
        ├── HeroesView.vue      # 角色图鉴  /heroes
        ├── PetsView.vue        # 魔物图鉴  /pets
        ├── EquipsView.vue      # 装备图鉴  /equip
        ├── RecipesView.vue     # 菜谱查询  /recipes
        ├── PetsEggsView.vue    # 魔物收益  /petseggs
        ├── AchievementView.vue # 成就查询  /achievement
        ├── MonstersView.vue    # 怪物图鉴  /monsters
        ├── TasksView.vue       # 任务图鉴  /tasks
        ├── EventsView.vue      # 事件图鉴  /events
        ├── DungeonsView.vue    # 副本图鉴  /dungeons
        ├── ExchangeView.vue    # 兑换      /exchange
        └── RewardsView.vue     # 其他      /rewards
```

## 3. 分层架构

```
┌─────────────────────────────────────────────────┐
│ App.vue（外壳）                                   │
│  ├─ 顶部木质导航条（logo/标题/全局搜索/设置菜单）    │
│  ├─ NavigationMenu（桌面侧边栏 / 移动端三种模式）   │
│  ├─ <router-view>（视图出口）                      │
│  └─ 全局弹窗：ItemDetailModal、更新/公告/版本/关于   │
├─────────────────────────────────────────────────┤
│ views/（页面层）                                   │
│  每个视图 = 检索筛选区 + 数据网格 + 详情弹窗         │
│  只关心业务：数据加载、过滤、路由跳转               │
├─────────────────────────────────────────────────┤
│ components/ui/（UI 组件库）← 所有视觉从这里引用     │
│  UiModal/UiSection/UiCardGrid/UiItemCard/...      │
├─────────────────────────────────────────────────┤
│ assets/theme.css（设计系统）                       │
│  羊皮纸变量、品质色、字体、全局工具类               │
├─────────────────────────────────────────────────┤
│ utils/（业务工具，纯逻辑）                         │
│  parser/映射/请求/状态                             │
├─────────────────────────────────────────────────┤
│ public/data + scripts/parse/（数据层）           │
└─────────────────────────────────────────────────┘
```

**依赖方向（单向）**：
`views → components/ui → theme.css`；`views → utils → public/data`。
禁止反向依赖；utils 不得 import 组件。

## 4. 关键机制

### 4.1 路由与详情唤起
- hash 路由：`/#/items?itemId=xxx` 形式。
- 物品详情：`App.vue` watch `route.query.itemId`，全局拉起 `ItemDetailModal`（跨页面可用）；兑换、任务、事件等页面点击物品只追加当前路由的 `itemId`，关闭后保留原页面及其详情/筛选查询参数。
- 怪物/角色/任务等详情：各视图自行 watch `route.query.id` 打开对应详情弹窗。

### 4.2 弹窗栈
`utils/itemModalState.js` 维护物品详情弹窗栈（`pushItemDetail`/`popItemDetail`），
支持"详情里点详情"层层打开、逐层返回。

### 4.3 数据流
1. 构建时 `npm run build` → `scripts/parse/index.mjs`（一键数据入口）读取 `public/data/` 原始表，
   生成 `public/data/parsed/*.json`（全局搜索索引、物品来源反查表、页面级预解析文件等）；副本页额外读取 `instance.json`、提取版 `dungeonBattle.json`、`dungeonBattleRooms.json`、`dungeonBattleRoutes.json`、`reward.json`、`consume.json`、`roomCollect.json`、`roomCollectType.json`、`mon.json` 与 `item.json`，生成轻量 `parsed/dungeons.json` 索引及按关卡拆分的 `parsed/dungeons/{battleId}.json` 详情。详情文件继续按关卡拆分、按需加载并尽量去除重复字段，但不设置固定体积上限；验收脚本报告当前最大文件及大小，供后续优化；
   纯函数位于 `src/utils/*.js`（`taskParser` 等），浏览器与构建脚本共用。
2. 运行时视图通过 `utils/request.js` 的 `fetchWithFallback` 拉取 JSON（多路径回退，
   原生端可走 CDN）。副本页首次只加载摘要索引，搜索使用构建时生成的去重关键词；用户打开关卡后才请求对应详情，并在当前会话缓存已加载详情。云端请求失败时仍由 `fetchWithFallback` 读取热更包内同路径的拆分产物，不在手机端重新组合原始表。
   兑换页预解析模型只读取 `itemExchange.json`，并过滤其中没有正式游戏 UI 入口的 `baodimap1~5` / `baodimap1_1~5_1` 固定品质记录；原始配置仍保留作为资料。锻造台由 `ProducePanel → SmithPanelUI` 独立读取 `itemExchangeRandom.json`，两条数据流不混用。
3. 解析逻辑集中在 `utils/*Parser.js` / `*Data.js`，视图只消费解析结果。

### 4.4 移动端/原生适配
- 安全区变量：`--safe-top/bottom/left/right`（theme.css 定义）。
- `Capacitor`：原生返回键处理（App.vue）、状态栏同步、导出/分享、热更新（hotupdate.js）。
- 菜单模式三态：`side`（侧边栏）/`bottom`（底部抽屉）/`top`（顶部下拉），存 localStorage。

### 4.5 主题切换
- 亮色 = 羊皮纸；暗色 = 暗木羊皮卷。
- `document.documentElement.classList.toggle('dark-mode')`（App.vue），
  所有颜色走 theme.css 变量，组件无需感知。

## 5. 构建与运行

```bash
npm run dev          # 开发（vite）
npm run build        # 数据预处理 + 生产构建
npm run preview      # 预览产物
npx cap sync android # 同步 Android 原生壳
```

## 6. UI 设计体系概览（详见 UI_COMPONENT_LIBRARY.md）

- **主题**：羊皮纸 Wiki（源自 `ui模板.html` 调色板：深木 #2b1f15、羊皮纸 #dfceb3、
  墨水 #3e2a14、描边 #8f7351、湖青 #7a9a99）。
- **字体**：标题 Cinzel + Noto Serif SC；正文 Noto Serif SC 回落到宋体/Georgia，保证可读性。
- **组件**：全部从 `src/components/ui/` 引用，页面不得复制基础样式。
- **地图背景**：`/ui/map_w1_bg.png` 全站铺底，面板为半透明羊皮纸。
