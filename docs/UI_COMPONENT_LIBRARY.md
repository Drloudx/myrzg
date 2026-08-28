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

`UiTabs` 在移动端遇到较多选项时保持单行横向滚动，右侧显示轻量滚动提示；切换到不可见页签时自动滚动到可视区域。详情主体不得随页签产生横向滚动。

### 1.3 字体与可读性红线

- 标题：`'Cinzel', 'Noto Serif SC', 'Songti SC', Georgia, serif`
- 正文：`'Noto Serif SC', 'Songti SC', 'SimSun', Georgia, serif`（Google Fonts 加载失败自动回落）
- **正文 ≥ 13px、行高 ≥ 1.6**；描述性文字用 `--text-main`/`--text-muted`；
  禁止浅灰低对比配色；暗色模式对比同样达标。

### 1.4 全局背景

- 地图背景 `/ui/map_w1_bg.png` 铺在 `html,body`（避开顶栏偏移），
  面板统一使用半透明羊皮纸（`.paper-panel`），让地图透出。

## 2. 组件库目录（src/components/ui/）

统一从 `index.js` 导入：
```js
import { UiModal, UiSection, UiInfoRow } from '../components/ui/index.js'
```

| 组件 | 职责 | 关键 Props |
| --- | --- | --- |
| `UiButton` | 通用按钮 | `variant`(primary/secondary/ghost/danger/link)、`size`(sm/md/lg)、`block`、`disabled` |
| `UiSearchInput` | 搜索框（图标+清空） | `modelValue`、`placeholder`、`clearable` |
| `UiFilterRow` | 筛选行容器 | `label`（如"稀有度："），插槽放 UiFilterPill；使用 `#right` 放计数/操作时，手机端会自动独占一行 |
| `UiFilterPill` | 筛选胶囊 | `active`、`quality`(1~5 可选)、`disabled` |
| `UiExchangeTrade` | 多列兑换卡片（标题、获得物品、消耗物品、限购；可选礼包图） | `title`、`rewardItems`、`consumeItems`、`limitText`、`packImage`、`@item-click` |
| `UiSegmentedTabs` | 木刻分段页签 | `modelValue`、`options`(`[{value,label}]`) |
| `UiTabs` | 墨迹下划线页签（详情子页签，超出时仅页签栏横向滚动并自动定位当前项） | `modelValue`、`options` |
| `UiCardGrid` | 数据网格滚动容器 | `id`（供回到顶部定位）、`small`、`wide` |
| `UiItemCard` | 图鉴卡片（图标+名称） | `name`、`img`、`quality`、`@click`、`@img-error` |
| `UiModal` | 羊皮纸弹窗（木质标题条） | `visible`(v-model)、`title`、`fullscreen`、`scrollId`、`zIndex`、`maxWidth`、`closable`、`closeOnOverlay` |
| `UiSection` | 详情章节（◆菱形标题，可选整章折叠） | `title`、`collapsible`、`open`（`v-model:open`），`title-end` 插槽 |
| `UiInfoRow` | 键值信息行 | `label`、`value`（或插槽） |
| `UiInfoPanel` | 信息面板（标题条+行组） | `title`、`media` 插槽 |
| `UiTag` | 小标签/徽章 | `tone`(default/accent/danger/gold/wood)、`quality`(1~5) |
| `UiRewardCard` | 奖励/掉落卡 | `rule`(`{targetName,targetImg,targetQuality,min,max,actualProb,typeId}`)、`clickable`、`@click` |
| `UiAccordion` | 手风琴折叠块 | `title`、`modelValue` |
| `UiProgressBar` | 木轨进度条 | `value`(0~100)、`label` |
| `UiEmptyState` | 空/加载/错误态 | `text`、`type`(empty/loading/error) |
| `UiPageHeader` | 页面大标题（装饰线） | `title`、`subtitle` |
| `UiBackToTop` | 回到顶部木钮 | `scrollContainer`(选择器) |
| `UiListRow` | 通栏列表行 | `id`、`clickable`、`right` 插槽 |
| `UiStatGrid` | 属性数值网格 | `items`(`[{label,value,tone?}]`)、`doubleCol` |

