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
    │   └── appState.js         # Pinia：成就收集状态（localStorage 持久化）
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
    │   ├── FurnitureCard.vue    # 家具图鉴卡片（BuildItem UI 图与图纸状态）
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

34 名吉祥物在主插画和选择预览中共用 320×400 画布。`MASCOTS.groundX` 记录非关节素材的身体落脚中心，`loadMascotArtwork` 验证仓库 SVG 后加平移分组，将原 (groundX,337) 对齐到公共 (162,369)，并缓存装配结果；原有局部坐标和动画轴保留，不复制角色素材。关节模型直接使用同一画布。菲莉娜的原 SVG 将身体居中，尾羽向下收拢并将旋转固化到路径，避免嵌套旋转的宽松包围框越界；她的 `groundX` 已计入素材内平移。

`MASCOTS.standingHeight` 保存待机第 0 帧的可见身高，`getMascotScale` 统一计算 `312 / standingHeight`。非关节素材在同一装配分组内以落脚点为原点等比例缩放；`MascotScene` 在人物及道具外增加固定比例分组，所有场景和预览复用。角色不按实时姿势改比例，无逐帧尺寸测量；局部动画轴、肢体关系及道具轨迹保留。

关节吉祥物由 `components/mascot/MascotScene.vue` 装配道具、`MascotFigure.vue` 装配角色、`mascotParts.js` 提取仓库内 SVG 语义分组。`mascotModels.js` 与 `mascotRedrawnModels.js`、`mascotRedrawnBatch3/4/5.js` 为全部 34 名角色定义肩点、臂长、托腮握点、配色、袖口/手型/腿部变体及随身物件；全部模型共用 `MascotArm` / `MascotLeg` 和场景坐标，不复制整套动作。原 SVG 通过 `?raw` 导入纳入 Vite 更新追踪；其余 27 名已改为人工曲线路径及语义分件，通过相同四肢组件装配四动作；原整图变换的 generic 分支已删除。关节角色选择预览也复用对应模型并禁用动画，切换角色按编号重建场景、取消旧片段，保留支持的动作偏好。

`useMascotSequence.js` 以 Web Animations API 执行有限关键帧，负责暂停、恢复和卸载取消；`useMascotChoreography.js` 统一调度思考、秋千和钓鱼完整进出场。`mascotRig.js` 在片段开始时按角色关节计算插值，`hilFishingMotion.js` 共用道具路径并按当前模型计算握竿位置，无逐帧 JavaScript。`HilFishingProps.vue` 分离道具前后遮挡层，`hil.css` 的动作选择器已按关节模型能力生效。模型的随身物件也通过同一片段系统变化；迦南佩剑保持整件连续几何，披风在坐下时收短，站起恢复。米托拉用 `wrap` 袖口与 `mitora` 腿部变体保留服饰；062 园艺手套/靴子与菜篮、053 灯杖/长袍、034 毛边袖口/法杖/披风、049 尾羽/箭筒/爪靴均保留独立装饰与坐姿配置；`artOffset` 将原素材对齐公共模型坐标，`rig-satchel` / `rig-skirt` 支持坐姿收拢。露帕法杖固定旋转固化到路径，仅保留小幅姿态变化，避免嵌套旋转扩大包围框。通用 `.rig-hair-left/right` 内层按模型配置插值坐姿收拢，外层继续轻摆。最终姿势存入 CSS 变量，有限片段清理后不会跳回站姿；恢复头部原缩放不与场景统一身高重复计算。流程和道具可复用，但不同体形、服装、武器仍需要模型适配和实际画面检查。

`mascotRig.solveArm` 默认以掌心为末端、前臂加掌心偏移为有效长度求解，使手腕沿前臂；显式手腕角度仅留作未来特殊持物适配。自由换姿插值肩角和相对肘角，避免目标姿势的 IK 弯曲方向直接覆盖起始帧；拿竿/放竿则沿道具握点求解。思考有独立 `think-raise` / `think` 双臂姿势；非托腮手也参与换姿，停留循环只轻动前臂和手指。

