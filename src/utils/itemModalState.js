import { reactive } from 'vue'

export const itemModalState = reactive({
  visible: false,
  item: null,
  categoryTree: [],
  history: []
})

export function openItemDetail(item, categoryTree, isPush = false) {
  if (isPush && itemModalState.item) {
    itemModalState.history.push(itemModalState.item)
  } else if (!isPush) {
    itemModalState.history = []
  }
  itemModalState.item = item
  if (categoryTree) {
    itemModalState.categoryTree = categoryTree
  }
  itemModalState.visible = true
}

export function popItemDetail() {
  if (itemModalState.history.length > 0) {
    itemModalState.item = itemModalState.history.pop()
    return true
  }
  return false
}

export function pushItemDetail(item) {
  if (itemModalState.item) {
    itemModalState.history.push(itemModalState.item)
  }
  itemModalState.item = item
}

export function closeItemDetail() {
  itemModalState.visible = false
  itemModalState.item = null
  itemModalState.history = []
}