### 2.1 `UiExchangeTrade` 兑换卡片规范

- 每条兑换记录必须是一个独立卡片，页面通过业务网格多列排列；不得把多条记录拼成一条横向大行。
- 普通卡片内部固定为「顶部标题/限购 → 中部获得物品 → 底部消耗物品」顺序；获得物品图标在奖励芯片内保持几何居中，数量脱离布局流固定在芯片右下角，不影响图标居中；底部“消耗”标签居左，消耗芯片从标签后方开始左对齐。卡片使用轻量内高光、分隔线和奖励区浅底色建立层级，不额外显示“兑换”文字。消耗物品必须允许换行，不能用横向溢出隐藏多材料；普通奖励图标使用紧凑尺寸，避免单个图标撑高卡片。
- 礼包补给使用 `packImage` 横向变体：左侧为礼包图，右侧依次展示标题/限购、礼包物品和消耗；礼包物品使用更紧凑的图标芯片。礼包分类网格需提供至少 300px 的桌面卡片宽度，移动端单列展示以保持横向结构。
- 普通桌面网格卡片最小宽度 180px、间距 12px；手机端保持两列、间距 8px。装备制作页面可由页面网格提供固定行高与固定获得区，保证同一行图标基线一致；PVP 页面可通过页面 scoped 规则使用紧凑奖励图标。组件自身高度填满网格行，避免相邻卡片跳动。
- 物品图标点击统一触发 `item-click`，图片路径必须先经过 `getImageUrl()`；名称、数量和限购正文使用不低于 13px 的主题变量颜色。

## 3. 使用规则（强制）

1. **一切视觉从组件库引用**：页面/组件模板里的搜索、筛选、页签、网格、卡片、
   弹窗、信息行、奖励卡、按钮、空态、进度条必须用对应 Ui 组件；
   旧版手写 class（`.filter-btn`、`.segmented-pill-*`、`.item-card`、
   `.modal-overlay` 等）**不再允许新增**。
2. **页面 scoped 样式只保留业务特殊布局**（如立绘尺寸、特殊网格、图表），
   任何"面板底色/描边/按钮/弹窗"类样式视为违规重复。
3. **详情弹窗用内嵌 `UiModal`**（默认模式，铺满主视图区、周围不变暗）：指定唯一 `scroll-id`
   （如 `itemModalScroll`、`monsterModalScroll`）与 `max-width`/`:z-index`，配合 `UiBackToTop`；
   `fullscreen` 仅用于确需占满区域的场景，`teleport-to="body"` 仅用于系统级弹窗（公告/关于）。
4. **旧主题色禁用**：`#3b82f6`、`#2196f3`、`#eef4fc` 等旧蓝色系一律不得出现；
   品质色、强调色走 theme.css 变量与品质工具类。
5. **深色模式零覆盖**：组件内禁止写 `.dark-mode` 覆盖规则，变量自动切换。
6. **兼容组件**：`BaseModal`/`BackToTop` 为旧接口兼容壳（内部已转组件库），
   新代码直接使用 `UiModal`/`UiBackToTop`。
7. **新增组件流程**：先放 `src/components/ui/`，实现羊皮纸样式（只用 theme.css 变量），
   在 `index.js` 导出，并同步更新本文档组件表格。
8. **可读性**：中文正文不得小于 13px；小标签可 11-12px 但需加粗；正文颜色禁止脱离
   `--text-main`/`--text-muted` 体系；长文本容器必须 `word-break`/`line-height ≥ 1.6`。

## 4. 页面骨架模板（新页面照抄）

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

## 5. 验收清单（每次改动自查）

- [ ] 无旧主题色、无 `.dark-mode` 覆盖、无重复基础样式
- [ ] 滚动容器 id 正确，回到顶部可用
- [ ] 空/加载/错误三态齐全
- [ ] 品质着色（文字/底/描边）与品质一致
- [ ] 正文 ≥ 13px、行高 ≥ 1.6、深色模式可读
- [ ] `npm run build` 通过
