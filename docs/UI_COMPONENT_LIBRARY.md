# UI 组件库规则（羊皮纸 Wiki 设计系统）

> 本文档规定全站 UI 的统一规范：所有页面/弹窗/按钮/信息框**必须从组件库引用**，
> 禁止在业务组件中复制基础样式。设计源于项目根目录 `ui模板.html`（羊皮纸 Wiki 主题）。

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

数值高亮文本（描述里的 `{数值}`）使用全局 `.value-highlight`。

`UiTabs` 在选项较多时保持单行横向滚动，右侧显示轻量滚动提示；移动端保留原生单指滑动，桌面端支持鼠标按住拖动，并用 4px 位移阈值避免拖动时误触页签。切换到不可见页签时自动滚动到可视区域，详情主体不得随页签产生横向滚动。

### 1.3 字体与可读性红线

研究树地图滚动容器复用副本地图的 `--paper-dark`、`--border-soft` 1px 边框及 6px 圆角；滚动条隐藏，鼠标拖动超过 4px 时移动地图并阻止误点节点，触摸保留原生滑动。

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
| `UiSearchInput` | 搜索框（图标+清空） | `modelValue`、`placeholder`、`clearable` |
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

### 2.1 `UiExchangeTrade` 兑换卡片规范

- 兑换页普通商品使用 `compact` 紧凑变体：保留主题羊皮纸底板、边框与分隔线，顶部名称和获得数量居中，限购在下一行靠右；奖励图标和底部消耗材料去掉独立底框，底部居中且不显示“消耗”或乘号。多奖励在标题列出名称与数量，多材料自然换行；规则说明保留。页面普通商品与商城商品统一桌面最小列宽 110px、手机四列；手机采用用户确认的紧凑字号，礼包与时装保留各自布局。以下默认卡片规则用于未启用变体的调用方。
- `compact` 与 `shop` 保持相同 3:4 外框比例和列宽；边框加留白的总占位均为桌面 6px、手机 3px。长名称按用户最新要求保持单行省略，并提供完整 `title`。普通卡片标题区高 42px/30px、价格区至少 24px/20px；商城沿用 42px/26px 和 30px/20px。普通限购标签采用弱底色/淡边框与 `--text-muted`，价格改用 `--text-main`，字号 15px/12px；去掉图标上方分隔线，只保留淡化的底线。普通图标根据原 PNG 的可见区域等比微调（alpha > 24 包围盒，目标占画布 84%，比例限定 0.9~1.14），仅调整展示比例，不修改或压缩原图。种子和兔子的说明统一移到独立“刷新规则”页签，使用 `UiSection`、`UiListRow` 和 `paper-panel` 展示；其他调用方如有说明或多材料仍需保留完整内容。
- 每条兑换记录必须是一个独立卡片，页面通过业务网格多列排列；不得把多条记录拼成一条横向大行。
- 普通卡片内部固定为「顶部标题/限购 → 可选规则说明 → 中部获得物品 → 底部消耗物品」顺序；`metaText` 以原有单行文字承载随机规则、每次购买数量等说明，不再拆成带底色的信息行。获得物品图标在奖励芯片内保持几何居中，数量脱离布局流固定在芯片右下角，不影响图标居中；底部“消耗”标签居左，消耗芯片从标签后方开始左对齐。卡片使用轻量内高光、分隔线和奖励区浅底色建立层级，不额外显示“兑换”文字。消耗物品必须允许换行，不能用横向溢出隐藏多材料；普通奖励图标使用紧凑尺寸，避免单个图标撑高卡片。
- 礼包补给使用 `packImage` 横向变体：左侧为礼包图，右侧依次展示标题/限购、礼包物品和消耗；礼包物品使用更紧凑的图标芯片。礼包分类网格需提供至少 300px 的桌面卡片宽度，移动端单列展示以保持横向结构。
- 普通桌面网格卡片最小宽度 180px、间距 12px；手机端保持两列、间距 8px。装备制作页面可由页面网格提供固定行高与固定获得区，保证同一行图标基线一致；PVP 页面可通过页面 scoped 规则使用紧凑奖励图标。组件自身高度填满网格行，避免相邻卡片跳动。
- 物品图标点击统一触发 `item-click`，图片路径必须先经过 `getImageUrl()`；名称、数量和限购正文使用不低于 13px 的主题变量颜色。

