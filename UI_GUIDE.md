# 深歌小助手 UI 字典与 DRY 设计规范

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
| `--icon-filter` | `brightness(0)...` | `invert(91%)...` | 动态主题图标过滤器，实现图标统一色彩变色（注：独立配色的组件除外如回到顶部） |

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

### 1.5. 全局悬浮按钮 (`.nav-fab-btn` / `.back-to-top-btn`)

全局右下角的悬浮按钮（功能导航、回到顶部）需统一大小与位置：
- 大小：统一为 `48px` 宽高。
- 垂直居中对齐：`right: 20px`。
- 垂直排列位置：功能导航按钮在上方，设置 `bottom: calc(80px + var(--safe-bottom))`；回到顶部按钮在下方，设置 `bottom: calc(20px + var(--safe-bottom))`。
- 图标色彩：功能导航遵循全站统一的主题自动适应（受 `--icon-filter` 控制），但回到顶部由于独立带有专属深色圆形底板，因此其内部图标保持原生色彩，不受该滤镜影响。

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

## 四、 数据管线与底层基建架构

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

### 5. 魔物收益与孵化处置推荐 (Route: /petseggs)
- 视图页面：[src/views/petsEggsView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/petsEggsView.vue)
- 侧边栏导航：名称为 **魔物收益**，路由路径映射为 `/petseggs`，图标使用 `public/pet/eggs/pet_079.png`。
- 关联数据源：`public/data/pet.json` (32种魔物蛋数据)，蛋图标路径规则为 `public/pet/eggs/${pet.eggImg}.png`。
- 顶部双行分段控制器布局 (Segmented Pill Track matching RecipesView & AchievementView)：
  - 第一行自适应分段栏：`【全部 | 金币池 | 氪金池 | 3星 | 4星 | 5星】` (`display: inline-flex; width: auto;`)
  - 第二行自适应分段栏 + 重置按钮：`【全部 | 卖 | 喂 | 按需选择】` (`display: inline-flex; width: auto;` 紧凑包裹，右侧对齐 `重置` 按钮)。
  - 分段控件采用灰底圆角轨道 (`.segmented-pill-container`) + 浮起卡片与主题蓝 (`var(--primary)`) 字体，标准字号 13px，内边距 `padding: 6px 14px` 与菜谱查询页完全保持一致。
- 表格与列说明：
  - 内容与表头单元格全线垂直居中对齐；
  - 显示字段控制：按 时间 $\rightarrow$ 金币 $\rightarrow$ 经验 $\rightarrow$ 金币/分 $\rightarrow$ 经验/分 $\rightarrow$ 金效 $\rightarrow$ 经效 $\rightarrow$ 优先级 顺序排布；
  - 默认排序：按星级/品级降序（5星 $\rightarrow$ 4星 $\rightarrow$ 3星）；点击名称表头可切换升降序。
- 处置推荐规则 (Decision Logic)：
  - 售价与经验比值 $R = \text{sellPrice} / \text{exp}$：
    - $R > 3.0$：标记为 **卖** (售出收益高于经验价值)；
    - $R < 2.2$：标记为 **喂** (喂养经验价值高于售出金币)；
    - $2.2 \le R \le 3.0$：标记为 **按需选择** (金币与经验收益均衡)。

### 6. 成就查询模块 (Route: /achievement)
- 视图页面：[src/views/AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue)
- 侧边栏导航：名称为 **成就查询**，路由映射为 `/achievement`，导航图标使用 `/public/AchievementPanel/achv_icon_adv.png`。
- 关联数据源：`achievement.json`（成就基础数据）、`reward.json`（奖励配置）、`item.json`（道具信息）。
- 奖励拼装与展示规则：
  - 银币 `money` $\rightarrow$ 固定使用图标 `/Common_ItemIcon/item_00001.png`；
  - 氪金 `ke` $\rightarrow$ 固定使用图标 `/Common_ItemIcon/item_00002.png`；
  - 道具 `items` $\rightarrow$ 动态图标路径 `/Common_ItemIcon/{typeId}.png`；
  - 隐藏名称提取：通过 `typeId` 去 `item.json` 查得道具名称存入 `rewardItemNames`，供内部及全局搜索匹配。
- 顶部分段与搜索规范：
  - 第三行全宽搜索栏，使用 `/public/ui/search.svg` SVG 矢量图标并匹配全局配色滤镜 `filter: var(--icon-filter)`。
- 全局搜索定位响应：
  - [AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue) 监听 `route.query`，当从 Header 搜索结果点击成就时，重置过滤限制并滚动定位至目标成就卡片，触发 `.card-highlight-pulse` 高亮动画。
- 组件与界面规范：
  - 回到顶部按键 ([BackToTop.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/components/BackToTop.vue))：38px × 38px，专属背景色 `#628fb8`，白色图标叠加 `transform: scaleY(-1)`；
  - 成就卡片内边距 `padding: 8px 14px`，图标尺寸 36x36px；
  - 代码层防剧透黑名单：配置于 [AchievementView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/AchievementView.vue) 的 `BLACKLIST_ACHIEVEMENT_NAMES` 数组；
  - 自定义 Switch 开关：44x24px 紧凑比例，关闭为灰色带 `✕`，开启为绿色带 `✓`，与 Pinia `collectedAchievementIds` 状态持久化双向绑定。