托腮使用姿势级袖管投影比例：总臂长不变，折叠上臂短一些、抬起前臂长一些。`armSleevePaths` 是静态绘制与有限片段共用的路径来源；比例变化时同时插值袖管 `d`、肘点和腕点，手掌不缩放。`think-raise` 属于站立姿势，佩剑与披风保持站立状态。

钓鱼模型可配置 `fishing.parkedOffsetX`，仅调整停放鱼竿的横向位置，正式握竿姿势不变。`fishingGripPoint` 共用于取竿姿势和拿竿/放竿片段，`fishingParkedTransform` 输出 SVG/CSS 共用的矩阵；鱼竿本体通过 `transform` 和 `transform-origin` 属性自带初始停放姿势，不依赖父层 CSS 变量和额外停放样式。取放片段沿同一矩阵过渡，结束清理后回到正确的静态姿势；米托拉配置为 40，道具坐标经现有场景变换后桌面约外移 31px。062、053、034、049 与后续 27 名重绘角色同样采用外侧取竿握点（40）；仅 001 希尔与 055 迦南保持默认 0，原位置和轨迹不变。

`MASCOTS` 覆盖参考清单的 34 名角色，首批七人保留原顺序，其余按编号排列，全部注册真实关节模型，不再使用 `idleOnly`。新增分件素材按首批描边和平涂风格人工绘制，无内嵌位图，装配后使用 320×400 画布；按实测待机身高归一到 312 单位，动作间保持比例。武器、翅膀与长发分别适配坐姿，不以裁切或横向压缩容纳。模型 `?raw` 源码随懒加载侧栏模块进入，独立素材请求只针对当前及当前批次；`SidebarMascot` 每批最多挂载七个静态预览，翻批/关闭取消旧批请求，成功内容缓存。`UiPopover` 的 `heading-actions` 插槽承载批次按钮，弹层位置、焦点恢复和关闭仍由公共组件负责。

`mascotParts` 额外提取可选 `upperArm/cuff/thigh/shin/boot` 及左右专属分件，`MascotArm/Leg` 把它们装配到对应关节局部坐标。袖口在手掌下层，随同手腕动画，不改变掌心握点；缺省时不影响首批七人的原绘制。`MascotFigure` 按 `satchelLayer` 渲染唯一随身配件节点：默认背后、`waist` 躯干前、`shield` 手臂前；027 的书袋和 046 的腰链使用腰侧层，026 的花瓣盾使用盾牌层；同一 `.rig-satchel` 继续使用既有坐姿/起身变换，避免新增静态副本或切层丢失轨迹。

奖励公共底层为 `acquisitionRules.js`（无网络、缓存或组件依赖），`gameMappings` 重导出旧映射及摘要解析接口。物品构建器在完成名称和图标关联后生成 `item.acquisition`；`ItemDetailModal → AcquisitionRewards → UiRewardCard` 共用消耗、奖励池和概率展示，物品、装备与符石图鉴不再各自解析使用动作。锻造装备候选与普通设施产出也调用该底层。正式来源入口判断、抽奖保底与重复转换各归其业务模块，不进入通用奖励解析。接口详见 [ACQUISITION_RULES.md](technical/ACQUISITION_RULES.md)。