商城商品变体通过 `shop` 启用，供氪金商店、星型徽印、翼型徽印和回忆结晶共用：采用游戏 `PackCenterTempUI` 的 3:4 纸卡比例，`shop_list_pack.png` 九宫格底板、`shop_tag_quota.png` 绿色限购条和首个奖励品质对应的 `/Shop/item_info_f_1~5.png` 原版渐变。顶部直接显示配置商品名（含数量），中部大图标不再叠加数量角标，底部仅显示货币图标与价格数字。限购按配置展示每日/每周等上限，不模拟账号“剩余”或“已售罄”。桌面网格最小列宽 110px，手机四列；图标继续通过 `item-click` 打开详情。

时装变体通过 `skin: { heroName, name, quality, image }` 启用：顶部角色名、5:9 原版商城封面与品质色皮肤名、单个奖励道具、底部货币图标与价格数字（不重复“氪金”文字）。`shop_list_skin.png` 和价格条 `shop_vip_time.png` 均使用九宫格保留边缘；价格背景单独去色、压暗并以低透明度叠加，图标与数字不受滤镜影响。道具数量仅在品质框内右下角显示裸数字，不加乘号、底板或徽章；静态图鉴不模拟“已拥有”。封面和奖励沿用 `item-click` 打开对应道具，图片通过 `getImageUrl`。页面只控制靠左的两列紧凑网格（每卡最多 160px，窄屏自适应），视觉规则集中在公共组件。

时装皮肤名使用常规字重，距封面底部 4.5%，颜色仍取游戏品质原色；道具数量使用 `--q1` 米金色与常规字重，避免亮白粗体角标过于突出。

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
- `UiRewardCard` 的概率文案调用 `acquisitionRules.formatRewardProbability`，按用户要求保留两位小数，非零且小于 0.01% 显示 `<0.01%`；`isSelect` 优先显示“自选获得”；概率未知时不显示概率，零概率不显示必得。不得在其他页面复制同一套概率文案。符石页正文复用 `paper-panel` 外边框，鉴定图标使用 `UiItemCard` 品质框；手机端鉴定概率、结果与展开选择均为两列，样式限定本页。

## 3. 使用规则（强制）

**关节吉祥物（全部 34 名）**：全部角色通过 `MascotScene` / `MascotFigure`、`MascotArm` / `MascotLeg` 共用动作与关节绘制，`mascotModels.js` 提供专属形象、肩点/臂长、托腮握点、袖口/手型、腿部配色和随身物件。希尔保留原手套与服装；迦南使用裸手、白色褶边袖口、护腿、长靴，以及连续佩剑和披风。坐姿时迦南佩剑略贴背、披风适度收短，起身连续恢复。米托拉保留原头部 .9 比例、红白长发、披肩和蓝色吊坠；绑带袖口、左露指手套、左右不同的袜靴随关节动作，坐下时长发收拢、起身恢复。露比特的菜篮/园艺手套、艾薇杜尔的灯杖/长袍、露帕的法杖/披风、菲莉娜的尾羽/箭筒/爪靴分别适配，双手按场景握绳或握竿，长装饰坐姿收拢。全部角色的待机、思考、秋千、钓鱼使用同一 320×400 画布与 1:1 模型坐标，桌面宽 192px、矮窗口宽 144px；不因道具额外缩小人物，选择预览使用本人静态模型。

关节角色手腕默认沿前臂，袖筒以曲线衔接关节；思考同时调整肩肘腕与自然垂下的另一只手，不能只旋转待机前臂。握绳和握竿时两肘保持下沉，钓鱼右手握加长握柄的前段、左手靠近卷线轮，避免双手挤在肩部。检查真实掌心与道具接触、肘部方向及腕部折角，不以预设坐标代替实际 SVG 关节位置。

米托拉的鱼竿停放位置向外避让，取竿、抬竿与放竿全程保持右肘在肩点外侧偏下，避免前臂穿过胸口。鱼竿从出现、转身、坐下到伸手取竿始终保持同一停放位置，拿竿首帧必须与此前道具位置衔接，不能先悬在胸前再跳到旁边。取放握点与道具轨迹共用计算；不得仅翻转肘部方向而使抬竿时肘点升到肩上，也不得通过缩放手掌补偿握点。