### 7. 菜谱查询模块 (Route: /recipes)
- 视图页面：[src/views/RecipesView.vue](file:///e:/Desktop/html/myrzg/vue-myrzg/src/views/RecipesView.vue)
- 侧边栏导航：名称为 **菜谱查询**，路由映射为 `/recipes`，导航图标使用 `/Common_ItemIcon/item_30047.png`。
- 关联数据源与跨 JSON 拼装架构：
  - `gameSetting.json` (`public/data/gameSetting.json`)：解析 `data.typeSetting.item_type` 分类编码映射（`3` $\rightarrow$ `消耗`，`32` $\rightarrow$ `料理`，`321` $\rightarrow$ `恢复类`，`322` $\rightarrow$ `强化类`，`323` $\rightarrow$ `抗性类`）；
  - `item.json` (`public/data/item.json`)：通过食谱或食材 `typeId` 提取真实名称，根据 `"img"` 字段进行图标文件匹配（如浆果 `item_10055` $\rightarrow$ `"img": "item_10009"` $\rightarrow$ `/Common_ItemIcon/item_10009.png`）；食谱分类数组解析后过滤通用分类，在卡片标题旁仅展现具体的子分类标签（如 `["抗性类"]`、`["强化类"]`、`["恢复类"]`）；全局搜索下拉框保持原样展示子分类标签；
  - `menu.json` (`public/data/menu.json`)：获取食谱 `typeId`、包含的配方食材 `food` 数组或 `foodType` 数组；制作大图预览使用料理 ID 匹配 `/menu_prev/{typeId}_prev.png` 路径；
  - `buff.json` (`public/data/buff.json`)：通过 `buffId` 提取料理效果描述文案 `buffDes`。
- 全局分类标签规范 (.category-tag-pill)：
  - 搜索下拉菜单及食谱卡片标题旁统一使用强类型蓝调浮起标签样式：
    `color: var(--primary); background: #3b82f614; border: 1px solid #3b82f62e; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; box-shadow: 0 1px 2px #00000005;`
- 通用食材分类映射 (`GENERIC_FOOD_TYPE_MAP`)：`1` $\rightarrow$ 兽肉(`item_10006`)，`2` $\rightarrow$ 野菜(`item_10056`)，`3` $\rightarrow$ 浆果(`item_10055`)，`4` $\rightarrow$ 地菇(`item_10057`)。
- 界面组件规范：
  - 料理图标：尺寸 `54px × 54px`（`.recipe-icon-wrapper`）；
  - 配方展示：食材芯片列表位于标题与分类标签下方；
  - 预览按钮：32px × 32px 灰色圆圈背景按钮（`.circle-grey-btn`），内嵌 SVG 矢量图标（应用 `var(--icon-filter)` 滤镜），动态匹配 `/public/menu_prev/{typeId}_prev.png`；
  - Buff 展现：呈现纯文本 `buffDes` 描述。
- 获取途径与任务详情弹窗 (`RECIPE_SOURCE_CONFIG` & `handleNavigateSource`)：
  - 任务弹窗类型（`targetType: 'task_modal'`）：展开任务详情弹窗 (`taskModal`)；`rewards` 配置使用 `typeId` / `id` / `name`，自动联动 `item.json` 匹配真实名称与图片路径。

---

## 五、 双轨分离与纯原生热更闭环架构 (Hot Update & Dual-Track)

本系统采用 **“本地前端内核 + 云端动态素材”** 的双轨制分离架构，结合 `@capgo/capacitor-updater` 官方插件实现零 Java 侵入的高性能热更新闭环。

### 1. 架构目标与策略
- **轨道 A (核心代码，走原生持久化热更)**：包含打包后的 HTML/JS/CSS（即 `dist` 产物）。由 Capgo Updater 接管，下载极小的单一 Zip 增量包，直接通过 C++ / Java 原生底层解压至私有沙盒目录挂载，彻底摆脱旧版本中 JS 与 Java 传 Base64 导致的 OOM 问题。
- **轨道 B (海量素材，走云端 CDN 临时缓存)**：几千张图鉴图片和巨型 JSON 表格。在 Android 端，所有图片请求由 `src/utils/env.js` 内的 `getResourceBaseUrl()` 自动劫持向云端拉取，依赖 WebView 原生的 Cache 机制托管，大大减轻核心热更包体积（通常小于 2MB）。

### 2. 断网离线兜底 (Offline Fallback)
由于图片与数据表格通过 CDN 拉取，如果用户断网，`src/utils/request.js` 中封装的智能 Fetch 会自动捕获异常，将请求降级 (Fallback) 回 `assets/public_dynamic/` 路径，读取打包进 APK 的静态资源进行硬核兜底。

### 3. 服务端配置与发版规范 (热更必读)
因为全面使用了 Capgo Updater 原生引擎，我们**不需要，也严禁再使用文件分卷 (分券)**！
插件底层只接受完整的标准 Zip 压缩包，打包极其简单。

**打包发布流程**：
1. 本地执行 `npm run build`。
2. 将生成的 `dist` 目录下的所有文件（**确保 `index.html` 在压缩包的第一层根目录下**）打包为 `dist-1.0.1.zip`（根据当前版本号命名）。
3. 将该 Zip 文件上传至 CDN / 服务端。
4. 在服务端更新 `hotupdate.json` 清单，结构如下：
   ```json
   {
     "version": "1.0.1",
     "downloadUrl": "https://myrzg.yxzmy.top/update/dist-1.0.1.zip",
     "body": "1. 修复图鉴显示错误\n2. 优化深色模式体验"
   }
   ```
5. App 启动时，`src/utils/hotupdate.js` 会自动比对版本并唤起 `UpdateModal.vue` 进行原生极速下载与重启覆盖。

---

## 八、 全局逻辑与组件规范 (New)

### 1. 路由唤起与全局弹窗 (Global Modals via URL Query)
为满足“外部组件/页面全局唤起详情页”的统一性，系统中涉及到图鉴详情（如物品、魔物）的交互，均采用 **URL Query 参数监听 + 全局/顶层弹窗** 的方案，避免路由直接跳转导致的页面状态丢失。
- **参数标准**：
  - 物品详情（全局通用）：使用 `?itemId=xxx` 作为关键字，由 `App.vue` 全局监听并弹出 `ItemDetailModal.vue`，彻底与其他页面的查询参数隔离。
  - 其他独立模块（如成就、菜谱、魔物）：使用 `?id=xxx` 作为关键字，由各自对应的路由视图负责监听与定位。
- **组件结构**：物品详情弹窗 `ItemDetailModal.vue` 放置在 `App.vue` 的 `<main class="app-main">` 核心内容区内部，保证它不会遮挡左侧全局侧边栏（电脑端）和顶部搜索栏，表现为仅占据右侧内容区的全屏覆盖形式。
- **双向同步**：
  1. 在列表视图（如 `ItemsView.vue`）中点击卡片时，使用 `router.push({ query: { ...route.query, itemId: item.id } })` 同步更新 URL，而不是直接去操作 Modal 的 `visible`。
  2. 弹窗内的关闭按钮 (`handleClose`) 必须负责清除 URL 中的 `itemId` 参数 (`router.replace({ query: newQuery })`)，从而触发 Watcher 自动隐藏弹窗。
  3. 顶层 Watcher（如 `App.vue` 中的 `watch(() => route.query.itemId)`）统一监听 `itemId` 变化，自动获取数据源并控制对应 Modal 的打开。

### 2. 全局黑名单系统 (Global Blacklist)
为了应对废弃数据和剧透内容，系统通过 `src/config/blacklist.js` 提供了全局黑名单过滤系统。
- **支持规则**：支持通过物品/成就的 **ID 精确匹配**，或者 **名称关键词模糊匹配** 隐藏项目。
- **生效范围**：打包脚本 `clean-data.js` 会自动在构建时过滤搜索索引；在前端列表页（如 `ItemsView.vue`）中，也应该将 `isBlacklisted(item)` 接入 `computed` 的过滤逻辑，保证数据列表层的彻底隐藏。

### 3. 弹窗关闭按钮 UI (Close Button)
为了与系统的原生感和简洁感保持统一，各种自定义 Modal 的右上角关闭按钮需遵循以下设计，不再使用圆形深色背景：
```css
.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-sub, #64748b);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
}
.close-btn:hover {
  color: var(--primary, #3b82f6);
  background-color: var(--bg-hover, rgba(0,0,0,0.05));
}
```
HTML 字符统一使用较细的乘号 `✕` (U+2715) 而不是常规的 `×` (U+00D7)，并配合 `:hover` 进行主色提亮交互。

pvp（挑战赛模块）核心关联路径,匹配与提取逻辑摘要
兑换奖励,itemExchange ➔ consume & reward ➔ item,"匹配 category (pvp, s1 或 兑换) ➔ 提取 sort 及限购次数 ➔ 查 consume 获取消耗要求 ➔ 查 reward 获取奖励池。"
段位奖励,reward ➔ pvp ➔ item,匹配 category (灰羽/黑羽等) ➔ 凭 Reward ID 查 pvp.json 获取段位名与排序(type) ➔ 查 reward 提取 ke 与 items。
排名奖励,pvp ➔ reward ➔ item,遍历 pvp.json ➔ 提取名次区间 (start-end) ➔ 凭 reward 字段去 reward.json 提取具体掉落及概率。
战斗胜负,reward ➔ item,强匹配固定 ID (pvpWin / pvpFailure) ➔ 直接解析 items 规则提取必掉/概率掉落物品及数量。