# UI 组件库规则（羊皮纸 Wiki 设计系统）

> 本文档规定全站 UI 的统一规范：普通 Wiki 页面/弹窗/按钮/信息框**必须从组件库引用**，
> 禁止在业务组件中复制基础样式；游戏原素材业务皮肤的例外见第四节。设计沿用羊皮纸 Wiki 主题；现行样式源为 `theme.css`。

## 1. 设计系统（theme.css）

位置：`src/assets/theme.css`，由 `main.js` 全局引入。所有颜色一律使用 CSS 变量，
支持亮色（羊皮纸）/ 暗色（暗木羊皮卷）一键切换（`.dark-mode`）。

### 1.1 调色板

| 变量 | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `--paper-dark` | `#bba282` | `#211710` | 外围深羊皮纸 / 页面底 |
| `--paper` | `#dfceb3` | `#2e2217` | 亮羊皮纸（面板主色） |
| `--paper-soft` | `#e9dcc3` | `#362a1d` | 卡片/输入底 |
| `--paper-solid` | `#d9c6a6` | `#3f3020` | 不透明底（内嵌块） |
| `--text-main` | `#3e2a14` | `#eaddc2` | 深棕墨水（正文） |
| `--text-muted` | `#6b5134` | `#bca983` | 次要文字 |
| `--text-faint` | `#8a6d4d` | `#9c8a6c` | 弱化文字/占位符 |
| `--on-wood-text` | `#dfceb3` | 同亮色 | 木质顶栏、弹窗标题、导航和悬浮按钮的亮色前景 |
| `--on-image-text` / `--on-image-text-muted` | 见 theme.css | 同亮色 | 副本封面插画上的标题与辅助文字 |
| `--border-color` | `#8f7351` | `#8f7351` | 描边 |
| `--border-soft` / `--border-faint` | 45% / 25% 透明 | 55% / 30% | 次级描边 |
| `--accent` / `--accent-bright` / `--accent-ink` | `#557574` / `#7a9a99` / `#2f4a49` | `#7a9a99` / `#93b3b2` / `#a8c6c5` | 湖青（主色/悬停/文本） |
| `--wood` / `--wood-soft` / `--wood-deep` | `#2b1f15` / `#463424` / `#1e150d` | `#17100a` / `#3a2c1d` / `#0f0a06` | 深原木（顶栏/标题条） |
| `--danger` / `--danger-soft` | `#8b0000` / 10% | `#d24545` / 16% | 危险/极高 |
| `--gold` | `#8a6a1f` | `#c9a24b` | 暗金强调 |

### 1.2 品质（稀有度）系统 —— 灰/绿/蓝/紫/橙

| 品质 | 文字类 | 底色类 | 描边类 | 徽章类 |
| --- | --- | --- | --- | --- |
| 1 白 | `.quality-text-1` | `.quality-bg-1` | `.quality-border-1` | `.badge-1` |
| 2 绿 | `.quality-text-2` | `.quality-bg-2` | `.quality-border-2` | `.badge-2` |
| 3 蓝 | `.quality-text-3` | `.quality-bg-3` | `.quality-border-3` | `.badge-3` |
| 4 紫 | `.quality-text-4` | `.quality-bg-4` | `.quality-border-4` | `.badge-4` |
| 5 橙 | `.quality-text-5` | `.quality-bg-5` | `.quality-border-5` | `.badge-5` |

数值高亮文本（描述里的 `{数值}`）使用全局 `.value-highlight`。品质名称来自 `getRarityName`，不另造“史诗/优秀”等名称。

`--q1`～`--q5` 保留游戏原色用于品质框、徽章与激活底色；浅纸面文字使用 `--qN-text`，大块浅底使用 `.quality-bg-N`。插画上的小品质标签先垫不透明 `--quality-label-bg`，保证复杂背景上的可读性；品质样式不在页面重新定义。