托腮以旧版斜托下巴的轮廓为准，肘部向外、前臂斜抬。思考可专门适配袖管折叠比例，但不能改变总臂长或手掌缩放；过渡同步改变袖管轮廓与关节位置。通用关节不要求所有姿势共用完全相同的袖管投影比例。

思考进入为抬臂 → 托腮 → 偏头，停留时轻动手指、变化视线并渐显问号，离开先收手再恢复头部。秋千为道具出现、靠近、握绳、坐下和轻荡；离开减速、松手跳下、落地缓冲、走开和道具淡出。钓鱼为凳子出现、侧身坐下、拿竿、放线看漂；停留时调整握姿、咬钩提竿；离开先收线，再放竿、松手起身、收起道具。握点、鱼线和浮漂连续跟随，人物保持可见；连续点选只记最后一次请求，完整退出后再进入新动作。新增片段与装饰细节统一响应暂停、可见性和减少动态效果设置。

`UiPopover` 复用侧栏边框与装饰钉，底色使用不透明 `var(--paper)`（明暗主题同色系），避免浮窗透出下层文字与角色。

吉祥物 SVG 统一按 `hero-<三位英雄编号>-idle.svg` 命名（米托拉为 `hero-002-idle.svg`），选择窗仍展示角色中文名。

角色服饰细节可使用 SVG 的 `upperArm/cuff/thigh/shin/boot` 局部分件（左右差异用 `-left/-right`），由共用四肢组件随关节装配；护腕和袖口不参与掌心尺寸判断。腰包、书袋、锁链、盾牌应按实际穿戴关系配置 `satchelLayer`，禁止整件被身体挡住后仅凭源码存在认定保留。原图与四动作成品须逐批对照，核对头饰、发型、武器形状、左右服装差异和坐姿遮挡；配色、细描边、平涂阴影沿用首批风格，不能用增加纹路代替正确轮廓。

**右侧栏吉祥物**：`SidebarMascot.vue` 是按需加载的业务插画组件，不进入通用 UI 出口。SVG 参考 `public/test2/hero` 重绘，覆盖参考清单全部 34 名角色，首批为 001、055、062、053、034、049、002；固有色保留在矢量素材中，不套用品质色，仅插画配色属于此例外。全部角色主画布统一 320×400、桌面宽 192px、700~780px 高窗口宽 144px；选择窗也使用同一 4:5 画布。待机/思考以身体落脚中心 (162,369) 对齐，不按武器、篮子或尾羽的外接框居中，切角色不改变主画布和控制行位置。全部角色的问号统一在右上方，气泡尾巴朝左下指向人物。更矮窗口、移动端和原生端不挂载。右侧 `.info-body` 使用纵向 flex，将插画放在说明之后并以自动顶部间距靠右下，禁止绝对定位遮住正文。

全部 34 名角色以待机第 0 帧可见身高（不含阴影）统一到 312 模型单位，桌面约 187.2px、矮窗口约 140.4px；角色比例来自 `MASCOTS.standingHeight` / `getMascotScale`，主插画与选择预览一致。只围绕落脚点等比例调整，保留各自宽窄和造型；动作中保持固定比例，不能因坐下、托腮或摆动而重新归一外接框。

全部 34 名角色提供“待机”“思考”“秋千”“钓鱼”；关节与道具使用共享 CSS 和有限 Web Animations 片段，无滤镜、粒子和常驻逐帧脚本。装饰使用 `aria-hidden` 与鼠标穿透；公共 `UiButton` 承载播放/暂停、动作切换和角色“切换”，使用 13px 主题文字、键盘语义，分别持久化暂停、动作和角色选择。动作按钮显示当前动作，点击展开公共 UiPopover 动作选择窗；控制行始终靠右，矮窗口允许比缩小后的插画稍宽但不超出侧栏。后台及不可见时暂停，系统减少动态效果时隐藏动作/暂停按钮与问号，完全关闭关键帧、保留静态姿势和角色切换。

全部角色的思考由关节配置生成专属托腮姿势，保留袖口、肤色和手掌比例；选择预览保持静态。后续 27 名已按首批深色细描边、平涂阴影风格重绘为语义分件，运行时补齐真实关节四肢；切换角色保留当前动作。特殊宽武器/翅膀优先完整展示，不能横向挤压人物。