1. 构建时 `npm run build` → `scripts/parse/index.mjs`（一键数据入口）优先读取仓库根 `raw/` 原始表（仅为兼容未迁移数据才兜底 `public/data/`），
   生成 `public/data/parsed/*.json`（全局搜索索引、物品来源反查表、页面级预解析文件等）。物品/装备链同时读取 `item.json`、分类树、`equip/equipGroup.json`、`equip/equipSuit.json`、词缀表、`hero/hero.json`、`hero/heroStar.json`、`homeLevel.json` 和 `equip/装备符石数据对应表equipGlobalConfig.json`，由 `itemParser` 统一提供正式装备判定、属性系数、强化等级计算、默认排序及角色碎片逐星阶消耗。装备强化上限取 `homeLevel.datas.blacksmith.level` 与 `smithyCfg` 的正式交集，当前为锻造台 9 级 / 装备强化 50 级；强化按 `生成属性 × (1 + 强化等级 × attUp)` 线性作用于五项装备基础属性，990~995 测试档保留在原始配置中但不参与有效强化上限。角色预解析另读取 `general.jobPaBuffConfDes`，沿其中的 Buff ID 关联 `buff.json`，把当前职业的一至两条正式职业特性写入每个角色；同时读取 `skin.json`，只把 `show=true` 且有正式角色绑定的额外皮肤写入对应角色，页面按数据动态显示皮肤页签。角色与魔物预解析共同读取 `playerLevel.json`，由 `levelConfig` 把末尾下一等级经验边界转换为正式可达上限（当前 50），分别写入 `parsed/heroes.json` 与 `parsed/pets.json`；角色滑条再与品阶上限取交集，魔物等级不得超过玩家等级。词缀反查只采用正式奖励实际引用的装备组，排除“暂不使用/测试/废弃/弃用”奖励组并合并重复前缀集合。副本页读取 `instance.json`、提取版 `dungeonBattle.json`、`dungeonBattleRooms.json`、`dungeonBattleRoutes.json`、`reward.json`、`consume.json`、`roomCollect.json`、`roomCollectType.json`、`mon.json` 与 `item.json`，生成轻量 `parsed/dungeons.json` 索引及按关卡拆分的 `parsed/dungeons/{battleId}.json` 详情；其中 `mode:equip` 固定装备再生成 `parsed-dungeon-sources.json`，记录关卡、箱型、目标物品和奖励组综合概率，由搜索构建器合并进统一 `item-sources.json`，运行时据此跳转并定位副本详情中的目标箱子；`mode:equipGroup` 随机池不反推具体装备来源。怪物页由 `fileMon/mon/ai/skill/buff/reward/equipGroup/item` 生成单个 `parsed/monsters.json`，产物只包含 `monsters` 正式图鉴数组，不生成 `mon.json` 全量单位 handbook；构建期再从 `exploreArea/room/battle/dungeonBattle/dungeonBattleRooms` 提取轻量形态用途，沿 `ai.type=6` 的状态入口反查触发条件，并合并 `monsterTowerUsage.json` 中由完整 `tower → battle → room` 生成的实际塔层。塔层索引依据源码正式 Boss 判定（`monRank=3` 或 `unitData.keyList` 含 `boss`）过滤普通小怪；`*_boss` 形态的塔层摘要同时以 `towerBossAppearances` 关联到同组通用形态，详情页复用“出现位置 / 出现楼层”展示但不改变通用形态的属性身份；最终只保留本体/变身/探索/剧情/副本/日常/爬塔标签、变身链和 Boss 塔层摘要，来源明细不会写入产物，浏览器也不请求这些来源表；
   纯函数位于 `src/utils/*.js`（`taskParser`、`furnitureData` 等），浏览器与构建脚本共用。家具预解析以 `homeItem.objType` 构造图鉴分类，将 `homeItem.category` 原样保存在 `sourceTags`，并沿 `consume/condition/playerInit/task` 保留制作、初始配置量及开放信息；开放条件复刻 `CheckResultConditions` 的 `rules[].type/para/need` AND 语义与条件级 `reverse`，`condition.desc` 仅作为 `configNote`，不能替代真实条件。图纸关系解析只按 `item.useActionPara.homeItems[].typeId/skin[]` 建立正反向关系，黑名单属于视图/图鉴组装策略，不进入纯关系解析函数。142 件是静态配置图鉴，不等同账号运行态列表；客户端运行态仍依赖条件、服务器 `HomeItemData` 和 `unlocked`。成就预解析由 `achievementData` 将 `achiAction + para` 转成实际达成条件；剧情任务、指定副本、魔物类别和战斗事件保留配置中的完整条件文案，并把 `unlock/next` 转成公开成就名称关系。PVP 预解析由 `pvpData` 写入段位积分、战斗积分与正式赛事/赛区规则，过滤测试说明、旧赛季时间及内部模式字段。家具、成就、配方、事件页面运行时只读取各自的 `parsed/*.json`，不得在浏览器重新加载原始表并执行构建期解析器；解析失败应显示错误态，避免同一数据规则在构建期和手机端重复维护。