`UiTabs` 在选项较多时保持单行横向滚动，右侧显示轻量滚动提示；移动端保留原生单指滑动，桌面端支持鼠标按住拖动，并用 4px 位移阈值避免拖动时误触页签。切换到不可见页签时自动滚动到可视区域，详情主体不得随页签产生横向滚动。

### 1.3 字体与可读性红线

- 标题与正文：本地 `HarmonyOS` 常规/粗体，分别使用 `public/fonts/HarmonyOS_Sans_SC_Regular.ttf` / `HarmonyOS_Sans_SC_Bold.ttf`（400/700）。伙伴邮件共用这两款字体；缺字或字体不可用时回落设备原生无衬线字体。
- 不从 Google Fonts 拉取字体，不引入 Cinzel、Noto Serif SC 或完整 `MYR2Sans` 游戏字库作为回退；保留 `font-display: swap`，字体不阻塞正文显示。
- **正文 ≥ 13px、行高 ≥ 1.6**；描述性文字用 `--text-main`/`--text-muted`；
  禁止浅灰低对比配色；暗色模式对比同样达标。
- 字体声明统一使用 `var(--font-ui)`。`--paper` 是背景变量，暗色模式会变深，禁止拿它当深木底或插画上的文字颜色。

### 1.4 全局背景

- 地图背景 `/ui/map_w1_bg.png` 铺在 `html,body`（避开顶栏偏移），
  面板统一使用半透明羊皮纸（`.paper-panel`），让地图透出。

## 2. 组件库目录（src/components/ui/）

统一从 `index.js` 导入：
```js
import { UiModal, UiSection, UiInfoRow } from '../components/ui/index.js'
```

重型按需组件例外：`UiVirtualGrid` 从 `components/ui/UiVirtualGrid.vue` 直接导入，仅随使用页面加载；不通过首屏使用的 UI 统一出口静态引入虚拟引擎。