“切换”向上展开 `UiPopover`，每批横排七个静态小像与名称，共五批、末批六人。标题旁用手机邮件页样式的 ‹ / › 箭头加“上一批 / 下一批”文字与批次编号；首尾按钮禁用，翻批仅换候选，重新打开回到当前角色所在批次。当前角色高亮；成功点选后收起并恢复按钮焦点，失败保留原角色并提供重试。模型源路径随懒加载侧栏模块进入；独立 SVG 请求与预览挂载仅针对当前及当前批次，展开和翻批时补齐并缓存，关闭/翻批取消待完成的旧请求。选择窗直接复用 `paper-panel corner-nails` 的侧栏底色与边框，边界收敛到视口内；点窗外、Esc、路由变化或卸载时关闭。这是非模态锚定选择层，不锁背景、不画全屏遮罩；详情及系统模态窗口继续使用 `UiModal`，禁止业务页面复制选择窗定位/关闭骨架。

设施功能的营地视图由 `CampFacilitiesPanel.vue` 组合公共筛选、网格、章节、属性行和奖励卡。按用户要求，建筑使用带原图的选择卡，升级档位以卡片并排比较前后效果；研究使用 `CampResearchTree.vue` 的可点击前置关系树，复用原 `build_tree_botm` 节点底板，详情使用原菱形图标框，不再使用下拉选单。研究树按前置关系从左向右推进，同层分支上下排列，连线为 SVG；手机在树内横向滚动、初始定位左侧起点，不让整页溢出。节点保留底板原始 292×88 比例与左侧方框，图标使用 60×60 的 contain 区域；名称与总等级在素材横线上方，描述在线下方。布局连线与节点共用尺寸常量，详情的「返回研究树」与研究图标、名称同一行并靠右对齐，减少顶部垂直占用。无账号状态时不显示锁定或已完成。

三个视图均先搜索、再页签、再筛选和数量（13px、600 字重）。营地组件用片段输出筛选区和正文，`section-tabs` 插槽由父页面传入，筛选框必须成为 `.page-view-container` 的直接子元素以接入公共吸顶裁剪。正文使用 `paper-panel` 边框，背景放在 `camp-grid` 而非页面根；等级选择移至实体标题下，材料和奖励复用公共卡片。营地激活筛选文字使用 `--on-wood-text`，避免暗色模式把背景变量当文字色；正文和奖励名称允许换行。滚动区固定为 `#campFacilitiesScroll`，手机底部保留浮动导航避让空间。

1. **一切视觉从组件库引用**：页面/组件模板里的搜索、筛选、页签、网格、卡片、
   弹窗、信息行、奖励卡、按钮、空态、进度条必须用对应 Ui 组件；
   旧版手写 class（`.filter-btn`、`.segmented-pill-*`、`.item-card`、
   `.modal-overlay` 等）**不再允许新增**。
2. **页面 scoped 样式只保留业务特殊布局**（如立绘尺寸、特殊网格、图表），
   任何"面板底色/描边/按钮/弹窗"类样式视为违规重复。
