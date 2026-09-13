import { reactive } from 'vue'

export const itemModalState = reactive({
  visible: false,
  item: null,
  categoryTree: [],
  history: [],
  // 打开全局物品详情时，用户列表所在的滚动位置（在 app-main 被覆盖式模态锁为视口高度、页面被钳到顶之前捕获）。
  // 关闭时用它把列表滚回原位置。
  savedScrollTop: 0
})

export function openItemDetail(item, categoryTree, savedScrollTop = null) {
  if (savedScrollTop == null) {
    // 未显式提供（如 URL 直达调用）时，取当前列表位置；此刻弹窗尚未打开、app-main 未被钳制。
    savedScrollTop = (typeof document !== 'undefined' && document.querySelector('.app-container'))?.scrollTop || 0
  }
  itemModalState.savedScrollTop = savedScrollTop
  // 列表点击/URL 直达都是"全新打开"，重置回退历史栈（弹窗内点奖励用 pushItemDetail 入栈）。
  itemModalState.history = []
  if (categoryTree) {
    itemModalState.categoryTree = categoryTree
  }
  itemModalState.item = item
  itemModalState.visible = true
}

export function popItemDetail() {
  const previous = itemModalState.history.pop()
  if (!previous) return null

  itemModalState.item = previous.item
  return previous
}

export function pushItemDetail(item, bodyScrollTop = 0) {
  if (itemModalState.item) {
    const normalizedScrollTop = Number(bodyScrollTop)
    itemModalState.history.push({
      item: itemModalState.item,
      bodyScrollTop: Number.isFinite(normalizedScrollTop) ? Math.max(0, normalizedScrollTop) : 0
    })
  }
  itemModalState.item = item
}

export function closeItemDetail() {
  itemModalState.visible = false
  itemModalState.item = null
  itemModalState.history = []
}