| 组件 | 职责 | 关键 Props |
| --- | --- | --- |
| `UiButton` | 通用按钮 | `variant`(primary/secondary/ghost/danger/link)、`size`(sm/md/lg)、`block`、`disabled` |
| `UiSearchInput` | 搜索框（图标+清空）；在 `UiFilterPanel` 内自动显示右侧筛选折叠按钮 | `modelValue`、`placeholder`、`clearable` |
| `UiFilterPanel` | 搜索与可折叠筛选面板，默认展开 | `search` 插槽放搜索框；默认插槽放筛选项；`footer` 插槽放始终保留的表头等内容 |
| `UiFilterRow` | 筛选行容器 | `label`（如"稀有度："），插槽放 UiFilterPill；使用 `#right` 放计数/操作时，手机端会自动独占一行 |
| `UiFilterPill` | 筛选胶囊 | `active`、`quality`(1~5 可选)、`disabled`；悬停反馈仅作用于未选中项，选中项悬停时保持原有强调色 |
| `UiCollectionToggle` | 已收集/未收集状态开关（成就、隐藏点位等进度共用） | `active`、`@toggle`；内置点击阻止冒泡、键盘语义和无障碍状态 |
| `UiExchangeTrade` | 多列兑换卡片（普通、紧凑羊皮纸、礼包、商城商品和时装竖卡） | `title`、`rewardItems`、`consumeItems`、`limitText`、`metaText`、`packImage`、`skin`、`shop`、`compact`、`@item-click` |
| `UiSegmentedTabs` | 木刻分段页签（横向溢出时隐藏滚动条并显示右滑提示；手机单指滑动、桌面鼠标拖动，到达末端后提示消失） | `modelValue`、`options`(`[{value,label}]`) |
| `UiTabs` | 墨迹下划线页签（仅页签栏横向滚动；手机单指滑动、桌面鼠标拖动，并自动定位当前项） | `modelValue`、`options` |
| `UiCardGrid` | 数据网格容器（桌面进入页面文档流，移动端内部滚动） | `id`（供回到顶部定位）、`small`、`wide` |
| `UiVirtualGrid` | 基于 TanStack Virtual 的按行虚拟网格，复用 UiCardGrid 与实际 CSS 列数 | `items`、`itemKey`（默认 `id`）、`estimateSize`（默认 120）、`overscan`（默认 3 行）、`id`、`small`、`wide`；默认插槽 `{ item, index }`、空态插槽 `empty` |
| `UiItemCard` | 图鉴卡片（图标+名称） | `name`、`img`、`quality`、`@click`、`@img-error` |
| `UiModal` | 羊皮纸弹窗（内嵌详情覆盖与位置恢复；全局弹窗安全区、背景锁及覆盖层登记） | `visible`(v-model)、`title`、`fullscreen`、`scrollId`、`zIndex`、`maxWidth`、`closable`、`closeOnOverlay`、`teleportTo`（全局弹窗传 `body`，层级最低 12000） |
| `UiPopover` | 按钮上方的非模态选择窗，复用羊皮纸面板、覆盖层登记及窗外/Esc 关闭 | `visible`(v-model)、`anchor`（按钮 DOM）、`id`、`title`、`width`（720）、`zIndex`（6003）；默认插槽放选项 |
| `UiSection` | 详情章节（◆菱形标题，可选整章折叠） | `title`、`collapsible`、`open`（`v-model:open`），`title-end` 插槽 |
| `UiInfoRow` | 键值信息行 | `label`、`value`（或插槽） |
| `UiInfoPanel` | 信息面板（标题条+行组） | `title`、`media` 插槽 |
| `UiTag` | 小标签/徽章 | `tone`(default/accent/danger/gold/wood)、`quality`(1~5) |
| `UiRewardCard` | 奖励/掉落/材料卡；整卡采用横向羊皮纸结构，44px 图标槽只按 `targetQuality` 使用品质底色，不叠加槽位阴影或边框 | `rule`(`{targetName,targetImg,targetQuality,min,max,actualProb,typeId}`)、`clickable`、`@click` |
| `UiAccordion` | 手风琴折叠块 | `title`、`modelValue` |
| `UiProgressBar` | 木轨进度条 | `value`(0~100)、`label` |
| `UiEmptyState` | 空/加载/错误态 | `text`、`type`(empty/loading/error) |
| `UiPageHeader` | 页面大标题（装饰线） | `title`、`subtitle` |
| `UiBackToTop` | 回到顶部木钮（与移动导航共用悬浮按钮尺寸、边框、阴影和业务层级变量） | `scrollContainer`(选择器) |
| `UiListRow` | 通栏列表行 | `id`、`clickable`、`right` 插槽 |
| `UiStatGrid` | 属性数值网格 | `items`(`[{label,value,tone?}]`)、`doubleCol` |

搜索筛选区统一使用 `UiFilterPanel`，沿用 `filter-panel paper-panel` 布局与主题。`UiSearchInput` 在面板的 `search` 插槽内读取就近面板状态，右侧“收起／筛选”按钮控制默认插槽；`aria-expanded` 和唯一 `aria-controls` 同步更新，支持键盘操作，触屏按钮最小高度 44px。折叠使用 `v-show` 保留控件和已选条件，搜索、清空仍可用；展开状态仅属于本面板，不修改筛选 query，不写入账号或备份状态。魔物收益表头放在 `footer` 中，收起后继续显示。独立搜索框及顶部全局搜索没有下面的筛选区时不显示折叠按钮。

### 2.1 `UiExchangeTrade` 兑换卡片

组件统一维护商品视觉，页面只选择变体并传入预解析字段：

| 变体 | 用途与结构 |
| --- | --- |
| 默认 | 独立商品卡，标题/限购、规则、获得物品、消耗；多材料换行 |
| `compact` | 兑换页普通商品，3:4 纸卡，名称含数量、限购、图标与价格；长名单行省略但提供完整 title |
| `shop` | 商城，原纸卡/限购条/品质渐变，商品名、大图标、货币价格；不叠加重复数量 |
| `packImage` | 礼包横卡，左图右侧商品与费用；窄屏单列 |
| `skin` | 角色名、5:9 商店封面与品质名、奖励道具、货币价格；皮肤名常规字重 |

