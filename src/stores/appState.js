import { defineStore } from 'pinia'

// 在列表中切换某 id 的存在性（存在则移除，不存在则追加）
const toggleInList = (list, id) => {
  const idx = list.indexOf(id)
  if (idx > -1) {
    list.splice(idx, 1)
  } else {
    list.push(id)
  }
}

export const useAppStateStore = defineStore('appState', {
  state: () => ({
    collectedAchievementIds: []
  }),
  actions: {
    toggleAchievementCollected(achId) {
      toggleInList(this.collectedAchievementIds, achId)
    }
  },
  persist: true
})