3. **详情弹窗用内嵌 `UiModal`**（默认模式，铺满主视图区、周围不变暗）：指定唯一 `scroll-id`
   （如 `itemModalScroll`、`monsterModalScroll`）与 `max-width`/`:z-index`，配合 `UiBackToTop`；
   `fullscreen` 仅用于确需占满区域的场景，`teleport-to="body"` 用于系统级弹窗（公告/关于/提示/更新）及全局图片预览，最低层级 12000；业务页面详情使用 2000~3000，全局物品详情使用 5000。桌面端的 `.app-container` 是唯一页面级滚动根；详情绝对覆盖主视图区，打开时锁视口，正文内部滚动。剧情、左侧导航等真实内部滚动容器只滚动自身；地图仅在明确缩放手势下接管滚轮。移动端继续使用内容区原生滚动。
   > 页面级内嵌详情打开时，`UiModal` 以宿主上的 `ui-modal-open` 类隐藏同层列表（避免列表透到详情下方）。普通非 Teleport、非 fullscreen 的内嵌详情不执行 Vue CSS 过渡；关闭时 overlay、`ui-modal-open` 和视口锁同步移除，直接显示已复位列表，禁止半透明详情与滚动后的列表交叉叠帧。页面内嵌详情同样为**覆盖式模态**（与全局物品详情一致）：`overlay` 固定视口高、正文 `overflow-y:auto; overflow-x:hidden`（内部纵向滚动、不出现横向滚动条）、头部非 sticky，且 `.page-view-container:has(> .ui-modal-host.ui-modal-open)` 把它锁为视口高度（`max-height`+`overflow:hidden`）——短内容详情不会从下方露出列表/地图空白、左右栏保持固定；关闭后 `scrollTop` 会滚回点击前位置（`UiModal` 用 `flush:'pre'` watch 在弹窗可见前捕获滚动位置，作为默认待恢复值）。
   > 全局物品详情（挂 `app-main` 内、与 `router-view` 同级）同样是**覆盖式模态**：其 overlay 为 `position:absolute; inset:0`、弹窗窗口固定为视口高度、**正文在弹窗内滚动**（长详情在弹窗内滚，不撑破视口）；打开时通过 `app-main:has(> .ui-modal-host.ui-modal-open)` 把 `app-main` 锁为视口高度（`max-height`+`overflow:hidden`，列表溢出被裁掉，故没有可滚到底部的空白）并对其同层 `router-view`（页面列表）用 `visibility:hidden`（而非 `display:none`，以保持列表渲染与布局高度、关闭后滚动恢复正确）。关闭时直接移除 overlay 并恢复列表，不执行交叉淡出，因此短详情不会从下方露出列表，也不会出现滚动位置错位残影；`scrollTop` 会滚回点击处（打开前在 `App.vue` 先捕获列表位置，作为 `UiModal` 的 `restoreScrollTop`）。
   > 多个桌面非 Teleport 详情允许叠加时，统一由 `modalScrollCoordinator` 管理 `.app-container`：首层记录原始位置，中间层关闭不得恢复，最后一层关闭才执行“立即 + rAF”恢复；路由切换必须重置协调器。物品弹窗内部历史项必须是 `{ item, bodyScrollTop }`，深入奖励/原料时正文置顶，返回时恢复上一件物品的正文位置。禁止各页面自行再实现一套页面滚动保存/恢复。
   > 全局弹窗统一通过 `globalModalLock` 锁定背景滚动及交互，多层共用 owner 生命周期，不能一关其中一层就提前解锁。弹窗按 `100dvh` 与四边安全区限高，正文 `min-height:0; overflow-y:auto`，头部与 footer 不得被长公告/更新说明挤出视口。更新下载时通过不可关闭状态阻止误退。
   > `UiModal` 通过 `useOverlay` 自动登记到 `overlayStack`；其他菜单/搜索覆盖界面也必须登记关闭动作，Android 返回只处理当前最高层。没有覆盖层时保留原生 WebView 历史行为，不添加根页强制退出逻辑。页面自建预览遮罩和独立更新窗不再允许。
4. **深色模式零覆盖**：组件内禁止写 `.dark-mode` 覆盖规则，主题变量随 `html.dark-mode` 自动切换；唯二例外——① 暗色下的对比度必要微调（优先引用主题变量，如 `--accent-bright`/`--wood-soft`；暗色专用表面色可用硬编码，如输入框聚焦底色）；② 覆盖不得改变品质色/强调色的语义与行为。凡新增暗色覆盖，需在样式旁注释动机，避免变成无法维护的色值堆叠。
5. **兼容组件**：旧 `BaseModal`/`BackToTop` 兼容壳已移除，所有代码直接使用 `UiModal`/`UiBackToTop`。
6. **新增组件流程**：先放 `src/components/ui/`，实现羊皮纸样式（只用 theme.css 变量），
   通用轻组件在 `index.js` 导出；重型按需组件可直接文件导入以保留页面分包，并同步更新本文档组件表格及例外说明。
7. **可读性**：中文正文不得小于 13px；小标签可 11-12px 但需加粗；正文颜色禁止脱离
   `--text-main`/`--text-muted` 体系；长文本容器必须 `word-break`/`line-height ≥ 1.6`。
8. **滚动提示**：横向分段栏与桌面导航等隐藏原生滚动条的区域，必须保留滚轮、触控板或触摸滚动能力；仅在内容真实溢出且尚未到达滚动末端时显示方向提示，到达末端后立即隐藏。

## 4. 页面骨架模板（新页面照抄）

### 4.1 游戏皮肤页：模拟招募（`/gacha`）