默认网格与紧凑商品列数不同：普通/商城紧凑页手机四列，默认两列，礼包单列，时装由页面限宽两列。尺寸由组件/页面现有样式维护，不在文档复制每轮像素调整。

图片经过 `getImageUrl`，点击统一发 `item-click`；图标保持比例，透明留白调整只作用于展示，不修改原图。多材料不能被隐藏，数量不能挤偏图标。限购显示配置上限，不模拟账号“剩余/已售罄/已拥有”。种子和兔子的刷新规则在页面集中展示，其他变体仍保留必要规则文案。
### 2.2 长列表与图片加载

- `UiItemCard.showName` 默认 `true`；邮件奖励使用 `false` 隐藏名称底板，数量复用 `extra` 插槽，品质背景框和 68% 图标比例与物品图鉴保持一致。邮件列表按钮局部固定悬停文字颜色，不改变公共 `UiButton` 行为。

- 角色皮肤由 `HeroSkinsPanel` 展示：桌面有模型时采用 42:27:31 的立绘/信息/模型三栏，来源标签独占皮肤名下一行；手机上方为立绘/模型两栏，下方展示名称、来源和属性。物品皮肤预览用等宽两栏（立绘与小人各半），图片保持 contain 完整展示，手机仍维持左右各半并降低高度。小人使用构建产物 `modelImage`，图片加载失败走统一有界回退，缺少模型字段时保留单立绘布局。

- 物品、家具与任务列表使用 `UiVirtualGrid`：保留完整总高度占位，只挂载可见行与前后预渲染行，稳定数据键与动态行高测量由组件处理。不能把 `slice(0, displayCount)` 持续追加 DOM 称为虚拟化；`useLazyList` 只用于较小列表的追加分页。
- 桌面固定以 `.app-container` 为滚动 owner，详情临时钳制时不得切换 owner；手机使用页面内部容器。筛选更换后重置顶部，响应式列数/宽度变化时重新测量。
- 程序定位使用组件暴露的异步 `scrollToItem(key/索引/匹配函数, options)`，不能对未挂载项目直接 `querySelector`。普通详情返回优先保留点击前位置；冷分享链接没有原锚点时才定位目标，不能覆盖正常嵌套返回。
- 副本封面使用近视口 IntersectionObserver 延迟赋值 `src`，配合 `loading="lazy"`、`decoding="async"` 及稳定宽高占位；不为了加载优化重新压缩用户现有图片。

### 2.3 `FurnitureCard` 家具卡片规范

- `FurnitureCard.vue` 是家具页按需加载的业务卡片，不进入通用 UI 出口。卡片使用稳定的正方形预览区、品质描边/底色、名称、图鉴分类、装饰值、放置范围和“有图纸”状态；目录桌面默认 5 列、手机 3 列，点击统一由父视图打开详情。
- 家具与外观缩略图只允许使用 `/images/BuildItem/{配置 icon}.png`。图标字段为空或资源请求失败时显示统一 `/ui/visibility-off.svg`；禁止回退到基础家具图，也禁止使用游戏房间中的场景立绘补图。
- `homeItem.objType` 决定卡片分类文案；来源标签 `sourceTags`、图纸外键、材料和皮肤选择均由 `furnitureData` 在构建期解析，卡片不得自行推断。
- 默认预览外观遵循源码 `FurnitureData.GetDefaltHomeItemSkin` 的配置/拥有顺序；普通家具图纸的图标遵循 `NewItemTips.SetItemDesc` 使用家具基础 `homeItem.icon`，皮肤图纸才使用指定皮肤 `icon`，两者不可混用。
- 家具详情首屏与角色详情采用一致的居中大图展示结构，整个大图区域按家具品质使用浅色品质背景，边框保持中性；`homeItem.category` 原值保存在 `sourceTags`，`c0~c5` 通过 `gameMappings.getMapName()` 生成 `sourceLabels` 后展示，禁止页面重复维护地图映射。

### 2.4 `AcquisitionRewards` 共用奖励区

