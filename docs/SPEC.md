# 深歌小助手前端规范

深歌小助手是《深渊之歌》的 Web / Android 图鉴与查询工具，覆盖物品、培养、任务剧情、地图掉落、设施、兑换及本地招募模拟。本文面向首次接手项目和日常维护：读完应能知道各页面做什么、数据从哪里来、关键规则如何解释，以及修改时需要保持哪些行为。

本文保留理解项目所需的功能说明、主要数据链和公共约定。架构机制见 [架构](ARCHITECTURE.md)，公共组件的完整接口和样式见 [UI 组件库](UI_COMPONENT_LIBRARY.md)，复杂功能的特殊情形见 [文档导航](README.md)。专题用于深入查询，不替代这里对每个功能的说明；历史调参、逐轮测试和已被覆盖的结论留在开发日志与归档。

- [项目与路由](#一项目与路由)
- [共享模块与全站约束](#二共享模块与全站约束)
- [页面契约](#三页面契约)
- [详情与 URL](#四详情与-url)
- [数据与来源](#五数据与来源)
- [资源维护](#六资源维护)
- [开发与验收](#七开发与验收)

## 一、项目与路由

Vue 3 + Vite 8 + Vue Router 4（Hash）+ Pinia 4，Android 使用 Capacitor 8 与 Capgo Updater。依赖版本以 [package.json](../package.json) 为准。路由集中在 [router/index.js](../src/router/index.js)，全部懒加载，路径与名称唯一；`/` 重定向 `/recipes`，切页统一关闭全局物品详情。

下表是页面与主要运行时数据的索引。页面组件均在 `src/views/`，数据文件均相对 `public/data/parsed/`；不是原表加载清单。

| 页面 | 路由 | 组件 | 主要数据 |
| --- | --- | --- | --- |
| 物品图鉴 | `/items` | `ItemsView.vue` | `items.json` |
| 家具图鉴 | `/furniture` | `FurnitureView.vue` | `furniture.json` |
| 设施功能 | `/facilities` | `FacilitiesView.vue` | `facilities.json` |
| 角色图鉴 | `/heroes` | `HeroesView.vue` | `heroes.json` |
| 伙伴邮件 | `/partner-mails` | `PartnerMailsView.vue` | `heroes.json.mailboxes` |
| 魔物图鉴 | `/pets` | `PetsView.vue` | `pets.json` |
| 装备图鉴 | `/equip` | `EquipsView.vue` | `items.json` |
| 符石图鉴 | `/runes` | `RunesView.vue` | `runes.json` |
| 菜谱查询 | `/recipes` | `RecipesView.vue` | `recipes.json` |
| 魔物收益 | `/petseggs` | `PetsEggsView.vue` | `pet-eggs.json` |
| 成就查询 | `/achievement` | `AchievementView.vue` | `achievements.json` |
| 怪物图鉴 | `/monsters` | `MonstersView.vue` | `monsters.json` |
| 任务图鉴 | `/tasks` | `TasksView.vue` | `tasks.json` |
| 事件图鉴 | `/events` | `EventsView.vue` | `events.json` |
| 副本图鉴 | `/dungeons` | `DungeonsView.vue` | `dungeons.json`、`dungeons/{battleId}.json` |
| 关卡图鉴 | `/chapters` | `ChaptersView.vue` | `chapters.json`、`stages/{stageId}.json` |
| 兑换 | `/exchange` | `ExchangeView.vue` | `parsed-exchange.json` |
| 模拟招募 | `/gacha` | `GachaView.vue` | `gacha.json`、`gacha-presentation.json` |
| 其他 | `/rewards` | `RewardsView.vue` | `parsed-pvp.json`、`parsed-hidden.json` |

项目入口为 `src/main.js`，应用壳为 `src/App.vue`，页面在 `src/views/`，共享逻辑在 `src/utils/`，构建入口在 `scripts/parse/index.mjs`。源码目录不等同于运行时请求路径；首次接手可先沿“路由 → 页面 → parser/产物 → 构建器”找到目标模块。

导航顺序、名称与图标由 `NavigationMenu.vue` 维护，三种菜单模式共用同一数据。`NavigationMenuLite.vue` 是备用精简入口；切换导航不删除页面路由，也不作为自动提交步骤。

## 二、共享模块与全站约束

### 应用壳与页面分工

`App.vue` 装配顶栏、全局搜索、设置菜单、导航、路由出口与全局弹窗。搜索、原生生命周期和备份导入导出分别由 `composables/app/useGlobalSearch.js`、`useNativeShell.js`、`useBackupData.js` 管理。页面负责加载自己的预解析数据、筛选、详情状态与 URL；公共工具不能反向依赖页面或组件。

普通桌面页面以 `.app-container` 为页面级滚动根，手机使用页面内部列表。伙伴邮件的 `is-mail-reader` 使用固定阅读器，招募的 `is-gacha-stage` 隐藏普通 Wiki 外壳并使用独立舞台。不要把其中一种布局套用到所有页面。

### 共享模块索引

新增逻辑先检索现有实现，禁止在页面重复维护映射、概率、图标、解析和基础样式。以下路径均相对 `src/`：

| 能力 | 维护入口与使用方式 |
| --- | --- |
| 职业、元素、品质、任务、分类、地图与属性名称 | `utils/gameMappings.js`：使用 `JOB_*`、`ELEMENT_*`、`getRarityName`、`getCategoryName`、`getMapName`、`translateStatName` 等共享导出 |
| 对话、邮件与技能文案 | `gameMappings` 的 `cleanDialogueBase/cleanDialogueLine/cleanMailContent`、`getCleanSkillName`、`formatHighlightedText` |
| 货币、奖励组、消耗和批量计算 | `utils/acquisitionRules.js`；旧摘要接口由 `gameMappings` 重导出，[详细接口](technical/ACQUISITION_RULES.md) |
| 物品模型、分类、图标、排序与装备计算 | `utils/itemParser.js`；物品与装备页共用模型和详情 |
| 食材、通用材料与菜谱预览 | `utils/recipeUtils.js`，材料组装用 `buildRecipeIngredients` |
| 角色、魔物、怪物、任务 | `heroParser`、`petParser`、`monsterParser`、`taskParser`；角色/魔物等级边界共用 `levelConfig` |
| 家具、设施、符石 | `furnitureData`、`facilityData/campFacilityData`、`runeData`，构建期关联后由页面消费 |
| 隐藏策略 | `config/blacklist.js` 的 `isBlacklisted`，维护精确/模糊名单，新增项不重复；按地区名匹配的条目必须传 `mapName`（`黑森林`）而不是 `chapter` 代号（`c4`）——代号匹配不到，会出现「筛选按钮隐藏了、来源或卡片还在」 |
| 图片与静态 JSON | `utils/env.js` 的 `getImageUrl`、`utils/request.js` 的 `fetchWithFallback` |
| 页面与详情滚动 | `scrollTarget`、`modalScrollCoordinator`，统一识别实际滚动根与嵌套恢复 |
| 覆盖层与原生返回 | `globalModalLock`、`overlayStack/useOverlay`、`nativeBackHandler`，按最上层顺序处理 |
| 本地收集标记 | `stores/appState.js`：成就与隐藏物品 |
| 招募规则、状态与舞台 | `gachaSim`、`gachaState`、`gachaLayout`、`gachaCurrency`、`gachaSpinePlayer`、`gachaAudio` |
| 房间内容与奖励池展示 | `utils/roomDisplay.js`：波次文案、宝箱排序、奖励池分组与概率标签；`RewardPools.vue` / `RoomContentList.vue` 由副本图鉴与关卡图鉴共用 |
| 章节地图 | `components/chapters/ChapterMapCanvas.vue`：底图 + 拼块渲染与归属图命中判定；坐标与归属图由构建期产物提供 |

纯规则模块在构建期完成多表计算；带请求、缓存或播放生命周期的运行时工具负责各自环境。不能因为它们同在 `utils/` 就把所有工具都当作无副作用纯函数。

### 数据、奖励与文本语义

- 静态图鉴不连接游戏账号，不伪造库存、已解锁、已读、领取、售罄或任务完成。成就/隐藏点位的本地收集标记与招募模拟要与游戏状态明确区分。
- 品质名称统一为普通、稀少、珍贵、罕见、传说，取 `RARITY_NAMES/getRarityName`；分类和地图名使用共享归一化，不在每页另写一份字典。
- 货币与经验使用 `BASE_REWARD_* / REWARD_MODE_INFO` 的名称和图标；真实物品使用关联后的图标，不直接拿奖励组 ID 拼图片路径。
- `group.num` 是抽取次数，`rule.min/max` 是单次抽中的数量范围。零触发率不能默认成一，自选候选不是逐项必得，随机装备展示项不能当作固定产物。
- 物品构建器生成 `item.acquisition`，物品、装备、符石复用同构奖励规则；批量使用 `scaleAcquisition`，不在组件中另算概率或复制费用。完整概率和兼容字段以奖励接口专题为准。
- 对话清洗统一处理游戏富文本、等待标记和称呼占位，邮件复用 `cleanMailContent` 并保留换行；技能数值高亮只用共享格式化函数，避免不同页面显示同一段原文却有不同含义。
- 黑名单影响可见列表、搜索与直接物品入口，不删除原表。各模块仍须按自身业务判断正式入口；隐藏可玩角色不等于应该删除其有效邮箱，纯关系解析也不能因展示过滤而丢失真实外键。

### 资源访问与容错

`env.js` 的 `CLOUD_URL` 为 `https://myrzg.yxzmy.top`。Web 使用同域路径，Android 在线优先 CDN，离线使用包内资源。`getImageUrl` 对 `/ui/` 保持本地路径，对其他图片补齐 `/images/`；图片附 `RESOURCE_BUILD_ID` 版本参数。失败回退由共享工具限次处理，不能无限重试或猜另一张相似图片。

运行时静态游戏 JSON 统一通过 `fetchWithFallback`，同路径请求合并、成功结果复用、失败可重试。CDN 失败或 hash 不匹配只回退同版本包内数据；两边都不合法时显示错误态，不在浏览器重建原表。实时公告属于单独的更新内容，版本规则见第五章。

### 主题、组件与长列表

普通 Wiki 页面沿用地图背景、深木顶栏和羊皮纸面板。`src/assets/theme.css` 是全局样式入口，明暗主题由 `html.dark-mode` 切换；新样式使用 `--paper-* / --text-* / --accent-*` 等语义变量。品质原色用于边框和徽章，浅底文字用品质文字变量；木底/插画上的文字用 `--on-wood-text / --on-image-text`，不能拿随主题变化的背景色充当前景。

页面搜索与筛选区统一使用 `UiFilterPanel`：搜索框右侧提供收起/展开筛选按钮，桌面与手机均可使用，默认展开。收起仅隐藏筛选控件，不清空搜索或已选条件；详情关闭后仍保留本页折叠状态，切页重新进入时默认展开。魔物收益表的列名及排序表头始终保留。顶部全局搜索没有对应筛选区，不增加无效开关。

字体共用本地 HarmonyOS 常规/粗体及 `--font-ui`，缺字回退设备字体；不额外引入完整游戏字库或网络字体。安全区使用 `--safe-top/bottom/left/right`，底部操作、关闭按钮和正文不能被状态栏或手势区遮挡。具体可读性、字号和皮肤例外在 UI 文档维护。

| 场景 | 组件与边界 |
| --- | --- |
| 搜索、筛选、页签 | `UiSearchInput`、`UiFilterRow/UiFilterPill`、`UiTabs/UiSegmentedTabs` |
| 普通列表、图鉴卡、奖励与信息区 | `UiCardGrid`、`UiItemCard`、`UiRewardCard`、`UiSection`、`UiInfoRow` |
| 加载、错误、空态 | `UiEmptyState`，不能把请求失败当作正常零条目 |
| 收集与返回顶部 | `UiCollectionToggle`、`UiBackToTop`，操作指向实际列表状态/滚动根 |
| 通用详情与全局提示 | `UiModal`，统一覆盖层登记、返回与滚动锁 |
| 重型长列表 | 按需直接导入 `UiVirtualGrid.vue`，不经首屏 UI 出口加载虚拟引擎 |
| 原素材业务皮肤 | 招募、邮件等按 UI 文档和专题处理；仍复用共享数据与资源工具 |

物品、家具、任务采用虚拟列表，保留总高度占位，仅挂载可见行和预渲染行；持续追加完整 DOM 不算虚拟化。稳定键、响应式列数、动态行高由组件管理。正常详情返回保持点击前位置，冷分享链接没有原锚点时才调用 `scrollToItem`；不能对尚未挂载的卡片直接查询 DOM。副本封面近视口再加载，并预留尺寸防止滚动跳动。

### 本地状态与备份

`appState` 持久化 `collectedAchievementIds` 和 `collectedHiddenRewardIds`，分别用于成就与隐藏点位筛选。导航模式、主题等设置由应用壳维护，招募的模拟钱包/保底/记录由 `gachaState` 单独管理；临时选择、弹窗历史和结果演出不能混入收集集合。

新增持久化字段时兼容旧存储及已有备份导入导出；筛选重置和路由切换不应清空收集标记。具体存储键、迁移实现与导出字段由对应模块维护，不能按页面名字猜测备份范围。

## 三、页面契约

各页按功能、数据、主要交互和 URL 说明。加载、错误与空态使用公共组件；筛选和计数反映当前结果。仅已实现的参数做 URL 同步，不能把页面临时选择写成已支持的分享协议。展示范围依各功能的正式配置与用途判断，不把“所有原表记录”或“当前账号可见记录”当作全站统一口径。

### 物品图鉴

入口 `/items`，页面 `ItemsView.vue`。通过 `fetchItemData()` 读取 `parsed/items.json` 的物品与分类树，构建期已经完成奖励、装备、符石、套装和用途关联。物品详情是全站共用入口，其他页面不重复实现一套道具信息。

- 搜索覆盖名称、描述和 ID；分类按 `category[0/1/2]` 逐级筛选，品质名使用共享映射。好感礼物有专门分类，废弃的“旧版符石”不再作为有效中类入口。
- 普通条目按大类、中类、小类、品质降序、ID、中文名稳定排列。收集大类因原表分类不全，按指名契约、角色碎片、配方、家具图纸、日志文本、外观皮肤、其他分组，组内再按用途和品质排序。
- “配方”兼容 `category[1]=51`、`unlockMenu`、`unlockFormula`，食谱与制作配方分别聚合。家具图纸必须经 `unlockHomeItem/unlockHomeItemSkin` 关联至少一件静态家具，不能仅凭名称带“图纸”收录。
- 指名契约保留契约书图标；只有角色碎片替换成头像。特殊记忆碎片 `item_5900103` 保留原描述，不套用普通碎片文案；契约解锁、碎片消耗均沿真实外键。
- 长列表使用 `UiVirtualGrid`，以 `typeId` 为稳定键。正常关闭详情恢复原位置，冷链接再定位目标，不能因追加 `itemId` 重建列表或强制回顶部。
- 点击卡片在当前路由追加 `itemId`，由 App 打开全局物品详情。礼包、钥匙宝箱、鉴定等“包含内容”使用 `item.acquisition`；来源条目只在有真实目标时提供跳转。

### 家具图鉴

入口 `/furniture`，页面 `FurnitureView.vue`。运行时读取 `parsed/furniture.json`，构建期由 `furnitureData` 联结 `homeItem/item/gameSetting/consume/playerInit/condition/task`。这里展示按图鉴规则筛出的静态家具，不读取服务器解锁和库存。

- 一级/二级分类取 `homeItem.objType`；`homeItem.category` 原样保存在 `sourceTags`，表示来源而不是分类。支持名称、描述、外观、图纸、材料搜索，以及品质、放置区域、有无图纸等筛选。
- 列表使用虚拟网格，卡片和外观图消费构建期字段。详情显示分类、放置范围、装饰值、基础库存上限、制作消耗、默认/额外外观和图纸；`playerInit` 只是初始配置量。
- 默认外观依据 `FurnitureData.GetDefaltHomeItemSkin`；源码显式排除项与本站按“废稿”语义过滤的条目要区分，不能宣称静态全集等同客户端账号已解锁列表。
- 图纸只沿 `useAction=unlockHomeItem/unlockHomeItemSkin → useActionPara.homeItems[].typeId/skin[]` 建立关系。纯关系层保留原始关联，黑名单在组装可见图鉴时应用，不凭同名或皮肤编号猜关系。
- 开放条件读取 `rules[].type/para/need`，各项全部 AND 后再应用 `reverse`；任务条件补可读名称和步骤。`condition.desc` 只存为 `configNote`，不冒充真实条件。
- 普通图纸取基础家具 UI 图，皮肤图纸取指定皮肤 UI 图。缺图统一占位，不回退基础家具、不用 `roomObj.viewData[].img` 场景立绘替代，以免把缺失外观展示成另一件家具。
- `id` 打开家具详情；其中图纸/材料只追加 `itemId`。物品图纸也能按精确外键跳回家具，关闭内层物品仍保留家具详情与位置。

### 设施功能

入口 `/facilities`，页面 `FacilitiesView.vue`。保留设施配方，并提供营地升级、属性研究；运行时读取同一份 `parsed/facilities.json`，配方结构与追加的 `key:camp` 对象分别校验。

- 设施配方展示材料、产物、开放档位及对应方案；普通产出与锻造随机装备候选均复用公共奖励底层。配方图标沿构建期 `recipe.output.img` 传入，不为显示图标另请求全部物品表。
- 营地建筑按当前等级查看效果和下一次升级。当前 N 级的消耗、玩家等级/中心等级门槛属于 N 升 N+1；升级后效果取 N+1。末级没有下一等级时，不展示残留费用。
- 建筑 `att` 是当前级总加成，不能逐级相加；建筑 `playerAbility` 按源码累计。同一研究仅取已完成等级效果，不同研究再合计，不能将每级研究效果叠加。
- 研究分采集、生产、冒险，按真实前置关系绘树。前置研究有已完成记录即可，不默认要求满级；搜索保留命中节点的祖先并弱化，计数只算命中，不能伪造账号完成状态。
- 研究消耗、时间和门槛取目标级；`action=formula` 依精确配方 ID 关联。配置文字与数值不一致时按已核对源码处理，保留专题中的差异解释，不擅自修原表或补造缺失等级。
- 营地 query 为 `facility=camp&mode=building|research`。建筑用 `building/level`，其中 `level` 是当前级；研究用 `group/research/level`，其中 `level` 是目标级。共用 `q`，支持 `level=all`；旧配方的 `facility/mode/level/tier/item` 保持兼容，材料只追加 `itemId`。

建筑数值差异、研究连线、完整定位和验证入口见 [营地设施](features/facilities/CAMP_FACILITIES.md)。

### 角色图鉴

入口 `/heroes`，页面 `HeroesView.vue`。通过 `heroParser.fetchHeroData()` 读取 `parsed/heroes.json`；角色、消耗、职业特性、正式皮肤等在构建期关联，剧情分段按需加载。搜索覆盖角色资料、技能、档案与互动文本，空格表示“且”、顿号表示“或”，配合星级、职业筛选。

- 卡片使用角色卡面、品质边框与职业/元素图标，图标 slug 从共享映射获取。职业徽标只展开当前职业特性，数据沿 `general.jobPaBuffConfDes → buff`，条数按配置渲染，不硬编码六职业都有相同数量。
- 技能星阶包含主动技能、天赋、升级计划费用、星阶与碎片消耗；基础属性提供等级、升星次数及突破模拟、基础/成长/静态属性和累计升级突破费用。档案显示好感档案及关联剧情，互动按触发场景分组。
- 主动技能详情标题旁显示当前技能等级对应的冷却时间（CD）和资源消耗；数值来自 `skill.levelData`，切换等级时同步变化，普攻和被动天赋不显示不适用的字段。
- 角色战斗属性公式以源码 `UnitAttribute`、`HeroBattleAttributeGroup` 和 `CombatPanel` 为准：`atkSpeed` 是基础攻速，最终攻速为 `基础攻速 × (1 + min(攻速加成,300) / 100)`；攻击间隔为 `1 / 最终攻速`；技能冷却为 `基础技能冷却 × (1 - min(冷却缩减,50) / 100)`，加成与冷却字段均按百分数输入。防御系数随攻击者等级变化，暴击/浮动由每次伤害入口开启，抗性分配置加减区与动态乘区；通用结算、两次取整、Buff/护盾/回复及模式差异见 [战斗机制与公式](technical/COMBAT_FORMULAS.md)。该文档标明本地源码与配置依据，以及装备特殊属性、穿透赋值等待验证问题，不代表已还原所有专属技能或线上服务端结算。
- 等级上限取 `playerLevel` 正式可达边界和 `heroRank.heroMaxLevel` 交集。超过门槛的突破自动计入；恰好达到门槛时可勾选“已完成本级突破”（默认勾选）比较突破前后，不提供任意品阶选择。页面称“等级突破”，配置“品阶”只是内部状态，属性与消耗使用同一突破状态。
- 五项成长属性按 `原始值 × (1 + (等级−1)×heroLevel.attUp + 升星次数×general.starAttAddData + 已完成突破attUp累计)` 计算，当前每级增加原始值的 5%、每次升星 1%、每次突破 15%，增幅相加；最终舍入遵循 C# 中点取偶数。升星次数为四组星阶技能等级之和，不是稀有度；上限从对应稀有度的 `heroStarLevel` 取得，当前为 13 次，打开角色时默认零次。界面展示升星/突破累计比例和当前代入公式，星阶技能本身及装备等额外属性不计入基础成长。`calculateStats/calculateUpgradeCosts` 分别计算属性及升级突破消耗，费用不含升星碎片；等级、突破、费用不能使用不一致的上限。
- 希尔 `hero_001` 才使用男女双立绘；桌面并排，手机切换，重新打开重置。切换不影响角色资料、数值和路由，其他角色保持单立绘。
- 正式额外皮肤满足显示、绑定和立绘条件才出现“皮肤”页签。展示名称、来源、加成和立绘；模型图必须对应 `skeletonName/skinName` 的待机导出并经清单核对，无模型时保留立绘，不猜用基础角色模型。
- 探索计划的 `start/fight/win/exploreTalk/loopEnd/readyGoHome/over` 归野外探索；`roomFinishLeader/roomFinishMember` 归战斗；赠礼与招募对白分开。随机候选没有固定先后，不添加人为编号；营地标题含“测试”的事件仅在展示层过滤。
- `id` 打开详情，`tab=skins` 可定位皮肤，礼物等物品只追加 `itemId`。列表、详情状态和培养计算归主页面，档案/互动子页签、缓存和对话加载归 `HeroStoryPanels`。

皮肤静态模型的输入、导出与缺图处理见 [模型导出](technical/SKIN_MODEL_EXPORT.md)。

### 伙伴邮件

入口 `/partner-mails`，页面 `PartnerMailsView.vue`。这是使用原信纸素材的静态伙伴邮箱，数据来自 `parsed/heroes.json.mailboxes`，与角色档案共用解析，不另加载原表。

- 邮箱遍历完整 `heroMail`，按真实角色档案关联过滤档案邮件；发件人不在可玩角色列表中并不意味着其邮箱无效。无 `heroTypeId` 的活动/问卷邮件不猜测归属。
- 搜索覆盖邮箱标题，选中发件人后展示其全部有效邮件，顺序沿原表。正文使用 `cleanMailContent`，保留换行和称呼替换；不模拟收件时间、已读、领取或任务完成。
- 类型以 `heroMail.mailType` 判断，不能替换为 `heroArchives.type`。档案邮件、附带任务、附件奖励和普通邮件按对应条件使用图标；后续来信解锁条件不等同于附带任务。
- 奖励复用公共物品卡，真实 `typeId` 包括货币，品质查物品表。没有附件的普通邮件不显示空奖励区，不能把邮件解锁条件造为奖励。
- `PartnerMailReader` 管固定阅读区域：头像、选信与正文各自滚动；窄屏改横向选信，长正文仍占剩余高度。仅该路由启用 `is-mail-reader`，离开后恢复普通页面滚动。
- 筛选和选信是本地状态，没有独立选信 query。奖励只追加 `itemId`，关闭后保留当前邮件和正文位置。

类型判断顺序、皮肤资源、响应式细节与未复测的长正文限制见 [伙伴邮件](features/PARTNER_MAIL_SKIN.md)。

### 魔物图鉴

入口 `/pets`，页面 `PetsView.vue`，通过 `fetchPetData()` 读取 `parsed/pets.json`。支持搜索、星级和变异形态筛选，头像/卡框使用对应普通或变异资源，页面不把怪物图鉴单位混入可培养魔物。

- “技能特性”展示普攻、特性、主动技能及等级，突破要求使用 `petSetting.petTpExp/petTjExp`；“基础属性”展示基础值、成长区间、等级、累计经验与好感配置。
- 成长评级按各属性区间的分段计算，C/B/A/S 对应区间档位，不用全站统一百分比代替具体成长值。等级上限来自玩家等级配置，累计经验来自魔物等级表。
- 属性按 `floor(基础值 + 成长值 × 当前等级)`，1 级已经计入一份成长。滑块变更后属性与成长提示同步，不能错用角色的“等级减一”公式。
- `id` 打开魔物详情。变异、突破与培养在本页维护；卖出和喂养的经济比较在魔物收益页说明。

### 装备图鉴

入口 `/equip`，页面 `EquipsView.vue`。与物品页共用 `fetchItemData()` 和 `ItemDetailModal`，只筛选正式装备，不独立维护一份装备基础数据。

- 过滤条件为 `category[0]=4`、未隐藏、`equip.equipLevel>0`，排除 `show_*` 奖励展示占位。部位来自装备分类树，品阶和稀有度分别筛选。
- 默认排序共用 `compareItemsByCategoryQuality`：大类、部位、小类、品质降序、ID、中文名；品阶只筛选，不改变默认分类顺序。
- 详情支持品质切换、强化等级与实时属性。强化只作用于五项基础属性，上限取开放锻造台与 `smithyCfg` 的交集，990～995 测试档不算正式强化档位。
- 装备入口隐藏仅服务奖励组的“包含内容”，保留词条、套装和获取途径等实际信息。固定副本装备能跳转具体关卡；随机装备池的预览不能反向生成固定来源。
- 点击追加 `itemId`，与物品图鉴、任务奖励及其他来源入口共用同一详情历史。

### 符石图鉴

入口 `/runes`，页面 `RunesView.vue`，包含符石列表、鉴定、合成。读取 `parsed/runes.json`，效果、部位、镶嵌费用和正式兑换关系由 `runeData` 在构建期校验。

- 符石效果沿 `item → equipEnchant → skillTrigger.levelData`，镶嵌费用沿 `equipEnchant.consume`；`buildRuneEffect` 是唯一效果实现，物品详情通过适配接口复用。
- 鉴定沿 `item.useAction=appraisal → useActionPara.reward/consume`；合成沿 `fushi_itemExchangeMapping → itemExchange → reward/consume`。不能按相邻 ID、同名或页面排序猜测下一级，最高级不补后继方案。
- 鉴定是本地模拟，不消耗账号材料。次数为 1～999，显示最近一批结果；修改次数不改旧结果标题，重新鉴定替换结果，换方案/页签清空，打开物品再返回则保留。
- 鉴定按已核对结构独立有放回抽取，不添加隐藏保底；当前客户端资料不足以证明服务器的随机数和批量算法，不宣称完整复刻服务端。
- 合成只展示单次正式材料与产物，按产物进行名称、等级、部位筛选。来源指定的方案排前并高亮，合成中的旧 `count` 不生效。
- URL：`tab=runes|appraisal|synthesis`；列表用 `focus` 定位符石，鉴定 `id` 是未鉴定物品，合成 `id` 是兑换方案；`q/level/position` 筛选，`count` 仅鉴定有效。材料只追加 `itemId`。
- 符石搜索沿用物品索引，鉴定/合成来源合入来源表；兑换页不重复展示 `gem`，原始兑换配置仍保留。

概率、方案切换、字段验证和来源去重见 [符石图鉴](features/runes/RUNE_CATALOG.md)。

### 菜谱查询

入口 `/recipes`，页面 `RecipesView.vue`，也是根路由默认页。构建期关联 `menu/item/buff/gameSetting`，运行时读取 `parsed/recipes.json`，不在缺产物时回退原表重建。

- 提供标签、搜索和料理卡片，展示食材、料理效果及获取方式；图标优先用已关联 `item.img`。通用食材和具体材料一律由 `buildRecipeIngredients` 组装，物品详情复用同样结果。
- 料理预览只在 `PREVIEW_AVAILABLE_IDS` 登记时出现，使用对应 `menu_prev` 图片；未登记不猜测文件存在。Buff 说明用清洗后的纯文本。
- 来源依据 `RECIPE_SOURCE_CONFIG` 的实际类型：成就链接定位 `id/q`，任务链接定位 `task`；任务名称与任务图鉴保持一致，不能只用模糊文本搜索冒充具体任务关系。
- `tag/q` 双向筛选，`id/q` 可定位高亮。成品详情使用 `itemId`，图片预览使用公共全局弹窗；关闭后保留筛选和列表位置。

### 魔物收益

入口 `/petseggs`，页面 `PetsEggsView.vue`。读取 `parsed/pet-eggs.json`，构建期由 `petEggsData` 从魔物配置提取基础售价、喂养经验、孵化时间等指标。

- 支持金币/氪金池、星级和“卖/喂/按需选择”筛选；可选择时间、银币、经验、单位时间收益、比值和建议等显示列。列顺序由 `allFields` 固定，点击表头切换升降序。
- `R=sellPrice/exp` 表示为了取得一点基础喂养经验所放弃的银币；页面按当前数据阈值给建议。这不是官方兑换率，也不是对所有玩家都最优的处置策略，具体阈值由 `PetsEggsView` 维护。
- 默认只比较新孵化个体基础指标。孵化时间在同一个体卖/喂比较中会约掉，只用于比较孵化优先级；变异、突破、培养后的价值不在本页重新计算。
- URL 支持 `pool/tag/q`，`id` 打开详情。筛选与收益列不要误写成魔物图鉴的培养状态。

### 成就查询

入口 `/achievement`，页面 `AchievementView.vue`，读取 `parsed/achievements.json`。成就条件、奖励、物品名称及前后置关系均在构建期关联。

- 分类、搜索与本地收集状态筛选；搜索覆盖名称、描述与奖励名，货币图标使用共享奖励映射。
- 条件由客户端实际读取的 `achiAction + para` 生成。剧情、指定副本、魔物类别和战斗事件等复杂目标保留完整配置文案，不能退化为“完成指定任务”而丢掉目标。
- `unlock/next` 转成“解锁前置/完成后解锁”的成就名称，不暴露内部任务、战斗或奖励编号。`alwaysHide` 的章节宝箱、检查项不进入展示产物。
- 收集开关更新 `collectedAchievementIds`，只表示本地标记；不能据此显示游戏账号完成或领取。
- `status/category/q` 双向同步；`id/q` 定位并高亮卡片，不统一解释为详情弹窗。奖励通过 `itemId` 打开。

### 怪物图鉴

入口 `/monsters`，页面 `MonstersView.vue`，详情使用 `MonsterDetailModal`。读取 `parsed/monsters.json`，打开详情另按需加载 `monLevelStrength.json`。

- `fileMon.monTypeId` 定义正式本体锚点；只收录正式图鉴和有证据的关联形态，不提供 `mon.json` 全量 NPC、友方、剧情临时单位或孤立测试单位入口。按 `label` 分类和 `keywords` 搜索。
- 骨骼名只提供家族候选。形态需有探索/战斗引用、有效 AI 变身或明确召唤证据，不能按 ID 后缀猜用途，也不能把同骨骼其他本体混入。
- 技能沿 `mon.aiId → aiModel(type=1).para.int_para → mon.skillList[index] → skill`；有明确 AI 引用时不展示未调用的历史技能。变身沿 `type=6` 和入口触发器反查，不凭名称排列阶段。
- 详情显示可证实的伤害、倍率、范围、位移、击退、附加状态、解除条件、召唤与陷阱。零倍率且零基础伤害不标成伤害段；无正式技能名时用顺序名称，内部 ID 不进入正文。
- 携带单项效果为固定，多项按配置权重随机；二级 Buff 继续解析持续、周期与解除效果。独立召唤实体展示自己的属性，技能中保留候选、数量、上限和继承摘要。
- 塔层沿完整 `tower → battle → room.monRounds` 构建，只给正式 Boss 写楼层；同组通用形态可显示 `towerBossAppearances` 摘要，但不因此改为 Boss。产物不包含全量单位 handbook 或全部房间来源明细。
- 等级滑块使用当前系数表更新属性；`fileMon.reward` 称“图鉴战利品”，当前形态奖励称“怪物配置奖励”，不能混成该怪物在所有地图的掉落结论。
- `id` 打开形态详情，头像/立绘消费构建期路径；晶石、尖刺等预览和图集头像分清用途，页面不重新拼接来源链。

### 任务图鉴

入口 `/tasks`，页面 `TasksView.vue`，`loadTaskData()` 读取 `parsed/tasks.json`。任务结构、正式怪物判定和剧情索引在构建期关联，剧情正文按需读取 `data/taskDialogs/{dialogId}.json`。

- 一级类型用 `TASK_TYPE_LABELS`，二级分类由数据驱动；委托 C0～C5 转为共享地图名称。搜索、分类和数量针对实际可见任务，当前配置隐藏已下架任务。
- 列表为单列虚拟网格，动态行高。冷链接先定位任务再开详情；正常关闭、嵌套物品返回不重置列表。
- 详情包括接取 NPC/条件/对话、后续任务、解锁关系、奖励和逐步目标。步骤可展开 NPC、怪物、道具和剧情；非正式怪物只显示名称/头像，不生成错误怪物详情链接。
- `addTask` 是完成后追加的后续任务，按客户端逻辑排除下架目标；`unlockTask` 只开放接取资格，两者分开展示。
- 顶层 `unlockStage` 有值才显示；`stepUnlockStage` 属于实际生效步骤，不能汇总成任务完成奖励或顶层解锁。
- `type/sub/q` 双向同步，`task` 打开详情。奖励和目标物品使用 `itemId`，剧情内容保留共享清洗，不将配置中的内部标记直接作为玩家对白。

### 事件图鉴

入口 `/events`，页面 `EventsView.vue`。随机事件与探索区域共用 `parsed/events.json`、地图筛选、图片网格和奖励规则，分别使用 `tab=random/explore`。

- 随机事件由事件、地图、分组、概率和奖励关联生成。卡片展示事件图、名称和稀有分组；详情展示描述、交互、出现地图、刷新概率、冷却与奖励，不能把刷新概率和奖励池概率混为一项。
- 探索由 `exploreArea/mon/consume/reward` 关联，展示地图、探索等级、耗时、队伍人数、消耗、探索点位、遭遇敌人和奖励；不要求浏览器读取这些原表。
- 地图名称由预解析映射提供，品质使用全站名称/颜色。两个页签的计数分别取当前地图和搜索过滤后的结果。
- `map/q` 筛选，`event` 打开随机事件，`explore` 打开探索。来源直达探索必须同步探索页签，不能只设置 ID 而停留随机事件列表。
- 奖励复用 `parseRewardEntries` 兼容摘要接口及公共奖励卡，点击只追加 `itemId`，保留当前事件/探索和筛选。

### 副本图鉴

入口 `/dungeons`，页面 `DungeonsView.vue`。先取 `parsed/dungeons.json` 摘要，打开关卡再取 `parsed/dungeons/{battleId}.json`，不把全部路线和房间放进首屏请求。

- 页面负责地图/关卡、房间详情和掉落；`DungeonRouteMap` 负责路线切换、节点聚合、缩放、鼠标/触摸拖动和选择事件，父页面不复制手势状态。
- 节点和连线取真实布局；同一节点多个候选房间标明候选，不当成每次必然遭遇。房间 `layer` 和 `1/2/A/start/boss` 等布局标记不作为玩家楼层或实际房间名。
- 房间内容按波次显示怪物，保留 NPC、采集实体、自动掉落和结构化效果；多波不跨波合计，重复采集可合并数量，女神/泉水不能只剩房间名而丢掉效果。
- 采集沿 `spObj.caijiTypeId → roomCollect → roomCollectType → reward`；`mode:equip` 是可追踪的固定装备，`mode:equipGroup` 是随机池，展示类型/品质不证明某件装备实际掉落。
- 首通、结算、特殊、BOSS、房间箱子等按配置区分。`showReward` 名称统一“副本预览掉落”，只与当前关卡真实结算/BOSS 链匹配，不能按同名补造宝箱或采集来源。
- 特殊、结算、预览掉落默认折叠，首通直接展示；来源直达展开相应区块，房间定位同步候选。重复路线引用同一奖励组不叠加概率，不把前一关卡箱子复制到后一关或噩梦。
- 普通滚轮交给详情内部滚动；Ctrl/Meta+滚轮才缩放。封面近视口加载且保留占位，图片优化不重编码原图。
- `map/q` 筛选，`battle` 打开详情；`drop/dropTab/dropEntry` 定位物品、奖励区或房间，`dropTab=settlement|first|rooms`，旧 `chest` 保持兼容。物品叠加 `itemId` 后可返回原关卡位置。

提取输入、房间过滤、结构化效果、掉落去重和来源定位细节见 [副本图鉴](features/DUNGEONS.md)。

### 关卡图鉴

入口 `/chapters`，页面 `ChaptersView.vue`。先取 `parsed/chapters.json` 章节与关卡索引，打开关卡再取 `parsed/stages/{stageId}.json`，不把全部房间与掉落放进首屏请求。数据来自完整原表 `chapterInfo/area/levelStage/battle/room`，不使用副本专用的裁剪表。

- 章节来自 `chapterInfo.json`（`c0`～`c5`）与 `area.datas[spN_map]`（幽夜古堡、黏滑溪谷）；关卡顺序取 `area.map.levelStage`，与游戏章节地图一致，不按 ID 排序。
- 每个关卡按 `battle1/battle2/battle3` 展开简单/普通/困难。三难度的房间配置各自独立（`roomTypeId` 带难度后缀），不能合并成一份布局；体力、限时、推荐等级与奖励组逐难度取值。
- 解锁文案按源码 `LevelStageShowPanel` 生成：普通看 `chapterInfo[chapter].exBattleOpenCondition`，困难看是否通关普通；不把地图连线或 `hide` 当作解锁前置。
- `hide: true`（92 关中 74 关）在游戏里是「未解锁时在地图上隐藏」。本站不连账号，**不做解锁模拟**，一律正常展示。
- 房间、怪物波次、采集物与掉落复用副本图鉴的解析与展示组件（`roomDisplay.js`、`RoomContentList.vue`、`RewardPools.vue`），不另写一套；怪物按波次分行，采集与自动掉落按奖励池展示，随机候选房间标明候选而非必然遭遇。
- 搜索覆盖关卡名、短号、描述与构建期汇总的 `searchText`（含奖励物、怪物与采集物名称），因此可以按掉落反查关卡。难度筛选按该关卡实际存在的难度判断。
- 黑名单按副本图鉴的同一口径处理：命中地区名（如黑森林、霜烬平原）的章节整章不出现在筛选按钮与列表中，避免按钮与内容不一致；直接链接同样不打开被隐藏的关卡。
- URL：`chapter` 选章节（缺省 `all`）、`stage` 打开关卡详情、`diff` 选难度、`q` 同步搜索。关闭详情只清理 `stage/diff`，保留章节与筛选；奖励与材料只追加 `itemId`。
- 列表为单列虚拟网格，与任务图鉴同构；换章节后由 `UiVirtualGrid` 自行把列表滚回顶部，页面不额外滚动（用 `scrollToItem` 会以居中方式滚动整页，把上方的地图推出视口）。
- **关卡列表的显隐按端区分**：手机端常驻（没有地图，列表就是主视图）；桌面端属于列表视图——选定章节（或输入搜索词）才出现，未选章节时整块区域是地图，筛选面板与列表都不渲染。搜索词的例外是为了保住「按掉落物反查关卡」：在「全部」下输入搜索词会切到列表视图并跨章节出结果。

### 章节地图

`/chapters` 的主视图是游戏原版的世界地图（底图 + 章节拼块），点击地区切换章节。

- **地图视图与列表视图是两屏，互斥**：桌面端「未选章节且没有搜索词」时整块区域只有地图（不出现筛选面板与列表）；点地图上的地区切到列表视图，地图不再出现；点章节行的「全部」回到地图视图。
- **地图只在桌面端出现**：手机宽度下拼块里的章节名只有约 9px 高、读不清，一张读不了的地图占掉大半屏反而更差；手机端直接给关卡列表，用章节按钮切章节。断点与 `ChapterMapCanvas` 内的 `767px` 判断一致。
- 地图铺满内容栏：画布宽 100%、高对齐**左右两侧面板的底部**（不取视口底——两侧面板要留底部安全区，比视口底还高一点，按视口算画布会比面板长出一截）。底图是正方形而区域是长方形，所以画布内部放一个正方形**舞台**按 cover 缩放居中，超出画布的部分裁掉——裁掉的是边缘云朵，大陆本身不动。**命中判定必须用舞台矩形换算**（舞台可能比画布大），不能用画布矩形。
- 画布高度按**实测**算出（`左右面板底部 − 画布顶部`，取不到面板时退回 `视口底 − 10`），不用 `100dvh − 常量`：常量估偏几像素画布就会比面板高，看起来没对齐。
- 900px 的高度上限是为了限制裁切量：舞台取画布宽高中的较大者，视口越高裁得越多，超过约 900px 会开始啃到大陆边缘而不是云朵。
- 画布描边沿用全局 `.paper-panel`（与左侧导航面板同一套 2px 描边、阴影与圆角），不另写一套面板样式。
- 幽夜古堡、黏滑溪谷不在世界地图上，由页面通过画布的 `extra` 插槽在地图视图里补入口——否则地图视图没有任何路径能进这两个章节。
- 底图 `map_w1_bg.png`（1680×1680）与 6 块章节彩色拼块来自 `ChapterPanel` 预制体；拼块在底图上的坐标**不是配置项**（prefab 导出里没有 Transform 节点），由模板匹配测得并固化为构建期常量，见 `scripts/parse/chapterMapLayout.mjs`，重测入口 `scripts/dev/measure-chapter-map-tiles.mjs`。底图换图或换尺寸必须重测，不能沿用旧值。
- 命中判定用构建期烘焙的**归属图**（`chapters.json.map.owner`，256×256 RLE，约 4.6 KB）：拼块包围盒互相重叠（c0 的框有 57% 被 c3 压住），矩形热区会点错章节；不透明区域之间也有重叠，所以归属按渲染顺序定。运行时按格查表，不用 canvas 取 alpha（原生端 CDN 跨域会污染 canvas）。
- 「世界地图 · 选择需要前往的章节」标题条固定在画布**左上角**（同时是「你在这里」的标识），折叠开关在右上角，当前章节标签在底部居中；三者都 `pointer-events: none`（开关除外），不挡地图点击。
- 拼块只渲染可见章节：被黑名单隐藏的地区不出现，该区域保持底图原样（等同游戏里未探索的样子）。幽夜古堡、黏滑溪谷同样在模糊名单里（整章隐藏），世界地图上本来也没有它们的拼块；地图视图里的 `extra` 入口由 `visibleChapters` 推导，被隐藏后自动消失。
- 未选中具体章节时整张地图保持原色；选中后当前地区高亮、其余压暗，底部标签显示当前章节与关卡数。
- 画布 `aria-hidden`：地图是鼠标/触摸的快捷入口，等价的可聚焦控件是同一页的章节按钮，键盘用户用它切换；折叠开关是真按钮，放在 `aria-hidden` 之外。
- 手机端默认收起（拼块里的章节名在 390px 宽下只有约 9px 高，读不清，又占掉大半屏）；桌面默认展开，两端都可手动折叠。

章节关卡内部的房间路线图（`battle.layers[].map`，与副本同构）尚未渲染。

### 兑换

入口 `/exchange`，页面 `ExchangeView.vue`。读取 `parsed/parsed-exchange.json`，内容来自 `itemExchange/reward/consume/item`，入口判断关联 `shop/general/packDisplay/activityList/condition/task`。

- 兑换表有记录不代表实装。地区、种子、兔子、积分、时装和补给必须与当前正式入口求交集；页面、全局搜索、物品来源共用可见性索引。
- 委托、地区商店、兔子、活跃、商店积分、种子、每日补给、爬塔、PVP、通用兑换按正式入口组织。地区共用商店不复制，停用工资、测试组、无入口商店与礼包不展示。
- 商城入口依 `packDisplay` 可见配置排列；时装按 `shop.skins.heroSkin → skin.heroTypeId → hero.name` 关联，封面严格用 `shop.skins[].img` 商店原图，不猜角色立绘。
- 商品视觉复用 `UiExchangeTrade`：普通、商城、礼包、时装选择对应变体。材料与价格来自消耗表，限购只表达配置上限，不显示账号剩余、售罄或已拥有。
- 种子区分固定/随机候选，解锁条件沿 `showCondition → condition → task`；兔子按品质筛选。刷新规则取完整候选池，不受当前筛选裁剪，候选池全部商品不意味着每次同时售卖。
- 种子/兔子规则集中在规则页，保留抽选、购买数量与解锁条件；其他兑换保留各自限购/开放时段。符石合成在符石页，锻造随机配方在设施页，均不作为普通兑换重复展示。
- `cat/sub/q` 筛选，`rarity` 主要用于兔子，`view=rules` 用于种子/兔子。旧 `cat=fashion` 迁入 `shop/fuZhuang` 并保留其他参数，`cat=gem` 回落有效分类，`sub=all/s1` 兼容。
- 商品使用 `itemId` 打开详情。兑换与其他奖励页当前并存 PVP 兑换入口，属于尚未统一的产品入口，文档整理不代为更改功能。

### 模拟招募

入口 `/gacha`，页面 `GachaView.vue`。角色池与魔物蛋池均为本地模拟，钱包、持有、碎片、保底和记录不代表游戏账号数据。

- `parsed/gacha.json` 提供候选、权重、保底、消耗、赠品和概率说明；`gacha-presentation.json` 提供立绘、骨架、皮肤、台词等展示信息。规则和演出分离，页面不重新读原表。
- `gachaSim` 生成完整结果并处理已确认保底与重复转化，`gachaState` 管持久化。未证实的服务端 `secondSafeMin/secondSafeMax` 不猜测实现，也不把模拟称为真实服务端复刻。
- 角色池经历卡池、翻卡、揭晓、结果一览；蛋池经历卡池、开袋/逐蛋揭晓、奖励结算。蛋池不套用角色翻卡界面，两种结算分别消费相应结果。
- 手机触摸设备的竖向窗口由 `GachaViewport` 整页横置显示，用户横拿手机使用；覆盖层、按钮和演出保持同一坐标系，转为横向窗口后自动恢复。Spine 揭晓小人按 CSS 画布尺寸和统一设计坐标计算，脚点固定在台座上。
- 跳段/跳过只影响演出，不删除完整结果或二次抽样。资源加载失败/WebGL 不可用时仍保留结果并允许结束演出；蛋池结算合并蛋与卡池赠品。
- `GachaStage/gachaLayout` 管统一画布和缩放：窗口变窄时按宽高共同限制等比缩小，卡池按钮、演出和结果保持完整；宽屏演出可延展背景。样式在 `gacha.css`，业务组件不进入公共 UI 出口。`gachaSpinePlayer` 管播放和资源生命周期，`gachaAudio` 管 BGM/音效，离开页面释放所属资源和监听。
- `kind=hero|pet`、`pool=<poolId>` 同步卡池；`view=pool` 打开概率，`view=record` 打开记录，保留其他 query。概率文案沿原表，来源可定位到指定池。
- 当前生成器依赖已有候选/权重产物增量补展示与初始钱包，尚不能据此认定能从零重建全部卡池。卡池维护必须先确认上游产物完整。

模块对应关系、素材、取景、音频和演出验证见 [模拟招募](features/gacha/GACHA.md)，不在 SPEC 重复维护逐面板坐标与调参历史。

### 其他奖励

入口 `/rewards`，页面 `RewardsView.vue`。读取 `parsed/parsed-pvp.json` 和 `parsed/parsed-hidden.json`，育室槽位消耗取配置。包含挑战赛奖励、隐藏物品点位、育室槽位和战斗规则。战斗规则替代原“占位奖励3”，入口为 `tab=combat_rules`（兼容旧 `tab=ph3`）；使用 `CombatRules.vue` 展示 `config/combatRules.js` 中面向玩家的解释与例子，以冷却、攻速等上限开篇，再介绍伤害、养成和模式规则。复用章节组件与赛事规则纸面，按条目搜索并保留 `q`，不依赖奖励接口成功才显示。维护公式依据仍集中在战斗公式专题，不把源码字段、审计过程或未经确认的装备效果当成玩家规则。

- 挑战赛展示兑换、段位、排名、战斗结算和赛事说明。段位保留积分门槛，结算保留胜负积分；规则使用正式 `sessionDes/pvpArea[].des`，排除测试文案、内部模式 ID 与可能过期的赛季时间。
- 隐藏点位按地图、名称和本地收集状态筛选，状态存 `collectedHiddenRewardIds`，不反映账号领取。点位预览由 `HIDDEN_PREV_MAP` 维护，有图才显示，重建不丢映射。
- 育室槽位按原配置展示银币/氪金扩建费用，图标复用奖励映射，不模拟账号已开槽位。
- 战斗规则保留完整算法，按“章节标题 → 中文公式 → 必要说明”直接排版，不拆成摘要卡片。属性上限仍放最前；多行公式逐行显示，`atk/def/hp/dex` 等名称映射成攻击/防御/生命/敏捷，数值运算写“取整”并说明去掉小数、不作四舍五入。宠物七项公式、百分数单位及特殊召唤物例外一并保留，搜索结果也不得把公式拆碎。
- `tab/sub/season/map/status/q` 根据当前分类同步；`id` 定位并高亮奖励区块。物品只追加 `itemId`，预览使用全局 `UiModal`，不恢复旧的手写低层级遮罩。

### 右栏吉祥物

吉祥物不是独立页面，是普通桌面页面按需加载的辅助插画。应用壳决定可见性与加载，角色配置、SVG 装配缓存和动作由对应工具维护；选择层使用公共覆盖层，不能影响当前查询或详情返回。角色装配、握点、动作及资源适配见 [右栏吉祥物](features/SIDEBAR_MASCOT.md)。

## 四、详情与 URL

| 参数 | 用途与维护方 |
| --- | --- |
| `itemId` | 全站物品详情，`App.vue` 监听，使用真实物品 `typeId` |
| `id` | 家具、角色、魔物、怪物、魔物蛋详情；在成就/菜谱/其他页是定位，不统一当成弹窗 |
| `task` | 任务详情 |
| `event/explore` | 事件/探索详情 |
| `battle` | 副本详情，掉落定位参数见专题 |
| `chapter` / `stage` / `diff` | 关卡图鉴：章节筛选、关卡详情、难度选择 |

- 列表点击通过 query 打开详情，保留当前路由和其他筛选；全局物品入口不强跳 `/items`。关闭仅清理自身参数，父详情和筛选保持。
- `openItemDetail(item, categoryTree, savedScrollTop=null)` 全新打开时清空历史；详情内 `pushItemDetail(item, bodyScrollTop)`/`popItemDetail()` 保存上一件物品与正文位置，新物品置顶，返回恢复。
- 页面详情与全局物品嵌套时由共享协调器保存外层位置，最后一层关闭后恢复；切页先清理旧操作。覆盖层层级、原生返回和滚动生命周期统一见 [UI 使用规则](UI_COMPONENT_LIBRARY.md#3-使用规则强制)，不在页面复制实现。

### 定位参数与历史行为

本项目使用 Hash 路由，例如 `/#/tasks?task=<任务ID>&itemId=<物品ID>` 表示任务详情上再打开一个物品。query 应放在 Hash 路由内，而不是部署地址的普通路径参数中。

| 场景 | 参数含义 |
| --- | --- |
| 家具/角色/魔物/怪物/魔物蛋详情 | `id` 是各自业务 ID；页面不能把别的分类 ID 当成当前详情 |
| 成就/菜谱/其他奖励 | `id` 主要用于卡片/区块定位高亮，不要求都打开弹窗 |
| 设施营地建筑/研究 | 建筑 `level` 是当前级，研究 `level` 是目标级；其余参数见页面契约 |
| 符石 | `focus` 是列表物品，鉴定 `id` 是物品，合成 `id` 是兑换方案，不能混用 |
| 副本来源 | `battle/drop/dropTab/dropEntry` 保留关卡、物品和实际房间/奖励区定位 |
| 招募 | `kind/pool` 选择卡池，`view=pool` 或 `view=record` 区分概率与记录 |

页面首次加载应在数据可用后再解析详情目标；虚拟列表使用异步 `scrollToItem` 定位并等待测量/挂载完成，不等待未可见目标自行出现在 DOM。前进/后退沿当前 URL 恢复业务选择；无效参数按页面已有校验处理，不按相似名称猜目标。筛选只对各页明确支持的 query 同步，邮件等本地状态不擅自新增协议。

物品详情的“返回上一件”和“关闭物品层”是不同操作。`openItemDetail(item, categoryTree, savedScrollTop=null)` 用于新入口；`pushItemDetail(item, bodyScrollTop=0)` 在内部关联物品间前进，`popItemDetail()` 恢复上一件及其正文位置。正文滚动与外层页面滚动分别保存，不能用一个 `scrollTop` 覆盖两层。

页面详情与全局物品叠加时，关闭内层只移除 `itemId`，保留 `task/battle/id` 和筛选；跨页面导航则清理旧操作与覆盖层状态。Android 返回交给共享覆盖层栈，只处理最上层；无覆盖层时保留 WebView 历史返回，不添加“回到默认页即退出”的页面判断。

## 五、数据与来源

原表与构建前置、环境变量、同步命令统一见 [项目 README](../README.md#构建前置与原表维护)。`raw/` 不入库、不进入 dist；`public/data/parsed/` 是运行时派生产物，`dialogs/taskDialogs` 是剧情，`notice.json` 是实时公告。兼容原表输入与供下一轮构建的中间表不能被误当成浏览器请求路径。

- `raw/mon.json` 保留完整原表；`cirtDam → critDam` 和头像修正在 `scripts/parse/shared.mjs` 内存中完成。同步可更新已核对版本的完整原表，但不得用任务裁剪版覆盖 `battle/room`，也不得覆盖副本提取输入或塔层索引。
- 构建期完成多表关联，运行时只读取预解析产物与透传小表。索引与详情分离、缓存与 hash 校验由 [架构文档](ARCHITECTURE.md#43-数据流) 定义；解析失败显示错误态，不回退浏览器端重建。
- `npm run search:update` 重建搜索/来源/类型文件，重算副本来源并合并已有 PVP/隐藏产物。完整数据再生成用 `npm run data:build`；`gacha.mjs` 的候选池仍依赖已有上游产物，不能把增量补字段当成从零生成卡池。
- 来源只反查可达正式入口与实际产物，排除零权重/数量、测试奖励和随机装备预览；奖励存在不等于玩法已开放。容器从已有入口可达，采集沿正确外键，塔层与分解按实际产物合并。
- 来源产物只保留简短获取方式和实际消费的定位字段；保留必要概率、采集位置、首通与研究等级限制，不复制任务全文、全部费用或内部审计标签。没有真实详情页时不显示“前往”。

### 构建产物与数据链

构建脚本先读取 `raw/` 完整原表，再写入 `public/data/parsed/`。常用产物及其职责如下：

| 产物 | 内容与消费者 |
| --- | --- |
| `items.json` / `furniture.json` | 物品、分类、家具外观、图纸和开放条件，供物品/家具/装备页 |
| `heroes.json` / `pets.json` | 角色、皮肤、邮件与魔物模型，供角色/邮件/魔物页 |
| `monsters.json` / `monLevelStrength.json` | 正式怪物形态、技能摘要与等级系数，详情按需加载后者 |
| `facilities.json` / `runes.json` | 设施配方、营地建筑与研究、符石效果及方案 |
| `achievements.json` / `pet-eggs.json` | 成就与奖励、本地收集筛选所需字段、魔物蛋收益 |
| `parsed-pvp.json` / `parsed-hidden.json` | 挑战赛、隐藏点位及预览关联 |
| `recipes.json` / `tasks.json` | 菜谱材料、Buff、任务步骤和后续关系 |
| `events.json` / `parsed-exchange.json` | 随机事件、探索、兑换入口与随机池 |
| `dungeons.json`、`dungeons/{battleId}.json` | 副本摘要与关卡详情，按关卡懒加载 |
| `chapters.json`、`stages/{stageId}.json` | 章节与关卡索引、关卡详情（三难度 + 房间/怪物/掉落），按关卡懒加载；索引另含世界地图的底图、拼块矩形与命中归属图 |
| `gacha.json` / `gacha-presentation.json` | 招募规则与展示资源，运行时不重读原表 |
| `search-index.json` / `item-sources.json` | 全局搜索和物品来源反查 |

`scripts/parse/index.mjs` 负责常规页面产物；`scripts/parse/search.mjs` 重建搜索与来源索引；副本路线提取、副本房间效果、怪物塔层和模型导出是开发机按需执行的独立步骤。维护时需区分普通构建与这些前置步骤。资源 schema 和业务外键检查用于发现缺失或不合法字段；不能把空产物当成修复输入缺失的办法，也不能假定整条数据构建具备事务回滚能力。

### 来源与真实性边界

来源反查只接受可达的正式入口和实际产物：怪物掉落、任务/成就奖励、配方、采集、种植、事件探索、营地升级、PVP/隐藏奖励、副本和招募均沿真实外键生成。零权重、零数量、测试奖励、无入口礼包和随机装备预览不进入用户来源。`mode:equipGroup` 只能展示随机池的物品类型或品质范围，不能反推一件固定装备；容器必须从已有入口可达。

采集关系必须沿 `spObj.caijiTypeId → roomCollect → roomCollectType → reward`；塔层只写正式 Boss 的 `monRank=3` 或 `keyList` 含 `boss` 的配置。`raw/mon.json`、`battle.json`、`room.json` 始终保存完整版本，`cirtDam → critDam` 只在内存归一化。任何提取脚本都不得把裁剪版写回完整原表。

### 代码与资源版本

Android 将核心代码作为 Capgo 热更包，将图片和运行时 JSON 作为 CDN 优先、本地同版本回退的资源轨道。完整包仍必须包含 `data` 和 `images`，CDN 优先不代表可以删除离线资源。代码、数据清单和资源版本必须来自同一次构建；JSON 按 `data/parsed`、副本详情、剧情和任务剧情分组生成 hash 清单，校验失败、超时或格式错误时回退本地同版本文件。

热更新检查以 `CapacitorUpdater.current()` 的实际 bundle 版本为准，只有 ready 后才同步兼容显示键；下载或切换前不能提前写入新版本。完整发布验收用 `npm run verify`（包含数据再生成与构建），确认 `dist/data`、`dist/images`、清单及 zip 根目录结构完整。Web 同域数据版本冲突应显示更新错误，不静默混用旧缓存。

### 原表、派生输入与维护步骤

完整再生成依赖三类输入：`raw/` 游戏原表、副本/塔层等预先提取的派生输入、剧情资源。它们不能相互替代：一份已裁剪的副本房间表可以服务路线生成，但不具备恢复怪物或任务全部引用的能力。原表同步先预览版本差异，再补缺或替换完整表；环境变量和命令参数见 [构建前置](../README.md#构建前置与原表维护)。

| 入口 | 作用与边界 |
| --- | --- |
| `scripts/dev/sync-raw.mjs` | 默认预览；`--apply` 补缺，`--apply --replace` 才更新已有完整原表与兼容别名，不覆盖副本提取输入和塔层索引 |
| `scripts/dev/check-task-data.mjs` | 默认只读；显式应用才补缺剧情、完整表及索引，不能写回任务裁剪版 battle/room |
| `scripts/parse/extractDungeonRoutes.mjs` | 从完整配置提取副本路线所需输入；不由常规构建自动执行 |
| `npm run data:dungeons:effects` | 维护女神/泉水等房间结构化效果输入，之后再生成副本 |
| `npm run data:monsters:tower` | 从完整 tower/battle/room 生成轻量 Boss 塔层索引，不复制全量来源到浏览器 |
| `npm run skins:export` | 离线导出皮肤模型 PNG 与清单；普通页面构建只验证并引用，不重新渲染模型 |
| `npm run data:build` | 运行当前解析入口，生成页面数据与关联产物 |
| `npm run search:update` | 重建搜索、来源与类型；重算副本来源，合并已有 PVP/隐藏产物，不替代全量数据构建 |

当前入口在找不到原始 `reward.json` 而存在 `parsed/items.json` 时可以跳过预处理并沿用已有产物。这只是有限的文件存在判断，不证明全部产物齐全、同版本或原表完整。新环境必须分别确认“前端能用现有产物构建”和“能从完整输入再生成”，不能用前者证明后者。

### 搜索与来源维护入口

全局搜索覆盖角色、物品/装备、家具、魔物/魔物蛋、成就、料理、怪物、任务、事件/探索、兑换和隐藏点位等既有类型。多词按空格切分后 AND 匹配，排序优先精确、前缀、包含；`useGlobalSearch` 管运行时查询，构建索引负责关键词和业务定位。

`searchData` 合并基础来源与 `supplementalItemSources/remainingItemSources` 等补充模块，实际产物筛选复用 `getObtainableRewardRules`。来源不仅要证明物品存在，还要证明入口可达；容器沿父物品打开已有详情历史，采集/研究保留位置或等级条件，营地升级来源用升级前等级，招募定位概率页。

修改来源规则要同时检查物品详情、搜索与目标页面 query。普通来源保存简短获取方式，特殊概率、首通、采集位置和必要产出限制保留；任务全文、重复费用和内部审计标签不塞进来源字段。来源模块输出的定位字段必须有消费方，没实现详情页的玩法只显示说明，不生成无效“前往”。

## 六、资源维护

当前开发机实际目录为项目同级 `E:\Desktop\html\myrzg\UI_Atlases`、`4.24路资源包`（图片），`Config_decrypted`（完整配置）、`GAoNano_decrypted`（剧情）和 `源码`（游戏源码）。所有图片默认使用原图；仅在用户明确要求压缩时执行压缩，询问压缩状态不构成授权。

- 原图备份根为 `E:\Desktop\html\myrzg\vue-myrzg备份-资源\`（images/fonts/ui/data）。压缩或替换前确认含当前原图，缺失先备份；核对相对路径和 SHA-256，不能用 FORCE 绕过。备份放在 public/images 外。
- 按原图集或业务目录命名，保留大小写与拼写；`sprites` 是导出容器，不是归属名。通用图片多页共用，独立纹理保留避免重名所需的层级，不新建页面专属副本。
- 迁移目录同步代码、CSS、动态路径、解析产物、导入脚本和清单。原图/加工版、图集小图/Spine 整图、模型预览分别核对；同名不能作为删除依据。压缩和目录整理不作为构建自动步骤。

压缩工具默认只预览：

```powershell
node scripts/dev/compress-images.mjs
# 用户明确要求压缩、且原图备份校验通过后：
node scripts/dev/compress-images.mjs <public/images子目录> --apply --allow-lossy
```

可用 `--backup` 或 `MYRZG_IMAGE_BACKUP_DIR` 指定完整 images 备份根。PNG 调色板量化与 JPG 重编码均有损，不能称为无损；只在结果变小后写回，观感下降用已核验原图恢复。只读检查用 `audit-image-resources.mjs`，报告是当日结果，不写成永久“零重复”。

去重复用 `dedupe-image-resources.mjs`：默认只预览内容相同且全仓库无任何引用的副本，保留被引用的那一份；`--hash-suffix` 才把 `#编号` 重名导出副本纳入范围（它们与同目录同名文件像素不同，需人工确认）；`--apply` 先备份到 `../vue-myrzg备份-资源/dedupe-images-<时间>/` 并逐文件校验 SHA-256 再删除。只按内容与引用判定，同名或目录名不构成删除依据。

静态皮肤导出见 [工具说明](technical/SKIN_MODEL_EXPORT.md)。

### 图片种类与导入核对

- 图集精灵、Spine 整张纹理、独立立绘和导出模型预览用途不同。同名只说明命名相近，不证明像素、裁切、透明边或引用相同。
- 魔物蛋纹理使用 `public/images/eggs`；道具图标目录中的蛋图裁切不同，不能无条件互换。模型 `model-previews` 和 `skin-models` 是派生静态预览，不伪装为原图集素材。
- 家具图纸、皮肤模型、时装商店封面分别按其配置字段取图；缺素材时保留语义正确的占位，不能为了“都有图片”随意补相似图。
- 模型导出清单记录 `skeletonName/skinName` 与文件关联，构建器核验后写入 `skinUnlock.modelImage/skins[].modelImage`。导出工具的纹理补边与招募运行时的 atlas 适配是不同过程，完整说明见模型导出专题。
- 资源目录变更必须核对静态引用与动态拼接，再核对构建产物和导入清单；迁移规则不意味着所有历史目录已经迁完。只读重复检查给出当日证据，不作为删除未核对资源的依据。

## 七、开发与验收

### 修改前后如何核对

先检查工作区已有改动，再沿“页面 → 共享模型 → 构建器 → 原表/源码”确认归属。代码证据、配置数据与文案可能不同：先按实际字段和客户端读取方式解释，不把旧文档、截图、相邻 ID 或同名物品当成唯一依据。未确认的关系保持未知，既不要补造结果，也不要在没有证据时删除可能有效的数据。

| 改动范围 | 必要检查 |
| --- | --- |
| 纯文档 | 本地文件/章节链接、UTF-8、差异格式，核对现状与历史记录分开 |
| 配置/解析/来源 | 对应规则单测、原表完整性、schema/外键、相关产物、搜索/详情来源与定位一致 |
| 页面交互 | 相关桌面/手机场景、筛选/空态、冷链接、前进后退、嵌套详情和滚动恢复 |
| 公共覆盖层 | 键盘/原生返回、最上层关闭、重复开关、全局与内嵌叠加、安全区和正文可触达 |
| 原素材演出 | 正常流程/跳过/失败、结果完整性、窄屏取景、重复进入退出及资源释放 |
| 构建/发布 | 完整输入再生成、生产构建、数据与图片/清单同版本、离线回退、版本及包结构 |

运行与改动范围匹配的检查，不因文字调整重建游戏产物。完整发布验收和上传步骤见 [构建与发布](ARCHITECTURE.md#5-构建与运行)；`npm run verify` 包含构建，不能把它当成纯只读检查。构建写产物时不要同时运行读取同一生成目录的回归。

文档、脚本和配置统一 UTF-8。读写工具显式指定编码，避免按系统默认 GBK/其他编码误读后重存；只读编码检查为 `node scripts/dev/audit-text-encoding.mjs`。通过链接检查不代表业务文字正确，历史测试通过也不代表当前功能已经复测。

### 文档职责与保留标准

| 文档 | 应保留什么 |
| --- | --- |
| 本 SPEC | 足够了解全项目的功能、主要数据链、关键业务规则、URL、公共约束和维护边界 |
| ARCHITECTURE | 目录职责、依赖方向、请求/缓存、状态、构建与发布机制 |
| UI_COMPONENT_LIBRARY | 公共组件接口、主题、滚动、布局模板与业务皮肤例外 |
| features | 某个复杂功能的深入规则、特殊数据差异、资源/交互约束；总规范仍保留功能说明 |
| technical | 跨功能共用接口、概率语义，以及仍在使用的离线导出工具 |
| KNOWN_BUGS_AND_FIXES | 可复用的故障现象、根因、排查方法与适用范围 |
| dev-logs 与归档 | 当日修改/验证、旧审计、试错及历史状态，不作为现行规范正文 |

文档清理以是否帮助理解或维护为标准，不设“越短越好”的目标。业务公式、外键、限制、兼容行为和已知未解决问题有必要就保留；完整函数枚举、重复 CSS 常量、逐帧坐标和同一修复的多轮过程无需在 SPEC 再抄一份。总览可摘要关键规则并指向权威专题，避免读者必须跳遍专题才能知道项目做什么。

只有内容被替代、功能退休或纯属历史记录时才合并/归档；不能只因篇幅长删除，也不能只因被引用就认定每段都有用。旧说明保存在 [整理前摘录](../backups/audits-archive/DOC_DETAILS_2026-09-16.md)，用于追溯，不与当前规则并列维护。

阶段收口时同步对应权威文档和当日 [开发日志](dev-logs/README.md)，同一天复用一份日志，记录实际验证及未执行项。提交前保留用户已有改动、不混入无关内容；提交格式与范围见 [项目 README](../README.md#git-提交规范)。归档或文档修改不代表历史运行时问题已经修复。
