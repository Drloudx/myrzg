# 🏰 秘境领主助手 UI 字典与 DRY 设计规范

本指南旨在归纳项目中的全局通用 CSS 类名、CSS 变量 Token 字典以及基础 UI 组件规范，确保后续开发严格遵循 **DRY（Don't Repeat Yourself）** 原则，维护全站视觉体验的统一性与闭环。

---

## 一、 全局设计 Token 与 CSS 变量 (CSS Variables)

全局变量定义于 [common.css](file:///e:/Desktop/html/myrzg/vue-myrzg/src/assets/common.css) 中，支持亮色与暗色模式平滑切换。

### 1. 主题与基础调色板

| CSS 变量名 | 亮色模式 (:root) | 暗色模式 (.dark-mode) | 用途说明 |
| :--- | :--- | :--- | :--- |
| `--primary` | `#3b82f6` (蓝色) | `#60a5fa` | 全局主色调、高亮背景与标签 |
| `--primary-hover` | `#2563eb` | `#3b82f6` | 悬停态主色 |
| `--bg` | `#f8fafc` | `#0f172a` | 全局页面背景底色 |
| `--card-bg` | `#ffffff` | `#1e293b` | 卡片/弹窗/容器背景色 |
| `--text-main` | `#0f172a` | `#f8fafc` | 主要文本颜色 |
| `--text-sub` | `#64748b` | `#94a3b8` | 次要文本/辅助说明颜色 |
| `--border-color` | `#e2e8f0` | `rgba(255, 255, 255, 0.1)` | 全局边框分割线颜色 |
| `--hover-bg` | `#f1f5f9` | `rgba(255, 255, 255, 0.05)` | 悬浮点击态背景 |

### 2. 品质等级配色 Token (Rarity Tokens)

| 品质等级 | 变量名 | 色值 | 示例 Badge / Text 类名 |
| :--- | :--- | :--- | :--- |
| **传说 (SS)** | `--rarity-legend` | `#f97316` (橙色) | `.badge-SS` / `.rarity-text-SS` / `.rarity-bg-SS` |
| **史诗 (S)** | `--rarity-epic` | `#a855f7` (紫色) | `.badge-S` / `.rarity-text-S` / `.rarity-bg-S` |
| **稀有 (A)** | `--rarity-rare` | `#3b82f6` (蓝色) | `.badge-A` / `.rarity-text-A` / `.rarity-bg-A` |
| **普通 (B)** | `--rarity-common` | `#10b981` (绿色) | `.badge-B` / `.rarity-text-B` / `.rarity-bg-B` |

### 3. 沉浸式与异形屏安全区变量 (Safe Area Variables)

| CSS 变量名 | 默认计算表达式 | 用途说明 |
| :--- | :--- | :--- |
| `--safe-top` | `max(env(safe-area-inset-top), 0px)` | 顶部刘海/挖孔屏/状态栏安全保护高度 |
| `--safe-bottom` | `max(env(safe-area-inset-bottom), 0px)` | 底部手势条/虚拟按键安全保护高度 |
| `--safe-left` | `env(safe-area-inset-left, 0px)` | 横屏模式左侧安全距离 |
| `--safe-right` | `env(safe-area-inset-right, 0px)` | 横屏模式右侧安全距离 |
| `--header-height` | `56px` | Header 标准导航栏内容高度 |

---

## 二、 全局通用布局与 UI 字典

所有业务无关的通用布局骨架均定义于 [common.css](file:///e:/Desktop/html/myrzg/vue-myrzg/src/assets/common.css)，子组件中**严禁重复定义**。

### 1. 页面与限宽容器

- `.max-w-wrapper`: 限宽 800px 居中容器（带左右 16px 安全 padding）。
- `.page-view-container`: 占据 100% 高度的页面主骨架容器。
- `.header-content`: [App.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/App.vue) 顶部 Header 内容容器，严格对齐下方的 800px 限宽主内容列（`max-width: 800px; margin: 0 auto; padding: 0 16px;`），保证 Logo、全局搜索框与右侧按钮和下方页面内容列左右精确对齐。
- `.icon-btn`: Header 右侧主题切换与菜单按钮，统一使用 36px × 36px 带有圆角浅色边框框体的精致按钮（`border: 1px solid var(--border-color); border-radius: 10px; background: var(--card-bg);`）。
- **全局隐藏/黑名单配置 ([src/config/blacklist.js](file:///e:/Desktop/html/myrzg/vue-myrzg/src/config/blacklist.js))**：
  - 抽离全站统一隐藏/防剧透黑名单。支持在 `GLOBAL_BLACKLIST` 数组中添加【名称/关键字】（如 `'章节宝箱'`, `'通关'`）或【ID / typeId】（如 `'item_30025'`, `'10501'`）；
  - 全站统一使用 `isBlacklisted(item)` 函数，在全局搜索下拉菜单、角色图鉴、装备图鉴、成就查询、食谱配方、魔物收益及脚本索引阶段自动过滤被屏蔽的条目。

```html
<div class="page-view-container">
  <!-- 页面内容 -->
</div>
```

### 2. 顶部检索与吸顶筛选栏 (`.filter-sticky-bar`)

用于各图鉴页面的搜索框、折叠/展开筛选面板及计数条。

**HTML 结构示例**：
```html
<div class="filter-sticky-bar">
  <div class="search-row">
    <div class="search-box">
      <input type="text" class="search-input" placeholder="搜索..." />
    </div>
    <button class="filter-toggle-btn" @click="isExpanded = !isExpanded">
      <span>筛选</span>
      <span class="arrow" :class="{ open: isExpanded }">▼</span>
    </button>
  </div>

  <div v-show="isExpanded" class="filter-panel">
    <div class="filter-row">
      <span class="filter-label">品质</span>
      <div class="filter-options">
        <span class="filter-tag active">全部</span>
        <span class="filter-tag">传说</span>
      </div>
    </div>
  </div>

  <div class="count-bar">
    当前检索数量：<span class="count-num">4</span>
  </div>
</div>
```

### 3. 数据网格与数据卡片 (`.data-grid-container` / `.data-card`)

适用于图鉴列表、装备/角色列表等网格化呈现。

**HTML 结构示例**：
```html
<div class="data-grid-scroll">
  <div class="data-grid-container"> <!-- 可加 .wide-cards 使网格列宽调至 minmax(220px, 1fr) -->
    <div class="data-card" @click="handleClick">
      <div class="card-top-row">
        <div class="card-avatar rarity-bg-SS">艾</div>
        <div class="card-main-info">
          <div class="card-title-row">
            <span class="card-name rarity-text-SS">艾莉丝</span>
            <span class="rarity-badge badge-SS">传说</span>
          </div>
          <div class="filter-options">
            <span class="mini-tag tag-job">法师</span>
            <span class="mini-tag tag-attr">光</span>
          </div>
        </div>
      </div>
      <div class="card-desc">描述文案...</div>
    </div>
  </div>
</div>
```

---

## 三、 全局公共组件规范

### 1. `BaseModal.vue` 通用弹窗组件

位于 [src/components/BaseModal.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/BaseModal.vue)，使用 `<Teleport to="body">` 挂载，统一管控遮罩与视窗。

#### Props

| Prop 名称 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `visible` | `Boolean` | `false` | 控制弹窗显示与隐藏 |
| `title` | `String` | `'提示'` | 弹窗标题（未指定 header slot 时生效） |
| `maxWidth` | `String` | `'480px'` | 弹窗最大宽度 |

#### Slots

- `default`: 弹窗主体内容。
- `header`: 自定义顶部 Header 区域。
- `footer`: 自定义底部按钮区域。

#### Events

- `@close`: 点击背景遮罩或右上角关闭按钮时触发。

**使用示例**：
```html
<BaseModal :visible="isModalOpen" title="角色详情" @close="isModalOpen = false">
  <div class="my-custom-content">
    <!-- 插槽自定义业务内容 -->
  </div>
</BaseModal>
```

---

### 2. `ToastNotice.vue` 全局轻量提示组件

位于 [src/components/ToastNotice.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/ToastNotice.vue)，用于彻底代替浏览器原生 `window.alert()` / `confirm()`，保障沉浸式体验。

#### Props

| Prop 名称 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `visible` | `Boolean` | `false` | 控制提示显隐 |
| `message` | `String` | `''` | 提示文案 |
| `type` | `String` | `'info'` | 类型：`'info'` / `'success'` / `'warning'` / `'error'` |

**使用示例**：
```html
<ToastNotice :visible="showToast" message="加载失败，请检查网络" type="error" />
```

---

## 五、 数据管线与底层基建架构

### 1. 数据预处理管线 (Data Pipeline)
- 预处理脚本：[scripts/clean-data.js](file:///e:/Desktop/html/myrzg/vue-myrzg/scripts/clean-data.js)
- 产物目录：`public/data/`
  - `roles.json` (完整角色 JSON 静态数据)
  - `equips.json` (完整装备 JSON 静态数据)
  - `search-index.json` (轻量级核心检索索引)
- 自动生成类型定义：[src/types/data-types.d.ts](file:///e:/Desktop/html/myrzg/vue-myrzg/src/types/data-types.d.ts)
- 执行命令：`npm run data:clean`（在 `npm run build` 打包时自动触发清洗管线）。

### 2. 纯前端异步 Fetch 加载
- 组件挂载后，通过 `fetch('/data/roles.json')` 与 `fetch('/data/equips.json')` 异步拉取，利用浏览器 HTTP 缓存，配合 `.global-loading-state` 全局 Loading 状态解耦逻辑与海量静态数据。

### 3. URL 状态即数据 (URL as State)
- 图鉴搜索关键词（`q`）、品质（`rarity`）、分类（`class`/`slot`）、属性（`element`）及详情弹窗（`id`）与 Vue Router URL Query 实时双向绑定。
- 示例：`/role?q=艾莉丝&rarity=传说&id=101` 支持复制 URL 后直接还原精准搜索及弹窗状态。

### 4. 本地持久化 Store (Pinia + 持久化插件)
- 位于 [src/stores/appState.js](file:///e:/Desktop/html/myrzg/vue-myrzg/src/stores/appState.js)，使用 `pinia-plugin-persistedstate` 插件进行 LocalStorage 持久化。
- 支持角色/装备收藏（`favoriteRoleIds`, `favoriteEquipIds`）、历史搜索记录（`recentSearches`）持久化存储。

### 6. 魔物收益与孵化处置推荐 (Route: /monsterseggs)
- 视图页面：[src/views/MonstersEggsView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/MonstersEggsView.vue)
- 侧边栏导航：名称更名为 **魔物收益**，路由路径映射为 `/monsterseggs`，图标使用 `public/pet/eggs/pet_079.png`。
- 顶部 Header 结构：响应式 Media Query 适配（电脑端 >=768px 保持原始单行布局，手机端 <768px 展为双行：第一行 Logo+标题+功能按键，第二行全宽搜索框，配备 24x24px Search 图标）。
- 静态数据：`public/data/pet.json` (32种魔物蛋数据)
- 蛋图标匹配：`public/pet/eggs/${pet.eggImg}.png`
- 界面特性与排版：
  - 表格内容与表头单元格全线垂直居中 (`align-items: center; justify-content: center;`)；
  - 标签过滤响应式排版：电脑端为原始单行，手机端 (<768px) 展为双行（第二行独立居左摆放“金币池 | 氪金池”与“重置”按键）；
  - 动态“显示字段控制”复选框（严格保持 时间 -> 金币 -> 经验 -> 金币/分 -> 经验/分 -> 金效 -> 经效 -> 优先级 列顺序）；
  - 默认排序改为按品级/星级降序（高星在最前，即 5星 -> 4星 -> 3星）；点击“名称”表头可切换升降序。
  - 全局搜索下拉框文案统一更名为“魔物蛋”，且彻底移除了类似 `80分` 的分数值显示。
- 处置推荐规则 (Decision Logic)：
  - 售价与经验比值 $R = \text{sellPrice} / \text{exp}$：
    - $R > 3.0$：标记为 **卖** (售出收益显著高于经验价值)；
    - $R < 2.2$：标记为 **喂** (喂养经验价值显著高于售出金币)；
    - $2.2 \le R \le 3.0$：标记为 **按需选择** (金币与经验收益均衡)。

### 7. 成就查询模块 (Route: /achievement)
- 视图页面：[src/views/AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue)
- 侧边栏导航：名称为 **成就查询**，路由映射为 `/achievement`，导航图标使用 `/public/AchievementPanel/achv_icon_adv.png`。
- 关联数据源：`achievement.json`（成就基础数据）、`reward.json`（奖励配置）、`item.json`（道具信息）。
- 异步拼装规则：
  - 银币 `money` $\rightarrow$ 固定使用图标 `/Common_ItemIcon/item_00001.png`；
  - 氪金 `ke` $\rightarrow$ 固定使用图标 `/Common_ItemIcon/item_00002.png`；
  - 道具 `items` $\rightarrow$ 动态图标路径 `/Common_ItemIcon/{typeId}.png`；
  - 隐藏名称提取：通过 `typeId` 去 `item.json` 查得道具名称存入 `rewardItemNames`，供内部及全局搜索匹配，不展示在卡片 UI 界面上。
  - 顶部三行胶囊分段布局：第一行【全部/冒险/探索/生活/隐藏】全宽胶囊分段栏（参照图1）；第二行【全部/已收集/未收集】自适应紧凑分段栏（参照图2）+ 右侧【已收集 XX / XX】计数；第三行全宽搜索栏。分段按钮采用灰底轨道框架 + 浮起白底/暗底圆角选中卡片与主题蓝 (var(--primary)) 字体；
  - 搜索图标与深浅色滤镜规范：项目中所有搜索框（Header 全局搜索与成就站内搜索）统一使用 `/public/ui/search.svg` SVG 矢量图标，并严格应用全局配色滤镜 `filter: var(--icon-filter)`，实现浅色下黑灰色调、深色下白灰色调的自动完美适配；
  - 全局搜索定位响应：已为 [AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue) 添加 `watch(() => route.query)` 监听与 `handleLocateAchievement` 函数。当用户在已处于成就页面下再次通过 Header 搜索框点击任何成就时，系统能即刻响应，自动重置冲突的分类/状态过滤限制，并将页面平滑滚动定位至目标成就卡片居中位置，同时触发 `.card-highlight-pulse` 蓝色发光波纹动画；
  - 回到顶部按键 ([BackToTop.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/BackToTop.vue))：圆圈按钮定制尺寸为 38px × 38px，专属背景色 `#628fb8`，内部图标为纯白色并叠加 `transform: scaleY(-1)` 垂直翻转；
  - 精致紧凑卡片排版：成就卡片高度与内边距缩减为 `padding: 8px 14px`，图标等比缩小至 36x36px，Switch 开关微调为 44x24px 紧凑比例，使得整页列表高度更加精致轻盈；
  - 代码层防剧透屏蔽黑名单：成就屏蔽位于代码层配置（[AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue) 中的 `BLACKLIST_ACHIEVEMENT_NAMES` 数组），防止未发布成就剧透；开发者可直接在代码数组中追加成就标题关键字（默认包含 `'章节宝箱'`, `'通关'`）；
  - 移除 UI 标记：已彻底删除了成就卡片标题旁原有的紫色“隐藏” Badge 标签；
  - 自定义 Switch 开关：关闭为灰色带 `✕`，开启为绿色带 `✓`，与 Pinia `collectedAchievementIds` 状态持久化双向绑定。
  - 奖励展示：Flex 弹性横排仅渲染图标与 `× 数量`，隐藏道具名称。

### 8. 菜谱查询模块 (Route: /recipes)
- 视图页面：[src/views/RecipesView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/RecipesView.vue)
- 侧边栏导航：名称为 **菜谱查询**，路由映射为 `/recipes`，导航图标使用 `/Common_ItemIcon/item_30047.png`。
- 关联数据源与跨 JSON 拼装架构：
  - `gameSetting.json` (`public/data/gameSetting.json`)：递归解析 `data.typeSetting.item_type` 分类编码映射（如 `3` $\rightarrow$ `消耗`，`32` $\rightarrow$ `料理`，`321` $\rightarrow$ `恢复类`，`322` $\rightarrow$ `强化类`，`323` $\rightarrow$ `抗性类`）；
  - `item.json` (`public/data/item.json`)：通过食谱或食材 `typeId` 提取真实名称，从其 `"img"` 字段进行图标文件匹配（如浆果 `item_10055` 使用 `"img": "item_10009"` 对应路径 `/Common_ItemIcon/item_10009.png`）；分类数组 `category`（如 `[3, 32, 323]`）在解析后自动过滤掉无意义的 `"消耗"` 和 `"料理"` 标签，仅精准展现具体的子分类标签（如 `["抗性类"]`、`["强化类"]`、`["恢复类"]`）；
  - `menu.json` (`public/data/menu.json`)：获取食谱 `typeId`（如 `item_30035`）、包含的配方食材 `food` 数组或 `foodType` 数组；制作大图预览仍严格使用料理的 ID 进行 `/menu_prev/{typeId}_prev.png` 路径匹配；
  - `buff.json` (`public/data/buff.json`)：通过 `buffId` 提取料理效果描述文案 `buffDes`（清洗大括号占位符）。
- 全局分类标签规范 (.category-tag-pill)：
  - 项目所有分类标签（搜索下拉菜单、食谱卡片标题旁）统一使用强类型蓝调浮起标签样式：
    `color: var(--primary); background: #3b82f614; border: 1px solid #3b82f62e; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; box-shadow: 0 1px 2px #00000005;`
- 食材 ID 与名称静态强绑定映射表 (`INGREDIENT_NAME_MAP`)：
  - `item_10006`: 兽肉 / `item_10016`: 猪腿骨 / `item_10024`: 面粉 / `item_10036`: 绿榛菇
  - `item_10055`: 浆果 / `item_10056`: 野菜 / `item_10057`: 地菇 / `item_10088`: 岩盐
  - `item_10089`: 风干肉 / `item_10090`: 果酱 / `item_10091`: 腌菜 / `item_10100`: 水露果
  - `item_10101`: 魔爪贝 / `item_10111`: 黑森林松茸 / `item_10112`: 黑森林松茸干 / `item_10118`: 冰莲
- 通用食材分类映射 (`GENERIC_FOOD_TYPE_MAP`)：`1` $\rightarrow$ 兽肉(`item_10006`)，`2` $\rightarrow$ 野菜(`item_10056`)，`3` $\rightarrow$ 浆果(`item_10055`)，`4` $\rightarrow$ 地菇(`item_10057`)。
- 精简界面排版规则：
  - 移除等级筛选与 UI 标签：已移除顶部第一行等级 Segmented 筛选栏，并删除了食谱卡片标题旁原有的蓝色 `Lv.X` 标签，仅在内部数据保留 `item.level`；
  - 放大料理图标：料理图标尺寸扩大至 `54px × 54px`（`.recipe-icon-wrapper`），呈现更加清晰醒目；
  - 移除编号并嵌入配方：删除了原有的 `item_sub_id`（如 `item_30022`）编号文本，将食材配方芯片列表直接上移填补至食谱标题与分类标签下方；
  - 隐藏弹窗食谱 ID：制作图预览弹窗底部已彻底隐藏 `食谱 ID: item_XXXXX` 文本展示；
  - 灰色圆圈预览按钮：使用 32px × 32px 灰色圆圈背景按钮（`.circle-grey-btn`），内嵌 SVG 矢量图标（应用 `var(--icon-filter)` 滤镜）。页面使用 Vite `import.meta.glob('/public/menu_prev/*.png')` 动态扫描图片目录，只要在 `public/menu_prev/` 中添加 `{typeId}_prev.png` 文件，即可自动识别并渲染对应食谱的预览按钮；
  - Buff 区域极简呈现：删除了原有的左侧蓝条、`[强化]` 标签与 `料理效果` 标题，仅保留纯粹的 `buffDes` 描述文本。
- 获取途径与任务详情弹窗 (`RECIPE_SOURCE_CONFIG` & `handleNavigateSource`)：
  - 路由跳转类型（`targetType: 'achievement'`）：如 `item_30035` $\rightarrow$ 点击带 query 参数跳转至成就查询页并自动滚动高亮；
  - 任务弹窗类型（`targetType: 'task_modal'`）：如 `item_30041`（香炸酥肉）与 `item_30034`（珍菇翡翠白玉汤）$\rightarrow$ 点击展开任务详情弹窗 (`taskModal`)；`rewards` 配置无需手动填写 `icon` 或中文名称，只需在 `rewards` 数组中写入 `typeId: 'item_XXXXX'` 或 `id: 'item_XXXXX'`，弹窗打开时将自动联动 `item.json` 匹配道具真实名称与图片路径（如 `item_30034` $\rightarrow$ 珍菇翡翠白玉汤 / `/Common_ItemIcon/item_30006.png`）。