- `src/components/AcquisitionRewards.vue` 是奖励业务组件，直接导入，不加入通用 UI 出口。接收 `acquisition`、可选 `title` 与 `costTitle`（默认「额外消耗」），统一渲染额外消耗、固定奖励、随机池、自选项和随机装备候选。
- 数据直接使用构建期 `item.acquisition` 或符石方案的同构规则；符石鉴定与物品/装备详情复用本组件。合成页按用户要求采用列表式卡片，直接使用同构规则和 `UiRewardCard` 展示单次材料，不复制解析。只触发 `item-click` 事件，父页面负责详情与历史，组件不修改路由。
- 基础视觉复用 `UiSection/UiTag/UiRewardCard`；图片统一经过 `getImageUrl`，空图不拼接无效资源路径；业务网格允许单列回落，禁止让长组标题撑出弹窗。
- `UiRewardCard` 的概率文案调用 `acquisitionRules.formatRewardProbability`，按用户要求保留两位小数，非零且小于 0.01% 显示 `<0.01%`；`isSelect` 优先显示“自选获得”；概率未知时不显示概率，零概率不显示必得。不得在其他页面复制同一套概率文案。页面布局见 [符石专题](features/runes/RUNE_CATALOG.md)。

### 2.5 `UiModal` 组件接口

| Prop | 类型 | 默认 | 说明 |
| :--- | :--- | :--- | :--- |
| `visible` | Boolean | `false` | 显隐 |
| `title` | String | `''` | 标题（未传 header slot 时生效） |
| `maxWidth` | String | `'100%'` | 系统级弹窗最大宽度；内嵌模式默认占满主视图区 |
| `fullscreen` | Boolean | `false` | 是否使用全屏滑入模式 |
| `closable` | Boolean | `true` | 是否允许关闭；不可关闭的更新窗消费返回但不退出下层页面 |
| `closeOnOverlay` | Boolean | `false` | 点击遮罩是否关闭 |
| `scrollId` | String | `'uiModalScroll'` | 内容滚动区域 ID |
| `zIndex` | Number | `500` | 业务弹窗层级；系统弹窗最低提升到 12000 |
| `teleportTo` | String / Boolean | `null` | 默认内嵌；系统级弹窗及全局图片预览传 `'body'` |
| `restoreScrollTop` | Number / null | `null` | 覆盖式详情打开前捕获的列表位置，优先于实时 scrollTop |

- Slots：`default`（主体）、`header`、`footer`。
- Events：`@update:visible`、`@close`。
- 默认不 Teleport，内嵌在中间主视图区且不遮挡左右栏；系统公告、关于、提示、更新及全局图片预览使用 `teleport-to="body"` 和统一全局遮罩。
- 桌面端内嵌详情打开前保存 `.app-container` 的滚动位置，关闭时直接移除覆盖层并通过共享协调器恢复，不等待离场动画；移动端继续使用内容区原生滚动。

```html
<UiModal v-model:visible="isOpen" title="标题">
  内容
  <template #footer><UiButton @click="isOpen = false">确定</UiButton></template>
</UiModal>
```

基于它的弹窗包括 `MenuModeModal`、`NoticeModal`、`VersionCheckModal`、`AboutModal`、`UpdateModal`，各图鉴详情，以及 `RecipesView` / `RewardsView` 图片预览。

## 3. 使用规则（强制）

业务组件的专属规则分别见 [右栏吉祥物](features/SIDEBAR_MASCOT.md)、[设施功能](features/facilities/CAMP_FACILITIES.md)、[符石图鉴](features/runes/RUNE_CATALOG.md)。以下约束适用于公共 UI；游戏皮肤例外见第四节。

1. **一切视觉从组件库引用**：页面/组件模板里的搜索、筛选、页签、网格、卡片、
   弹窗、信息行、奖励卡、按钮、空态、进度条必须用对应 Ui 组件；
   旧版手写 class（`.filter-btn`、`.segmented-pill-*`、`.item-card`、
   `.modal-overlay` 等）**不再允许新增**。