`src/components/gacha/` 是按游戏原素材还原的**业务皮肤**，与伙伴邮件阅读器同属「不进通用 UI 出口」的例外。规则：

- `GachaStage.vue` 是唯一画布容器：固定 `1534×750`、原点居中，按 `min(容器宽/1534, 容器高/750)` 等比缩放居中（`utils/gachaLayout.js`）。子元素用 `gachaPos(x, y)` 写 prefab 原始坐标，配合 `.g-abs`（`position:absolute; transform:translate(-50%,-50%)`）定位；**禁止在业务组件里另算缩放或改坐标**。
- **整页全屏**：该路由在 `App.vue` 用 `is-gacha-stage` 隐藏顶栏 / 左导航 / 右信息栏 / 移动端悬浮导航，主视图区 `100dvh`；`.main-layout-row` 必须从三列 grid 改成单列 flex（否则唯一的子元素会落进第一列 250px，画布被压成 250/1534）。画布外的留白用 `GachaStage` 的 `backdrop`（主视觉模糊放大版）铺满，避免硬边黑框；画布始终 contain、不裁切。
- **NGUI pivot 必须先查**：`UIWidget.Pivot` = `TopLeft0/Top1/TopRight2/Left3/Center4/Right5/BottomLeft6/Bottom7/BottomRight8`。`mPivot=8` 是 BottomRight（向右上展开）、`mPivot=3` 是 Left（向右展开）；`.g-abs` 的居中 translate 只适用于 `mPivot=4`，其余必须在 scoped 样式里改用 `left/right/top/bottom` 锚定并去掉 translate。`UIAnchor` 的序列化 `pixelOffset` 与画面实际位置在当前资源里不一致，**以 Transform 坐标为准**。
- **层叠用 `.g-layer-*`**：`bg(1) < art(10) < deco(20) < ui(40) < interactive(60) < overlay(80)`，同层内按 prefab `mDepth` 由小到大决定 DOM 顺序，注释里写明 depth。放错层会让元素压住不该压的东西（揭晓里 `midFrame` 必须在角色之下、`Rconer` 角框在角色之上）。
- `src/assets/gacha.css` 只服务该页面：提供画布、层叠层级（`.g-layer-bg/art/deco/ui/interactive/overlay`）、游戏文本色（`--gacha-ink` 等，取自 `Const.cs` 的 `ColorString`）与演出关键帧。品质色仍用 theme.css 的 `--q1`~`--q5`，不重复定义。
- **9 宫格切片必须在图集元数据里取真实值**：`4.24路资源包/assets/Android/AssetBundle/../uiprefab/*_Atlas.json` 的 `mSprites[].borderLeft/Right/Top/Bottom`。已用切片：`gacha_page`/`gacha_page_sp`/`com_btn_Y_sp`/`com_btn_N_sp` = `0 60 0 60`，`com_btn_mini` = `0 24 0 24`，`com_info_botm` = `0 15 0 15`，`com_top_item` = `0 20 0 20`，`chara_btn_change` = `0 24 0 24`，`item_info_color1~5` = `0 8 0 8`，`com_txt_botm4` = `4 4 4 4`，`com_txt_botm5` = `16 4 16 4`。新增切片精灵时到元数据里核对，**不要目测**。
- 层叠优先级：背景/前景美术 `.g-layer-*` 之外的点击层（演出推进）用 z-index 50、跳过按钮 60、弹层 80；同一图层内按 prefab `mDepth` 顺序排列，写进注释。
- 减少动态效果时由 `gacha.css` 的 `prefers-reduced-motion` 统一关闭该页关键帧，业务组件不各自判断。
- 该页不套用 `UiCardGrid` / `UiModal` 等羊皮纸组件（设计体系不同）；但**数据获取、黑名单、奖励解析、图片路径**仍必须走 `fetchWithFallback`、`isBlacklisted`、`gameMappings` 与 `getImageUrl`。

> 说明：页面标题由全局 App 顶栏（`App.vue`）提供，**页面内不要再加 `UiPageHeader`**；
> 网格自定义列数用页面 class 覆盖 `.ui-card-grid`（如物品 7 列 `items-card-grid`）；
> 详情弹窗为内嵌模式（默认非 fullscreen），用 `max-width` + `scroll-id` + `:z-index`。