2. 运行时视图通过 `utils/request.js` 的 `fetchWithFallback` 拉取 JSON（多路径回退，
   原生端可走 CDN）。副本页首次只加载摘要索引，用户打开关卡后才请求对应详情；怪物页读取单个正式图鉴 `monsters.json`，打开详情时另取轻量 `monLevelStrength.json` 支持等级滑块。NPC、友方、剧情临时单位和孤立配置不进入运行时怪物页；移除前快照已移至项目外 `E:\Desktop\html\myrzg\backups\full-monster-handbook\2026-08-31\`，不参与构建。云端失败时由 `fetchWithFallback` 读取热更包内同路径产物，不在手机端重新组合原始表。
   兑换页以 `itemExchange.json` 解析内容，但可见性必须与 `shop.json`、`general.json`、`packDisplay.json`、`activityList.json` 的正式入口求交集；地区商店、种子商店、兔子商人、积分商店、皮肤商店和每日补给均不得仅凭 `team/category` 展示。没有入口的 `monyshop`、`zhongziShop`、`payKeShop`、隐藏礼包及孤立兑换项不进入页面和 `item-sources`。锻造台由 `ProducePanel → SmithPanelUI` 独立读取 `itemExchangeRandom.json`，两条数据流不混用。
3. 解析逻辑集中在 `utils/*Parser.js` / `*Data.js`，视图只消费解析结果。`supplementalItemSources.js` 提供地图、营地、活动等来源，`remainingItemSources.js` 提供日常计划、塔层、分解、招募与从已有入口可达的容器反查，统一由 `searchData` 合并。实际产物筛选复用 `acquisitionRules.getObtainableRewardRules`，不将随机装备预览当成固定产物。完整构建传入本次副本来源；独立搜索构建从原表重算副本来源，并保留已有 PVP/隐藏产物，避免陈旧副本来源文件导致遗漏复发。来源只序列化简短说明和实际消费的定位字段：副本保留 `type/id/name/des/dropTab/dropEntry`，目标物品由外层键和当前弹窗提供，概率写入箱子说明，不复制完整关卡名、条件、消耗和奖励数量。塔层、分解按产物合并有效档位，详细玩法规则留在各机制产物中。来源无法确认的候选只记录内部文档。实现与边界见历史归档备份（`backups/audits-archive/SOURCE_COMPLETION_FOLLOWUP.md`）。
4. `raw/mon.json` 使用完整原表；字段拼写和头像引用只在 `shared.mjs` 归一化时修改内存。`sync-raw.mjs` 默认预览，`--apply` 补缺，`--apply --replace` 才刷新已有原表及兼容别名；副本中间表与塔层索引不参与覆盖。`check-task-data.mjs` 同样默认只读，禁止再输出裁剪版 battle/room 到原表路径。

### 4.4 视图职责边界

- `App.vue` 根据桌面视口、原生环境和独立布局按需挂载 `SidebarMascot.vue`；组件管理角色/暂停偏好、可见性、IntersectionObserver 和减少动态效果设置，卸载时清理监听及中止请求。`config/mascots.js` 统一 34 名角色及 Vite 构建资产 URL，`utils/mascotArtwork.js` 用可重试的 fetch 加载可信本地 SVG、校验根节点及角色 ID，并缓存成功结果；首屏只加载当前角色，选择窗展开才补齐缩略图。`src/assets/mascot/idle.css` 共用关键帧，缩略图禁用动画，没有逐帧 JavaScript 或新动画依赖。`UiPopover` 统一非模态锚定选择层的上方定位、主题面板、窗外关闭、焦点及覆盖层登记（6003），业务组件只提供角色选项；路由变化关闭选择窗。图形尺寸与右栏布局遵循 UI 组件库约定。

- 皮肤小人导出入口：`npm run skins:export`；环境准备、命令与更新步骤见 [皮肤模型导出说明](technical/SKIN_MODEL_EXPORT.md)。

- 皮肤模型静态图：`scripts/dev/export-skin-models.mjs` 使用已安装的 Spine 4.0 渲染库，将 `4.24路资源包/assets/res/spine/model/npc/{skeletonName小写}` 的原始 skel/atlas/png 按配置皮肤渲染 `idle_front` 第 0 帧，输出透明 PNG 与来源哈希清单到 `public/images/skin-models/`。导出需要本机 Vite（默认 4187，可通过 `SKIN_PREVIEW_URL` 指定）；原始贴图不修改。`scripts/parse/skin-models.mjs` 核对清单的 skeletonName、skinName 和图片存在性后，为 items/heroes 构建提供共用路径映射，分别写入 `skinUnlock.modelImage` / `skins[].modelImage`。详情页面只加载静态 PNG，不加载 Spine 或原表；已有图片与清单入库，普通构建不重新渲染模型。

- 时装与积分/氪金商店统一归 `shop`，入口顺序来自 `packDisplay` 的可见 `packType=2/5` 配置；共享 `buildOfficialExchangeIndex/getExchangeSourceMeta` 同步更新搜索与物品来源链接。兑换构建额外读取 `skin.json` 和 `hero/hero.json`，按 `shop.skins.heroSkin → skin.heroTypeId` 生成角色名、皮肤名、品质与专用商店封面；价格仍由 consume 原表解析。`UiExchangeTrade.skin` 消费这些字段，页面不关联原表，也不模拟账号拥有状态；旧 fashion 查询转入 shop/fuZhuang。

- `FacilitiesView.vue` 负责设施配方与营地页签和 URL 状态；`components/facilities/CampFacilitiesPanel.vue` 消费同一 `parsed/facilities.json` 的 `key:camp` 对象，展示建筑与研究。构建期由 `campFacilityData.js` 关联 `homeLevel/campResearch/roomBuild/consume/condition/task/reward/item/homeItem`，运行时不加载原表。资源校验允许原配方与营地两种对象结构。升级的来源等级与目标等级分开保存，详情跳转只追加 `itemId`，具体协议见 [CAMP_FACILITIES.md](features/facilities/CAMP_FACILITIES.md)。

- 模拟招募 `/gacha`（`GachaView.vue` + `components/gacha/`）：按游戏原素材还原的卡池页与演出，属「业务皮肤」例外，不进通用 UI 出口。设计画布固定 1534×750、原点居中，由 `GachaStage.vue` 统一等比缩放（`utils/gachaLayout.js`），子组件用 prefab 原始坐标定位、不做响应式重排；`assets/gacha.css` 只服务该页面，9 宫格切片值取自图集元数据 `mSprites[].border*`。抽卡规则集中在纯函数 `utils/gachaSim.js`（星级权重、`safe/firstSafe` 保底、指定伙伴、重复转碎片与结晶），本地模拟状态在 `stores/gachaState.js`（persist），页面必须标注「模拟」——余额、限购与已拥有不属于静态图鉴。数据来自 `parsed/gacha.json`（`scripts/parse/gacha.mjs` 增量附加原表 `percTip`/`upTypes`/`packDisplay` 等展示字段）与 `parsed/gacha-presentation.json`（含揭晓小人的 Npc 骨架名与皮肤）。职责拆分：`GachaCardPanel.vue` 还原 `HeroGachaAniPanel`（模糊背景 + 开场相机推拉 + elsa_rawcard 翻卡，仅角色池）；`GachaPetPanel.vue` 还原 `PetGachaAniPanel`（背景 bgAniTween 开场 + 蛋池桌面 + perform_bag 开袋出蛋 + 逐蛋揭晓 UI，蛋池全程在本面板内完成，不走 HeroGachaShowPanel）；`GachaRevealPanel.vue` 还原 `HeroGachaShowPanel` 三段式（暗黑殿堂 bg.png、backFrame 菱形门与属性染色符文环、Q 版小人 win→win_idle、classStars→stars 双星级行、按稀有度点击跳段），揭晓小人经 `utils/gachaSpinePlayer.js` 的 `fit:'bounds'`（运行时包围盒取景）按需加载。坐标与演出手法的推导记录见 `docs/dev-logs/2026-09/2026-09-12.md`，完整规范见 `SPEC.md` §九.9.8。

  2026-09-13 校正：音频统一走 `utils/gachaAudio.js`（BGM 模块级单例：同名曲不重启、音效开关真正暂停/续播当前曲、面板卸载不停曲，离开页面才停）；**两池结束状态分流**——角色池 `GachaResultPanel.vue`（`HeroShowPanel`/`HeroShowItem`：连体星条 `com_stars_{rare}`、职业/属性标、`popUpAni` 逐张展开），魔物蛋池 `GachaPetResult.vue`（`GetRewardTip` 结算弹层：`item_get` 底板 + `ItemBagCell` Large + 0.1s 逐格 + 两段式关闭，蛋不显示数量）；`GachaRevealPanel` 的角色层按 prefab `mDepth` 排序（立绘 40 < 名牌 59 < 台座 61 < **Q 版小人 75**，此前立绘把小人盖住）。骨架真值、缺口与已知限制（`Npc_007` 解析异常 → 卡面代替）见 `docs/features/gacha/GACHA_REPLICA_AUDIT.md`。
- `App.vue` 只负责页面外壳、路由出口和全局弹窗装配；全局搜索、原生主题/返回键生命周期、备份导入导出分别由 `composables/app/useGlobalSearch.js`、`useNativeShell.js`、`useBackupData.js` 管理。
- `HeroesView.vue` 管理角色列表、详情状态、技能与属性计算；档案、互动页签、对话缓存归 `HeroStoryPanels.vue`，不得重新复制回页面。
- `DungeonsView.vue` 管理副本筛选、关卡详情、房间详情和掉落；路线图的布局投影、缩放、鼠标/触摸拖动、节点聚合归 `DungeonRouteMap.vue`。
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

符石图鉴数据链为 `scripts/parse/runes.mjs → runeData.buildRuneData → parsed/runes.json → RunesView`。`itemParser.parseRuneEffect` 调用同一个 `buildRuneEffect`；鉴定与合成消费 `acquisitionRules` 同构规则，鉴定使用 `AcquisitionRewards`，合成列表卡片直接用 `UiRewardCard` 展示单次材料与构建期效果，不提供次数输入。合成支持产物等级/部位筛选及来源方案优先定位。搜索构建直接取 `buildRunesFile().data.sources`，合并 `runeAppraisal/runeSynthesis`，仅去除同一方案的重复 Gem 兑换来源；兑换页加载时排除 Gem 分类，保留原始配置供符石解析。运行时结构由 `resourceSchemas` 校验。详见 [RUNE_CATALOG.md](features/runes/RUNE_CATALOG.md)。

完整构建需要本机完整 `raw/`、副本提取输入及剧情资源，只有已提交的 `parsed/` 不能替代这些前置。配置/剧情/源码默认从项目同级目录读取，可用 `MYRZG_CONFIG_DIR`、`MYRZG_DIALOG_DIR`、`MYRZG_SOURCE_DIR` 覆盖；默认路径不依赖启动终端的工作目录。

```bash
npm run dev          # 开发（vite）
npm run build        # 数据预处理 + 生产构建
npm run test:ui      # Playwright 桌面/移动端关键交互回归
npm run preview      # 预览产物
npx cap sync android # 同步 Android 原生壳
```

发布须上传完整产物，并在缓存过渡期保留旧的带 hash 的 `assets` 文件。Android 同步前必须保留 `dist/data` 与 `dist/images`，否则无法兑现离线回退；旧 `clean_dist.bat` 已停用删除策略。图片压缩仅在用户明确授权时执行，不作为构建的自动步骤。

### 伙伴邮件视图

桌面列表卡片固定高度；`PartnerMailReader` 在 ResizeObserver / 字体加载完成后按 1px 递减测量标题，使用 requestAnimationFrame 合并布局工作，卸载取消回调与定时器。≤700px 改为头像横栏、邮件选择栏、全宽正文三行；选择栏横滑吸附，滚动停稳后选中最近邮件，右侧按钮通过现有 `select-mail` 事件切换。选中邮件变化时同步标题可见位置，正文滚回顶部；切换物品详情不改变邮件选择。

邮件正文与角色档案共用 `gameMappings.cleanMailContent → cleanDialogueLine → CALL_NAME_REPLACE`，同时支持方括号/花括号称呼，不在页面另建映射。奖励预解析保留公共规则的真实 `typeId`，阅读器通过 `select-reward` 交给页面追加当前路由 `itemId`，由 App 现有全局物品详情加载流程处理，保留邮箱状态。

`scripts/parse/heroes.mjs → heroParser.buildHeroData → partnerMailData` 遍历完整 `heroMail`，生成 `parsed/heroes.json` 的独立 `mailboxes[].mails`；`fetchHeroData` 同步缓存邮箱。邮箱保留原发件人 `heroTypeId`，不套用可玩角色图鉴的 `hide` 过滤；只按游戏源码剔除失去同角色档案关联的 `mailType=2` 邮件。当前为 36 个邮箱、61 封邮件。角色图鉴的 `archives[].mail` 仍保留，且复用同一个 `parseHeroMail`。

`partnerMailData.getPartnerMailPresentation` 统一彩色图标和奖励标签：档案任务、普通任务、附件、普通信件按 `mailType/taskTypeId/hasAttachment` 区分，`hasAttachment` 来自原始 `reward` 字段，不依赖解析结果。附件/档案奖励用 `acquisitionRules.parseRewardGroups` 解析数量与物品品质，任务完成奖励不挪入邮箱；`UiItemCard` 共用图鉴背景框和图标比例。原 `img` 转为 `uipanel/emailpanel/heromailimg` 路径，仅有附图的信件加载。`resourceSchemas` 验证邮箱结构，旧数据缺少邮箱字段时明确报错。

该路由通过 App 外壳 `is-mail-reader` 建立视口高度约束，覆盖桌面通用页面滚动规则。中间页与侧栏等高，筛选后的剩余空间交给阅读器；三个内部滚动容器禁止滚动链传到外页。路由离开后类名自动移除，不影响普通图鉴。方向提示由容器滚动事件和 ResizeObserver 维护，卸载断开观察。

`PartnerMailsView.vue` 负责筛选与选择状态，`components/heroes/PartnerMailReader.vue` 负责游戏邮件皮肤和正文滚动。复用角色预解析数据，不新增原表或构建链。邮件图复用 `public/images/EmailPanel_Atlas`，通用框/图标复用 `Common_Atlas`，信纸使用 `uipanel/emailpanel/mail_botm.png`；来源及切片约定见 `features/PARTNER_MAIL_SKIN.md`。

## 6. UI 设计体系概览（详见 UI_COMPONENT_LIBRARY.md）

图片维护以 `SPEC.md` 的原来源目录命名约定为准：已删除 `MonstersView`，普通图鉴直接共享 `PicHandBookPanel_Atlas`，不维护旧文件名映射；详情使用预解析 `portraitPath`，模型预览按原模型名放 `model-previews`，蛛网复用物品图。招募的通用按钮共享 `Common_Atlas`，揭晓原纹理归 `uipanel/herogachashowpanel`，导入脚本与清单同步使用这些共享路径。整理结果见图片整理归档（已去重完毕，原排查留档在 `backups/audits-archive/`）；`scripts/dev/audit-image-resources.mjs` 是独立只读检查，不进入构建链。魔物收益与招募卡池使用现有 `public/images/eggs`，原资源位置为资源包 `texture/pet/eggs`。

- **主题**：羊皮纸 Wiki（源自 `ui模板.html` 调色板：深木 #2b1f15、羊皮纸 #dfceb3、
  墨水 #3e2a14、描边 #8f7351、湖青 #7a9a99）。
- **字体**：标题与正文使用本地 HarmonyOS 常规/粗体，缺字回落设备原生无衬线字体；不加载外部字体或完整游戏字体作为回退。
- **组件**：全部从 `src/components/ui/` 引用，页面不得复制基础样式。
- **地图背景**：`/ui/map_w1_bg.png` 全站铺底，面板为半透明羊皮纸。

## 7. Git 提交与推送约定

> 目的：把「本地提交」当存档点用，保证任何时候改坏代码、数据或图片都能精确恢复；「推送」只是把存档同步到 GitHub，两者分开对待。

### 1. 核心认知

- git 每次提交存的是当时**所有被跟踪文件的完整快照，图片等二进制资源也在内**。删除或修改前只要提交过，事后即可按提交号精确还原该版本（单文件恢复：`git checkout <提交> -- <路径>`；整体回滚：`git reset --hard <提交>`）。历史只会累积，不会覆盖。
- git 无法恢复**从未提交过就被删除/覆盖**的文件。所以「动手前先提交」是唯一的兜底规则，新导入的图片、新写的脚本先 commit 再动工。
- 仓库体积与恢复正确性是两回事：图片反复修改提交会让历史永久变大（胖），但不影响恢复（准）。不要为了省体积少提交。

### 2. 什么时候提交

| 时机 | 动作 |
| :--- | :--- |
| 动手改之前 | 工作区有未提交改动时先提交一档再开始，尤其 AI 大规模重构、批量改脚本、换表之前 |
| 一个说得清的改动完成并验证后 | 提交单位 = 一条提交能用一句话说清楚干了什么（如“修复某页问题”“跑通 data:build”）；说不清说明该拆或没做完 |
| 实验性尝试前 | 先提交当前状态再折腾；试成继续，试砸 `git reset --hard` 回来 |
| 一天结束时 | 即使进行中也提交一档，备注写“进行中：xxx”，不让改动在目录里裸奔 |

### 3. 提交内容边界

- **代码/文档改动与数据重建分开提交**：只改代码就只提交代码；跑过 `npm run data:build` 重新生成的 `parsed/` 产物单独一档，哪次改坏数据一眼能定位。
- **临时文件一律写进 `.gitignore`**，不混进提交：`.html`、`.tools/`、`*.tmp.mjs`、`*~` 备份后缀、`test-results/` 等试错产物。它们不是资源，恢复也不需要。
- **图片资源**：新导入的图片先提交再动工；压缩/替换前先按 `SPEC.md`「资源备份与图片压缩约定」备份原图到 `E:\Desktop\html\myrzg\vue-myrzg备份-资源\`。git 快照与备份目录互补：git 管“各开发阶段的快照”，备份目录管“压缩前原图永久留底”。

### 4. 推送与历史改写

- 推送节奏随意（阶段性推送即可），推送前 `npm run verify` 通过再推。
- **未推送的本地提交**可随意 `reset`/`rebase` 改写；**已推送的提交不要 force push / 改写历史**，除非确认远程只有自己且确有必要。
- 远程分叉时禁止直接合并旧快照把已删除文件带回来：先看清远程提交内容，若本地严格更新则用 `git merge -s ours` 只接历史、内容以本地为准；正常分叉用普通 merge 解决冲突。