2. **页面 scoped 样式只保留业务特殊布局**（如立绘尺寸、特殊网格、图表），
   任何"面板底色/描边/按钮/弹窗"类样式视为违规重复。
3. **详情弹窗用内嵌 `UiModal`**（默认模式，铺满主视图区、周围不变暗）：指定唯一 `scroll-id`
   （如 `itemModalScroll`、`monsterModalScroll`）与 `max-width`/`:z-index`，配合 `UiBackToTop`；
   `fullscreen` 仅用于确需占满区域的场景，`teleport-to="body"` 用于系统级弹窗（公告/关于/提示/更新）及全局图片预览，最低层级 12000；业务页面详情使用 2000~3000，全局物品详情使用 5000。桌面端的 `.app-container` 是唯一页面级滚动根；详情绝对覆盖主视图区，打开时锁视口，正文内部滚动。剧情、左侧导航等真实内部滚动容器只滚动自身；地图仅在明确缩放手势下接管滚轮。移动端继续使用内容区原生滚动。
   内嵌详情打开时保持列表布局（`visibility:hidden`），关闭时同步移除覆盖层与视口锁，不执行交叉淡出。打开前捕获列表位置，嵌套层由 `modalScrollCoordinator` 统一管理；仅最后一层关闭时恢复，路由切换先重置。页面不得自建滚动保存/恢复逻辑。
   全局弹窗通过 `globalModalLock` 按 owner 锁背景；按 `100dvh` 和安全区限高，正文可滚动且头部、底栏可触达。`UiModal` 自动登记 `useOverlay`，其他覆盖层也须登记；Android 返回只处理最上层，更新下载等不可关闭状态消费返回。物品历史与 URL 规则见 [SPEC 详情与 URL](SPEC.md#四详情与-url)，故障根因与恢复时序见 [排障记录](KNOWN_BUGS_AND_FIXES.md)。
4. **深色模式零覆盖**：组件内禁止写 `.dark-mode` 覆盖规则，主题变量随 `html.dark-mode` 自动切换；唯二例外——① 暗色下的对比度必要微调（优先引用主题变量，如 `--accent-bright`/`--wood-soft`；暗色专用表面色可用硬编码，如输入框聚焦底色）；② 覆盖不得改变品质色/强调色的语义与行为。凡新增暗色覆盖，需在样式旁注释动机，避免变成无法维护的色值堆叠。
5. **兼容组件**：旧 `BaseModal`/`BackToTop` 兼容壳已移除，所有代码直接使用 `UiModal`/`UiBackToTop`。
6. **新增组件流程**：先放 `src/components/ui/`，实现羊皮纸样式（只用 theme.css 变量），
   通用轻组件在 `index.js` 导出；重型按需组件可直接文件导入以保留页面分包，并同步更新本文档组件表格及例外说明。
7. **可读性**：中文正文不得小于 13px；小标签可 11-12px 但需加粗；正文颜色禁止脱离
   `--text-main`/`--text-muted` 体系；长文本容器必须 `word-break`/`line-height ≥ 1.6`。
8. **滚动提示**：横向分段栏与桌面导航等隐藏原生滚动条的区域，必须保留滚轮、触控板或触摸滚动能力；仅在内容真实溢出且尚未到达滚动末端时显示方向提示，到达末端后立即隐藏。

## 4. 页面骨架模板

### 4.1 普通 Wiki 页面

> 说明：页面标题由全局 App 顶栏（`App.vue`）提供，**页面内不要再加 `UiPageHeader`**；
> 网格自定义列数用页面 class 覆盖 `.ui-card-grid`（如物品 7 列 `items-card-grid`）；
> 详情弹窗为内嵌模式（默认非 fullscreen），用 `max-width` + `scroll-id` + `:z-index`。

```vue
<template>
  <div class="page-view-container">
    <UiFilterPanel>
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索名称..." />
      </template>
      <UiFilterRow label="大类：">
        <UiFilterPill :active="selectedMain === null" @click="selectMain(null)">全部</UiFilterPill>
        <UiFilterPill v-for="cat in categoryTree" :key="cat.type"
          :active="selectedMain === cat.type" @click="selectMain(cat.type)">{{ cat.name }}</UiFilterPill>
      </UiFilterRow>
      <UiFilterRow label="稀有度：">
        <UiFilterPill v-for="r in [1,2,3,4,5]" :key="r" :quality="r"
          :active="selectedRarity === r" @click="selectedRarity = r">{{ getRarityName(r) }}</UiFilterPill>
      </UiFilterRow>
    </UiFilterPanel>

    <!-- 网格：class 自定义列数（如 items-card-grid=7列）；wide=宽卡；small=小图标卡 -->
    <UiCardGrid id="itemsGridScroll" class="items-card-grid" v-if="isDataReady">
      <UiItemCard v-for="item in filteredItems" :key="item.typeId"
        :img="getImageUrl(getItemImageUrl(item))" :name="item.name" :quality="item.quality"
        @click="handleItemClick(item)" @img-error="handleImgError" />
      <UiEmptyState v-if="filteredItems.length === 0" text="无匹配物品" />
    </UiCardGrid>
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />
    <UiEmptyState v-else type="loading" text="数据加载中..." />
    <UiBackToTop scroll-container="#itemsGridScroll" />

    <!-- 详情弹窗：内嵌覆盖（默认非 fullscreen），max-width + scroll-id + z-index -->
    <UiModal v-model:visible="detailVisible" :title="selected ? selected.name : '详情'"
      max-width="820px" scroll-id="pageScroll" :z-index="2000">
      <template v-if="selected">
        <UiSection title="基础信息">
          <UiInfoRow label="类型" :value="selected.type" />
        </UiSection>
        <UiSection title="奖励">
          <UiRewardCard v-for="rule in selected.rewards" :key="rule.typeId" :rule="rule" @click="..." />
        </UiSection>
      </template>
      <UiBackToTop scroll-container="#pageScroll" />
    </UiModal>
  </div>
</template>
```

脚本导入示例：`import { UiFilterPanel, UiSearchInput, UiFilterRow, UiFilterPill, UiCardGrid, UiItemCard, UiEmptyState, UiBackToTop, UiModal, UiSection, UiInfoRow, UiRewardCard } from '../components/ui/index.js'`

### 4.2 游戏原素材业务皮肤

模拟招募与伙伴邮件阅读器允许在业务组件内使用游戏贴图与局部配色，不进入公共 UI 出口，也不改变其他页面的主题。数据获取、奖励规则、资源路径和通用交互仍复用共享工具。

- [模拟招募](features/gacha/GACHA.md)：独立全屏布局，使用 `GachaStage` 和专属面板，不套用羊皮纸网格或详情弹窗。
- [伙伴邮件](features/PARTNER_MAIL_SKIN.md)：固定阅读器与内部滚动，公共按钮和奖励卡保留；信纸局部配色不随暗色主题反转。

具体切片、资源来源和布局参数只在专题及对应代码维护。

## 5. 验收清单（每次改动自查）

按改动范围执行对应检查；功能特有场景见各专题。模拟招募保持启用，其回归入口见 [模拟招募专题](features/gacha/GACHA.md)。

- [ ] 无不当 `.dark-mode` 覆盖、无重复基础样式
- [ ] 滚动容器 id 正确，回到顶部可用
- [ ] 空/加载/错误三态齐全
- [ ] 品质着色（文字/底/描边）与品质一致
- [ ] 正文 ≥ 13px、行高 ≥ 1.6、深色模式可读
- [ ] `npm run build` 通过
- [ ] 涉及滚动、弹窗、地图或响应式布局时，`npm run test:ui` 通过
- [ ] 全局弹窗层叠时背景不滚动，长内容/横屏下关闭和底栏可触达，安全区不遮挡
- [ ] 原生返回只关闭最上层，详情 query 与嵌套历史同步，监听注册/卸载无残留