```vue
<template>
  <div class="page-view-container">
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索名称..." />
      <UiFilterRow label="大类：">
        <UiFilterPill :active="selectedMain === null" @click="selectMain(null)">全部</UiFilterPill>
        <UiFilterPill v-for="cat in categoryTree" :key="cat.type"
          :active="selectedMain === cat.type" @click="selectMain(cat.type)">{{ cat.name }}</UiFilterPill>
      </UiFilterRow>
      <UiFilterRow label="稀有度：">
        <UiFilterPill v-for="r in [1,2,3,4,5]" :key="r" :quality="r"
          :active="selectedRarity === r" @click="selectedRarity = r">{{ getRarityName(r) }}</UiFilterPill>
      </UiFilterRow>
    </div>

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

脚本导入示例：`import { UiSearchInput, UiFilterRow, UiFilterPill, UiCardGrid, UiItemCard, UiEmptyState, UiBackToTop, UiModal, UiSection, UiInfoRow, UiRewardCard } from '../components/ui/index.js'`

### 伙伴邮件原素材皮肤

图片按原来源共享：邮件贴图使用 `EmailPanel_Atlas`，头像框、选中角框和通用奖励图标使用 `Common_Atlas`，信纸使用 `uipanel/emailpanel/mail_botm.png`。不为阅读器再复制 `game-skin` 子目录。公共 `UiItemCard` 名称底板及角色/魔物图鉴共用 `PicHandBookPanel_Atlas`；招募的通用按钮同样共用 `Common_Atlas`，揭晓背景使用 `uipanel/herogachashowpanel/bg.png`。
邮件区域是固定阅读器，不使用 UiCardGrid 的桌面文档流策略；App 外壳为此路由设置与侧栏相同的高度限制。网格行与各层 flex 必须允许收缩，窄屏也不得用固定最小高度撑高外页。头像、信件列表、正文分别内部滚动并阻止边缘滚动传递；隐藏原生滚动条时保留溢出方向提示。内层不再添加独立边框。

`PartnerMailReader.vue` 是用户指定的游戏原素材业务皮肤，按需随邮件页加载。角色与信件按钮复用 `UiButton`，仅在组件内覆盖贴图所需背景、间距和状态。信纸和列表使用原配置切片，图片统一经 `getImageUrl`。原信纸固定为浅色，因此纸上墨色和标题文字采用局部固定配色，周围筛选仍随全站主题切换。手机将头像栏横排，正文至少保留可阅读宽度；不缩放整页字号。此例外不改变其他页面与公共按钮的主题。

## 5. 验收清单（每次改动自查）

符石图鉴筛选区按「搜索栏 → 页签 → 筛选行 → 数量」排列，数量样式与事件/兑换页一致（13px、600 字重、`--text-muted`）。使用公共桌面吸顶裁剪时，实色正文背景必须放在 `[data-main-scroll]` 内，不给页面根铺实色，以免背景穿过筛选区上方留白；页签切换使用 `resolveScrollTarget` 操作实际滚动根。回归应包含滚动中的截图和切换后的起始位置，而不只检查首屏。

符石合成与符石列表共用卡片外观和网格密度（桌面两列、手机一列），合成卡展示产物、效果前后对照和单次材料；没有目标下拉框或合成次数输入，来源方案排在首位并高亮。鉴定的操作栏在手机独占一行且左对齐，次数输入使用 `components/runes/RuneCountInput.vue`。兑换页不再展示符石合成分类和条目。

注：原招募模拟页面 `/gacha` 已于 2026-09-11 按要求下线移除，无需再对其进行 UI 组件回归。

- [ ] 无不当 `.dark-mode` 覆盖、无重复基础样式
- [ ] 滚动容器 id 正确，回到顶部可用
- [ ] 空/加载/错误三态齐全
- [ ] 品质着色（文字/底/描边）与品质一致
- [ ] 正文 ≥ 13px、行高 ≥ 1.6、深色模式可读
- [ ] `npm run build` 通过
- [ ] 涉及滚动、弹窗、地图或响应式布局时，`npm run test:ui` 通过
- [ ] 全局弹窗层叠时背景不滚动，长内容/横屏下关闭和底栏可触达，安全区不遮挡
- [ ] 原生返回只关闭最上层，详情 query 与嵌套历史同步，监听注册/卸载无残留
