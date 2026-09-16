# 疑难 Bug 与解决方案记录（UI 弹窗 / 滚动）

> 本文档记录全站 UI 在弹窗、滚动、锁视口等交互上踩过的**疑难 bug 与最终解决方案**，供后续改动排查复用。
> 原则：先记“现象 → 根因 → 解法”，标明实际负责的组件与共享工具；不要为套用历史修复而无条件修改 `UiModal`、状态与 App 三处。
> 现行规范见 [UI 使用规则](UI_COMPONENT_LIBRARY.md#3-使用规则强制) 与 [详情和 URL](SPEC.md#四详情与-url)。以下代码片段用于解释时序，完整实现以源码为准。

---

## 1. 详情弹窗关闭时的背景闪现 / 滚动残影

**现象**
桌面端关闭页面内嵌详情（任务/事件/角色/魔物/怪物/副本等）时，可能出现两种闪现：列表恢复太晚时会先露页面背景；列表立即恢复但 overlay 继续淡出时，会把已恢复滚动位置的列表与详情叠在一起，看起来像页面向上滑了一帧。列表未滚动时两层位置接近，现象不明显；滚动越深越明显。

**根因**
列表显隐、视口锁和 overlay 的离场动画不是同一生命周期：若以 overlay 是否仍在 DOM 为开关，淡出期间列表仍隐藏，会露出背景；若以 `visible` 驱动的 `ui-modal-open` 即时恢复列表，但普通内嵌 overlay 仍执行 `opacity 0.2s + translateY(4px)`，滚动恢复后的列表就会透过半透明详情形成错位残影。

**解法**
列表仍以宿主 `ui-modal-host` 上的 `ui-modal-open` 类（随 `visible` 即时移除）为开关，而非以 overlay 是否在 DOM 为准：

```css
:global(.page-view-container:has(> .ui-modal-host.ui-modal-open) > :not(.ui-modal-host)) {
  visibility: hidden !important;
  pointer-events: none !important;
}
```

同时，普通非 Teleport、非 fullscreen 的内嵌详情必须关闭 Vue CSS transition（`<Transition :css="!!teleportTo || fullscreen">`）。关闭触发 `visible=false` 时，overlay、视口锁和列表隐藏状态在同一次 Vue 更新中移除，页面直接显示已经复位的列表，不允许详情淡出期间与列表交叉叠帧。公告、关于、更新提示等 Teleport 系统弹窗仍保留淡出；fullscreen 仍保留滑动动画。

---

## 2. 短详情下方露出列表 / 地图空白（覆盖式 vs 页面滚动模型互斥）

**现象**
详情内容较短（如任务"契约者"、事件"废弃的宝箱"）时，弹窗下方露出大片地图/列表空白，页面还可继续下滚到列表；左右两栏"不固定"。

**根因**
旧详情用"页面滚动"模型：`overlay` 仅覆盖其所在 `.page-view-container`，弹窗窗口只按内容高度撑开（`height:auto`），短内容时窗口高度小于容器，下方就是列表 / 地图空白。且页面滚动时左右栏会随页面滚。

**解法——"覆盖式 + 锁视口 + 正文内部滚动"（当前实现）**
1. 覆盖层固定视口高：`overlay { position:absolute; inset:0; height:100%; overflow:hidden }`（页面内嵌详情）
2. 弹窗窗口 `height:100%; max-height:100%`、头部 `position:static; flex-shrink:0`
3. 正文 `overflow-y:auto; overflow-x:hidden`（内部纵向滚动、不出现横向滚动条）
4. 把所在容器锁为视口高度并裁掉溢出：
   - 页面内嵌：`:global(.page-view-container:has(> .ui-modal-host.ui-modal-open)) { max-height:视口; overflow:hidden }`
   - 全局物品：`:global(.app-main:has(.ui-modal-host.ui-modal-open)) { max-height:视口; overflow:hidden }`（用后代选择器同时匹配两处宿主）
5. 同层列表用 `visibility:hidden`（**而非 `display:none`**）隐藏——列表保持渲染与布局高度，关闭后滚动恢复正确；打开期间不可见、不从详情下方透出。

**滚动边界**
详情打开期间锁定外层页面，正文滚动；普通列表关闭详情后恢复页面滚动。地图仅在 Ctrl/Meta+滚轮时阻止默认事件并缩放，普通滚轮交由实际内部滚动容器处理。不要把“外层锁定”误写成“所有正文和地图都不能滚动”。

---

## 3. 覆盖式+锁视口把页面钳到顶部 → 关闭后**返回不在点击区域**（重点）

**现象**
覆盖式详情打开后，关闭时列表**没有回到点击的那张卡片位置**，而是回到页面顶部（或错误位置）。曾与"短详情露空白"一同被用户感知为"这两个成本没法修吗"。

**根因（链式）**
1. 覆盖式 + 锁视口会用 `.app-main:has(...)` 给容器设 `max-height:视口 + overflow:hidden`，浏览器在收缩可滚动高度时会把滚动位置**钳制到 0**。
2. 旧的 `handleParentScroll` 在"弹窗可见后"（`flush:'post'`，DOM 已应用钳制）才读 `.app-container.scrollTop` 作为待恢复值——此刻它已被钳成 0。
3. 于是关闭时恢复 `scrollTop=0`，列表跳回顶部，而不是点击处。

**解法——分两路在"钳制发生之前"捕获，并作为恢复值优先于实时 scrollTop**

**(a) `src/components/ui/UiModal.vue` —— 新增 `flush:'pre'` watch + `restoreScrollTop` prop**

新增 prop `restoreScrollTop`（`Number|null`），提供时优先于实时 scrollTop；并加一个 `flush:'pre'` watch 在弹窗可见**前一行**捕获位置：

```js
watch(() => props.visible, (v) => {
  if (v && usesDesktopParentScroll()) {
    preOpenScrollTop = document.querySelector('.app-container')?.scrollTop || 0
  }
}, { flush: 'pre' })
```

打开时按以下优先级确定待恢复值，并交给共享协调器：

```js
const restoreTop = props.restoreScrollTop != null
  ? props.restoreScrollTop
  : (preOpenScrollTop || root?.scrollTop || 0)
ownsParentScrollPosition = acquireModalScroll(scrollOwner, root, restoreTop)
```

共享协调器在最后一个详情关闭时立即恢复一次，再在下一帧恢复一次：

```js
restore()
restoreFrame = requestAnimationFrame(() => {
  restoreFrame = 0
  restore()
})
```

> `flush:'pre'` 的关键：`pre` 阶段 DOM 尚未应用覆盖式弹窗的 max-height 钳制，`scrollTop` 仍是用户所在位置，故页面内嵌详情（无 `restoreScrollTop` prop）也能拿到正确值。

**(b) `src/utils/itemModalState.js` —— 记录全局物品详情的滚动位置**

```js
export const itemModalState = reactive({
  visible: false,
  item: null,
  categoryTree: [],
  history: [],
  savedScrollTop: 0
})

export function openItemDetail(item, categoryTree, savedScrollTop = null) {
  if (savedScrollTop == null) {
    // 未显式提供（如 URL 直达调用）时，取当前列表位置；此刻弹窗尚未打开、app-main 未被钳制。
    savedScrollTop = document.querySelector('.app-container')?.scrollTop || 0
  }
  itemModalState.savedScrollTop = savedScrollTop
  // ...
}
```

`ItemDetailModal.vue` 将它透传给 `UiModal`：

```vue
<UiModal :restore-scroll-top="itemModalState.savedScrollTop" ...>
```

**(c) `src/App.vue` —— `?itemId=` watcher 先捕获再加载/打开**

```js
watch(() => route.query.itemId, async (newId) => {
  if (newId) {
    const savedScroll = appScrollRoot.value?.scrollTop ?? 0
    const { items, categoryTree } = await fetchItemData()
    if (route.query.itemId !== newId) return
    const item = items.find(i => i.typeId === newId)
    if (item && !isBlacklisted(item)) {
      openItemDetail(item, categoryTree, savedScroll)
    }
  }
}, { immediate: true })
```

**(d) 多层详情必须共享滚动所有权，物品内部历史必须保存正文位置**

- 所有桌面非 Teleport `UiModal` 通过 `modalScrollCoordinator.js` 注册 owner。第一个 owner 保存原始页面位置；后续嵌套详情只增加 owner，不能用已被钳成 0 的值覆盖基线；仅最后一个 owner 关闭时恢复页面。
- 协调器用全局 operation + 单一 rAF 取消旧恢复，避免一个弹窗的延迟恢复覆盖刚打开的新弹窗。路由切换时 `App.vue` 必须先 `resetModalScrollCoordinator()`，旧页面卸载不得恢复到新路由。
- 物品弹窗内部历史项固定为 `{ item, bodyScrollTop }`。点奖励/配方原料时保存当前 `#itemModalScroll.scrollTop` 并把新物品正文置顶；返回时用“立即 + rAF”恢复上一件物品的位置，并用 operation、`visible` 和预期 `typeId` 阻止旧操作写入新内容。

**效果**
- 页面内嵌详情：`flush:'pre'` 捕获默认值 → 关闭回到点击处
- 全局物品详情：`openItemDetail` 收到的 `savedScroll` 优先 → 关闭回到点击处
- 多个详情同屏或一起关闭：中间层关闭不抢写；只在最后一层关闭后恢复原列表位置
- 物品详情内继续查看奖励/原料：新物品从顶部开始，返回上一件物品回到原正文位置
- 关闭时"立即 + rAF"双重复位，避免淡出期间列表先闪到顶

---

## 4. 角色/装备详情底部横向滚动条

**现象**
详情正文底部出现横向滚动条。

**根因**
`overflow-y:auto` 会让未显式设置的 `overflow-x` 被计算成 `auto`（CSS 规范：一个轴为 `auto` 时另一个轴也会变 `auto`）；正文存在 2px 描边导致 `scrollWidth(766) > clientWidth(762)`，因而出现横向滚动条。

**解法**
对正文补 `overflow-x:hidden`：
```css
.ui-modal-body { overflow-y: auto; overflow-x: hidden; }
```
（实测截图确认横向滚动条消失。）

---

## 5. 排查清单（改造弹窗/滚动前必读）

- [ ] 是否引入了"锁视口"？若用了 `:has(...){ max-height:视口; overflow:hidden }`，**必须在钳制前捕获 `scrollTop`**（`flush:'pre'` watch 或 `restoreScrollTop` prop）。
- [ ] 隐藏同层列表用 `visibility:hidden`（保布局/保滚动恢复），**不要**用 `display:none`（会让超大列表关闭时重渲染、返回位置更不稳定）。
- [ ] 是否出现横向滚动条？正文务必 `overflow-x:hidden`。
- [ ] `overflow-y:auto` 与 `overflow-x` 联动，任一轴设 `auto` 时另一轴要显式 `hidden`。
- [ ] 覆盖式与页面滚动**互斥**：一次只选一种模型，不要混用。
- [ ] 关闭恢复滚动：确认"立即恢复 + rAF 双恢复"都在，且 `props.visible` / `scrollOperation` 守卫未让旧操作覆盖新操作。
- [ ] 多个非 Teleport 详情可能同屏时，必须使用共享 `modalScrollCoordinator`；禁止在各组件内独立保存/恢复 `.app-container.scrollTop`。
- [ ] 物品内部 push/pop 必须同时保存/恢复 `bodyScrollTop`；新物品正文必须置顶。

## 6. 全局更新窗或图片预览的操作入口落到屏幕外

**现象与根因**
旧更新窗手写固定遮罩，窗口没有视口最大高度，正文未启用内部滚动；较长更新说明或横屏时底部按钮被挤出屏幕。旧隐藏点位图片预览使用 `z-index:2000` 且关闭按钮固定顶部，低于顶栏 `10000`，关闭入口被覆盖；遮罩还留在页面滚动祖先内，桌面滚轮可移动背后列表。

**解法与回归项**
- 更新及图片预览复用 `UiModal teleport-to="body"`，采用全局层级与安全区限高；正文可滚动，关闭按钮和 footer 不随长内容移出视口。
- `globalModalLock` 统一管理背景滚动/交互，多 owner 叠加时只在最后一层关闭后释放；不能仅给 `body` 隐藏滚动而遗漏真正滚动的 `.app-container`。
- 验证长更新说明、横屏、四边安全区、两层全局弹窗，以及滚轮/触摸/键盘不操作背后页面；更新下载时保持不可关闭状态。

## 7. 原生返回越过当前弹窗

**现象与根因**
旧原生监听仅识别导航和非空搜索，然后按 `/recipes` 路径执行退出；菜谱详情仅追加 `itemId`，路径不变，所以可能直接退出。其他以 `replace` 打开的页面详情也不能用浏览器历史条数等价表示关闭层数。

**解法与回归项**
- 通过 `overlayStack` / `useOverlay` 登记覆盖层关闭动作，`UiModal` 自动接入；优先关闭最高层，物品内部历史继续由原有 `handleClose` 逐层返回。
- `useNativeShell` 仅在存在覆盖层时临时注册 `backButton`；没有覆盖层就移除监听，保留 WebView 原生返回。不追加主页强退逻辑，不修改 Activity 的返回行为。
- `nativeBackHandler` 串行处理异步监听注册/移除，覆盖打开后立即关闭、注册中卸载等竞态；不可关闭更新窗应消费返回，不能继续关闭下层。

## 相关文件
- `src/components/ui/UiModal.vue`（覆盖式、锁视口、`overflow-x:hidden`、`flush:'pre'` + `restoreScrollTop`）
- `src/utils/itemModalState.js`（`savedScrollTop`、`openItemDetail(..., savedScrollTop)`）
- `src/App.vue`（`?itemId=` 监听在钳制前捕获 `savedScroll`）
- `src/components/ItemDetailModal.vue`（`restoreScrollTop` 透传）
- `src/utils/modalScrollCoordinator.js`（多弹窗共享 owner、最终恢复、旧操作失效）
- `src/utils/globalModalLock.js`（全局弹窗背景滚动与交互锁）
- `src/utils/overlayStack.js`、`src/composables/useOverlay.js`（覆盖层顺序与关闭动作）
- `src/utils/nativeBackHandler.js`、`src/composables/app/useNativeShell.js`（原生监听生命周期）

---

## 8. 普通图鉴与邮件阅读器的滚动职责混用

**现象与根因**
新页面套用旧的“所有页面内部滚动”结论后，可能出现双滚动条、筛选错位或内容被裁。普通桌面图鉴由 `.app-container` 滚动，`UiCardGrid/UiVirtualGrid` 进入页面文档流；手机由页面内部容器滚动。邮件阅读器另有固定视口布局，不能以它推导普通列表规则。

**处理与检查**
- 普通列表复用 `UiCardGrid/UiVirtualGrid` 与 `scrollTarget`；桌面滚动时 `.app-container.scrollTop` 变化是正常行为，不要求其保持不变。
- 邮件使用 `App.vue` 的 `is-mail-reader` 锁定外层，头像、选信和正文分别内部滚动；当前没有 `UiCardGrid#partnerMailsGrid`。
- 详情覆盖与页面列表区分：详情正文内部滚动，关闭时由共享协调器恢复列表位置，见第 1～3 节。
- 检查桌面与手机真实滚动根、筛选吸顶、邮件与普通路由来回切换，以及长正文、横屏与详情返回。

现行规范见 [UI 组件库](UI_COMPONENT_LIBRARY.md#3-使用规则强制) 和 [伙伴邮件](features/PARTNER_MAIL_SKIN.md)。
