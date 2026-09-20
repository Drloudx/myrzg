# 项目架构说明（深歌小助手 / vue-myrzg）

> 本文档描述 `vue-myrzg` 项目的整体架构、目录职责、数据流与 UI 设计体系。
> UI 组件库使用规则见 [docs/UI_COMPONENT_LIBRARY.md](./UI_COMPONENT_LIBRARY.md)。

## 1. 项目概览

- **项目名称**：深歌小助手（深渊之歌 Wiki 工具）
- **技术栈**：Vue 3（Composition API + `<script setup>`）、Vite、Pinia（persistedstate）、Vue Router（hash 模式）、Capacitor（Android 原生壳）
- **形态**：Web 单页应用 + Android App（Capacitor 打包）
- **数据来源**：仓库根 `raw/` 下的构建期原始表，由 `scripts/parse/index.mjs`（一键数据入口）生成 `public/data/parsed/` 运行时派生数据；`public/data/` 根目录只保留公告等少数 App 内容

## 2. 目录结构

```
vue-myrzg/
├── index.html                  # 入口 HTML（挂载 #app）
├── vite.config.js
├── playwright.config.js       # 浏览器交互回归测试配置（独立 4174 端口）
├── capacitor.config.json       # Capacitor 原生壳配置
├── public/                     # 静态资源
│   ├── data/                   # 运行时静态 JSON
│   │   ├── notice.json         # 公告等少数 App 内容
│   │   └── parsed/             # 构建时生成的派生数据（search-index、item-sources 等）
│   ├── images/                 # 游戏图片资源（图鉴立绘/图标）
│   ├── ui/                     # UI 图标、logo、地图背景 map_w1_bg.png
│   └── fonts/                  # 本地字体（HarmonyOS Sans）
├── scripts/
│   ├── parse/                   # 一键数据预处理（npm run data:build / build 自动执行）
│   │   ├── index.mjs            # 统一入口（遗留表 + 页面级预解析）
│   │   └── *.mjs                # pvp/hidden/search/affixes/exchange + 页面级域脚本
│   └── dev/                     # 原表预览/显式同步、派生输入提取、verify 验收（路径基于脚本位置）
├── raw/                         # 构建期原始游戏表（不进 dist，readJson 优先读取）
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 本文档
│   ├── UI_COMPONENT_LIBRARY.md # UI 组件库规则
│   └── dev-logs/               # YYYY-MM/YYYY-MM-DD.md，每天一份模块化汇总
├── tests/ui/                   # Playwright 桌面/移动端交互回归测试
└── src/
    ├── main.js                 # 应用入口：挂载 Pinia/Router/theme.css
    ├── App.vue                 # 应用外壳：顶栏/侧边导航/路由出口/全局弹窗
    ├── assets/
    │   └── theme.css           # ★ 羊皮纸主题设计系统（CSS 变量/品质色/全局类）
    ├── router/
    │   └── index.js            # 业务页面路由 + 根路径重定向（hash 模式，懒加载）
    ├── stores/
    │   └── appState.js         # Pinia：成就与隐藏物品收集标记（localStorage 持久化）
    ├── config/
    │   └── blacklist.js        # 黑名单（剧透屏蔽等）
    ├── composables/
    │   └── app/                # App 外壳职责：搜索、原生生命周期、备份导入导出
    ├── utils/                  # 业务工具层（纯逻辑，与 UI 无关）
    │   ├── env.js              # 环境/资源路径（CDN、getImageUrl）
    │   ├── request.js          # fetchWithFallback（多路径回退）
    │   ├── scrollTarget.js     # 桌面父级/移动端页面滚动目标统一解析
    │   ├── itemParser.js       # 物品数据解析（装备属性/符石/套装/奖励）
    │   ├── furnitureData.js    # 家具、外观、制作消耗与图纸关系解析
    │   ├── roomDisplay.js      # 房间波次/采集/奖励池的展示整形（副本与关卡图鉴共用）
    │   ├── levelConfig.js      # 玩家等级表边界解析（角色/魔物共用）
    │   ├── monsterParser.js    # 怪物数据解析
    │   ├── heroParser.js       # 角色数据解析
    │   ├── petParser.js        # 魔物数据解析
    │   ├── taskParser.js       # 任务数据解析
    │   ├── recipeUtils.js      # 菜谱/配方工具
    │   ├── gameMappings.js     # 品质色、属性名翻译、文本高亮
    │   ├── itemModalState.js   # 物品详情弹窗栈（push/pop）
    │   ├── overlayStack.js     # 全局覆盖层顺序与关闭动作
    │   ├── globalModalLock.js  # 全局弹窗背景锁（多 owner）
    │   ├── nativeBackHandler.js # 原生返回监听临时注册与销毁
    │   └── hotupdate.js        # 热更新检查/应用
    ├── types/
    │   └── data-types.d.ts     # 构建生成的类型定义
    ├── components/             # 组件层
    │   ├── ui/                 # ★ UI 组件库（羊皮纸设计系统组件，见组件库文档）
    │   │   ├── index.js        # 统一出口
    │   │   └── Ui*.vue         # 20+ 通用组件
    │   ├── heroes/
    │   │   └── HeroStoryPanels.vue # 角色档案、互动页签和对话按需加载
    │   ├── gacha/              # 模拟招募业务皮肤（游戏原素材，不进通用 UI 出口）
    │   │   ├── GachaStage.vue      # 1534×750 设计画布与等比缩放
    │   │   ├── GachaPoolPanel.vue  # 卡池列表页（HeroPoolPanel 还原）
    │   │   ├── GachaTipPanel.vue   # 概率详情 / 记录查询弹层
    │   │   ├── GachaCardPanel.vue  # 角色池翻卡演出（HeroGachaAniPanel）
    │   │   ├── GachaPetPanel.vue   # 魔物蛋池出蛋演出（PetGachaAniPanel）
    │   │   ├── GachaRevealPanel.vue# 角色揭晓三段式（HeroGachaShowPanel）
    │   │   ├── GachaResultPanel.vue# 角色结果一览（HeroShowPanel/HeroShowItem）
    │   │   └── GachaPetResult.vue  # 蛋池结算弹层（GetRewardTip）
    │   ├── dungeons/
    │   │   └── DungeonRouteMap.vue # 路线布局、缩放、拖动和节点选择
    │   ├── chapters/
    │   │   └── ChapterMapCanvas.vue # 章节世界地图：底图 + 拼块渲染与归属图命中
    │   ├── FurnitureCard.vue    # 家具图鉴卡片（BuildItem UI 图与图纸状态）
    │   ├── RoomContentList.vue  # 房间内容与掉落（副本/关卡图鉴共用）
    │   ├── RewardPools.vue      # 奖励池列表与概率文案（副本/关卡图鉴共用）
    │   ├── App 外壳组件        # NavigationMenu（默认完整）/ NavigationMenuLite（上传备用精简）等
    │   ├── 弹窗组件             # AboutModal / NoticeModal / MenuModeModal /
    │   │                       #   VersionCheckModal / UpdateModal
    │   └── 详情弹窗             # ItemDetailModal / MonsterDetailModal（全屏详情）
    └── views/                  # 页面视图（路由组件）
        ├── ItemsView.vue       # 物品图鉴  /items
        ├── FurnitureView.vue   # 家具图鉴  /furniture
        ├── FacilitiesView.vue  # 设施功能  /facilities
        ├── HeroesView.vue      # 角色图鉴  /heroes
        ├── PartnerMailsView.vue # 伙伴邮件  /partner-mails
        ├── PetsView.vue        # 魔物图鉴  /pets
        ├── EquipsView.vue      # 装备图鉴  /equip
        ├── RunesView.vue       # 符石图鉴  /runes
        ├── RecipesView.vue     # 菜谱查询  /recipes
        ├── PetsEggsView.vue    # 魔物收益  /petseggs
        ├── AchievementView.vue # 成就查询  /achievement
        ├── MonstersView.vue    # 怪物图鉴  /monsters
        ├── TasksView.vue       # 任务图鉴  /tasks
        ├── EventsView.vue      # 事件图鉴  /events
        ├── DungeonsView.vue    # 副本图鉴  /dungeons
        ├── ChaptersView.vue    # 关卡图鉴  /chapters
        ├── GachaView.vue       # 模拟招募  /gacha
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
- 家具、角色、魔物、怪物详情使用 `id`；任务使用 `task`，事件使用 `event`/`explore`，副本使用 `battle`。家具详情中的图纸或材料可叠加全局 `itemId`，物品图纸详情也可按精确外键跳转 `/furniture?id=`；各视图同步打开/关闭及清理自身参数，不覆盖其他筛选条件。

### 4.2 弹窗栈
`utils/itemModalState.js` 维护物品详情弹窗栈（`pushItemDetail`/`popItemDetail`），
支持"详情里点详情"层层打开、逐层返回。

桌面列表以 `.app-container` 为页面级滚动根，顶栏固定、左右栏 sticky。详情采用绝对覆盖与正文内部滚动；打开前捕获原列表位置，`modalScrollCoordinator` 的首个 owner 保留基线，只有最后一个 owner 关闭才恢复。普通内嵌详情关闭时直接移除，不等待离场动画；路由切换先清空协调器。物品嵌套历史同时保存 `bodyScrollTop`，返回上一件物品时恢复正文位置。移动端继续使用页面内部滚动。

`useOverlay` / `overlayStack` 统一登记可关闭覆盖层及优先级，`UiModal` 自动接入。系统更新、公告与全屏图片预览复用 Teleport 弹窗，`globalModalLock` 以多 owner 锁定背景滚动及交互，最后一个全局弹窗关闭后才释放；窗口按视口与安全区限高，正文滚动、关闭入口与底栏始终可触达。禁止业务页面重新手写低层级全屏遮罩。

### 4.3 数据流

构建期读取 `raw/` 及同级解密资源，生成 `public/data/parsed/`；运行时页面通过 `fetchWithFallback` 读取同版本派生产物。页面级解析、来源索引、专题模块和资源生命周期分别由对应 parser、专题文档与共享工具负责。吉祥物装配与动作细节见 [右栏吉祥物专题](features/SIDEBAR_MASCOT.md)，邮件、副本和招募边界见各自专题，不在架构层重复维护。

奖励公共底层为 `acquisitionRules.js`（无网络、缓存或组件依赖），`gameMappings` 重导出旧映射及摘要解析接口。物品构建器在完成名称和图标关联后生成 `item.acquisition`；`ItemDetailModal → AcquisitionRewards → UiRewardCard` 共用消耗、奖励池和概率展示，物品、装备与符石图鉴不再各自解析使用动作。锻造装备候选与普通设施产出也调用该底层。正式来源入口判断、抽奖保底与重复转换各归其业务模块，不进入通用奖励解析。接口详见 [ACQUISITION_RULES.md](technical/ACQUISITION_RULES.md)。

1. **构建**：`scripts/parse/index.mjs` 调用 `scripts/parse/*`，优先读取 `raw/`，生成 `public/data/parsed/`。业务纯函数位于 `utils/*Parser.js` / `*Data.js`；字段语义和可见性见 SPEC 与功能专题。输入不齐时沿用产物的条件见 [构建前置](../README.md#构建前置与原表维护)。
2. **运行时**：视图通过 `fetchWithFallback` 读取同版本产物；云端失败只回退包内同路径文件。副本按关卡请求详情，怪物详情另取等级系数小表；页面不重新关联原表，解析失败显示错误态。
3. **来源**：`searchData` 合并正式玩法入口、`supplementalItemSources`、`remainingItemSources` 和专题来源，实际产物筛选复用 `acquisitionRules`。完整构建传入本次副本来源；独立搜索构建重算副本来源并读取已有 PVP/隐藏产物。只保存展示与定位实际消费的字段，无法确认的来源留在内部记录。
4. **原表维护**：`sync-raw.mjs` 默认预览，`--apply` 补缺，`--apply --replace` 才刷新原表及兼容别名。`mon.json` 字段与头像只在 `shared.mjs` 内存归一化；副本提取输入和塔层索引不覆盖完整原表，任务维护不得裁剪写回 `battle/room`。

### 4.4 视图职责边界

- `App.vue` 按视口与环境懒加载 `SidebarMascot.vue`；角色配置、SVG 加载缓存与动作编排分别由共享配置和工具负责，选择层复用 `UiPopover`。详见 [右栏吉祥物](features/SIDEBAR_MASCOT.md)。

- 皮肤小人导出入口：`npm run skins:export`；环境准备、命令与更新步骤见 [皮肤模型导出说明](technical/SKIN_MODEL_EXPORT.md)。

- 皮肤模型导出为离线工具；构建期核对图片清单并写入 `skinUnlock.modelImage` / `skins[].modelImage`。运行时只加载静态 PNG，普通构建不重新渲染模型。

- 时装与积分/氪金商店统一归 `shop`，入口顺序来自 `packDisplay` 的可见 `packType=2/5` 配置；共享 `buildOfficialExchangeIndex/getExchangeSourceMeta` 同步更新搜索与物品来源链接。兑换构建额外读取 `skin.json` 和 `hero/hero.json`，按 `shop.skins.heroSkin → skin.heroTypeId` 生成角色名、皮肤名、品质与专用商店封面；价格仍由 consume 原表解析。`UiExchangeTrade.skin` 消费这些字段，页面不关联原表，也不模拟账号拥有状态；旧 fashion 查询转入 shop/fuZhuang。

- `FacilitiesView.vue` 负责设施配方与营地页签和 URL 状态；`components/facilities/CampFacilitiesPanel.vue` 消费同一 `parsed/facilities.json` 的 `key:camp` 对象，展示建筑与研究。构建期由 `campFacilityData.js` 关联 `homeLevel/campResearch/roomBuild/consume/condition/task/reward/item/homeItem`，运行时不加载原表。资源校验允许原配方与营地两种对象结构。升级的来源等级与目标等级分开保存，详情跳转只追加 `itemId`，具体协议见 [CAMP_FACILITIES.md](features/facilities/CAMP_FACILITIES.md)。

- `GachaView.vue` 协调卡池、模拟状态和演出阶段；`components/gacha/` 按卡池、翻卡、揭晓和两类结算分工。`gachaSim.js` 管规则，`gachaState.js` 管本地持久化，舞台、Spine 与音频由共享工具管理。详细边界见 [模拟招募专题](features/gacha/GACHA.md)。
- `PartnerMailsView.vue` 管筛选与选择，`PartnerMailReader.vue` 管阅读器；`heroParser → partnerMailData` 在构建期生成 `heroes.json.mailboxes`，正文清洗和奖励规则复用公共模块。数据、皮肤与滚动约定见 [伙伴邮件专题](features/PARTNER_MAIL_SKIN.md)。

- `App.vue` 只负责页面外壳、路由出口和全局弹窗装配；全局搜索、原生主题/返回键生命周期、备份导入导出分别由 `composables/app/useGlobalSearch.js`、`useNativeShell.js`、`useBackupData.js` 管理。
- `HeroesView.vue` 管理角色列表、详情状态、技能与属性计算；档案、互动页签、对话缓存归 `HeroStoryPanels.vue`，不得重新复制回页面。
- `DungeonsView.vue` 管理副本筛选、关卡详情、房间详情和掉落；路线图的布局投影、缩放、鼠标/触摸拖动、节点聚合归 `DungeonRouteMap.vue`。数据与来源定位见 [副本图鉴](features/DUNGEONS.md)。
- `ChaptersView.vue` 管理章节筛选、关卡列表与关卡详情；章节归属、三难度与解锁文案来自构建期 `chapters.json` / `stages/{stageId}.json`，房间与掉落展示复用 `RoomContentList.vue`、`RewardPools.vue`，不复制副本页的解析与样式。顶部的世界地图归 `components/chapters/ChapterMapCanvas.vue`：拼块矩形与命中归属图都由构建期产物提供（坐标由模板匹配测得），页面不自己算坐标。
- `FurnitureView.vue` 管理家具筛选、详情及 `id/itemId` 联动；`FurnitureCard.vue` 只负责稳定卡片视觉，不解析原表或猜测图纸关系。

### 4.5 移动端/原生适配
- 安全区变量：`--safe-top/bottom/left/right`（theme.css 定义）。
- `useNativeShell` 仅在覆盖层、菜单或搜索打开时临时注册原生 `backButton`，只消费最上层关闭动作；没有这些界面时注销监听，保留 WebView 原生历史返回。不得额外添加按 `/recipes` 强制退出的规则；无需改动 Activity 返回逻辑。
- `nativeBackHandler` 串行协调异步监听的注册与移除，覆盖快速开关、注册期间关闭和卸载场景；更新下载等不可关闭状态消费返回而不误操作下层页面。
- 菜单模式三态：`side`（侧边栏）/`bottom`（底部抽屉）/`top`（顶部下拉），存 localStorage。

### 4.6 主题切换
- 亮色 = 羊皮纸；暗色 = 暗木羊皮卷。
- `document.documentElement.classList.toggle('dark-mode')`（App.vue），
  所有颜色走 theme.css 变量，组件无需感知。

### 4.7 资源版本与容错

- 构建根据运行时 JSON 生成按目录分组、文件名带 hash 的清单，位于 `dist/assets/data-manifests/`。代码中包含清单路径与 SHA-256；首次访问该组才读包内清单，避免首屏拉全量目录。
- 原生 JSON 请求先核对清单，再校验 CDN 内容 hash；超时、HTTP、格式或版本不匹配时回退同版本包内路径，并再次校验。Web 正式部署需要 HTTPS 提供 WebCrypto；同域版本冲突显式报错，不展示混用数据。公告 `notice.json` 保持实时更新，不纳入游戏表版本锁。
- 同一路径的进行中请求合并，成功数据按会话复用，失败条目移除以便重试；图片使用构建版本参数及有限的“CDN → 包内 → 默认图”回退，不无限重试坏链接。家具是语义敏感例外：卡片/详情/外观只引用 `BuildItem_Atlas` UI 图，缺图统一进入默认占位，不能拿基础家具图或 `roomObj.viewData[].img` 场景立绘代替具体皮肤。
- 热更新以 `CapacitorUpdater.current()` 实际运行 bundle 为准，`local_web_version` 只用于兼容显示，在 ready 确认后同步。下载或切换前不得提前宣称新版已生效；回滚后重新读取实际 bundle。

### 4.8 长列表与封面加载

- 物品、家具、任务页面直接按需导入 `UiVirtualGrid.vue`，复用 `UiCardGrid` 外壳并由 `@tanstack/vue-virtual` 按 CSS 列数分行、动态测高。总高度占位保留，仅挂载可见行及前后 3 行，避免越滚 DOM 越多。
- 桌面始终以 `.app-container` 为 owner，手机使用内部列表；详情临时锁视口不更换 owner。定位通过 `scrollToItem`，普通关闭保留原位置，冷分享链接才补目标锚点。原 `useLazyList` 仍是小列表追加分页，不是虚拟化。
- 副本封面通过局部 `vLazyCover` 的 IntersectionObserver 在近视口才赋 `src`，配合 lazy/async 与固定图像尺寸占位；此流程不重编码图片文件。

## 5. 构建与运行


完整数据再生成需要本机原表、副本提取输入及剧情资源；当前缺原表时沿用产物的条件、环境变量与同步命令统一见 [README 构建前置](../README.md#构建前置与原表维护)。

日常命令统一见 [项目 README](../README.md#常用命令)。发布按以下顺序：

1. 在原表/派生输入完整的环境运行 `npm run verify`，确认数据再生成与生产构建成功；缺原表的前端构建沿用产物，不等同完整数据验收。
2. 检查 `dist/data`、`dist/images` 和 `assets/data-manifests` 齐全；HTML/JS/CSS、图片、JSON 与清单来自同次构建。上传完整产物，缓存过渡期保留旧 hash 的 assets，不运行旧的 dist 删除策略。
3. Android 同步使用 `npx cap sync android`；热更将完整 dist 打成 zip，`index.html` 在 zip 根层。云端 `update/hotupdate.json` 的 `version/downloadUrl/body` 分别为版本、zip 地址、说明，版本与文件名/下载地址同步。
4. 原生先检查 Gitee APK 大版本，再检查热更小包；下载监听在失败或切换前释放，`CapacitorUpdater.current()` 的实际运行版本在 ready 后同步到兼容显示键，不能提前写入待更新版本。

Web 正式部署用 HTTPS；包内数据与图片必须保留以支持离线回退。图片压缩不属于构建或发布自动步骤，授权与备份要求见 [资源维护](SPEC.md#六资源维护)。
## 6. UI 设计体系概览（详见 UI_COMPONENT_LIBRARY.md）

公共组件、字体、调色板和游戏皮肤例外见 [UI 组件库](UI_COMPONENT_LIBRARY.md)。资源来源、命名与压缩授权只在 [SPEC 资源维护](SPEC.md#六资源维护) 定义；审计结果保留执行日期，不宣称资源永远“已去重完毕”。

## 7. Git 提交与推送约定

提交格式、验收和日报要求见 [项目 README](../README.md#git-提交规范)。

- 修改前检查工作区，保留已有改动；大规模重构或资源替换前先建立可恢复的存档点。不能把无关改动混入本次提交。
- 每次提交对应一个明确主题，代码与重新生成的数据可分开提交；临时文件不进入提交，`dist/` 由完整构建和发布流程生成。
- 资源压缩或替换前仍需按 [SPEC 资源备份约定](SPEC.md#六资源维护) 核对原图备份，Git 不能恢复从未保存的文件。
- 本地提交与推送分开处理；推送前按改动范围完成验收。历史改写、强推和冲突处理需检查实际分支及变更，不把覆盖本地或远程内容作为默认方案。
