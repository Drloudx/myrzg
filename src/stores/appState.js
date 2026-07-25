import { defineStore } from 'pinia'

export const useAppStateStore = defineStore('appState', {
  state: () => ({
    favoriteRoleIds: [],
    favoriteEquipIds: [],
    collectedAchievementIds: [],
    recentSearches: [],
    theme: 'light'
  }),
  actions: {
    toggleRoleFavorite(roleId) {
      const idx = this.favoriteRoleIds.indexOf(roleId)
      if (idx > -1) {
        this.favoriteRoleIds.splice(idx, 1)
      } else {
        this.favoriteRoleIds.push(roleId)
      }
    },
    toggleEquipFavorite(equipId) {
      const idx = this.favoriteEquipIds.indexOf(equipId)
      if (idx > -1) {
        this.favoriteEquipIds.splice(idx, 1)
      } else {
        this.favoriteEquipIds.push(equipId)
      }
    },
    toggleAchievementCollected(achId) {
      const idx = this.collectedAchievementIds.indexOf(achId)
      if (idx > -1) {
        this.collectedAchievementIds.splice(idx, 1)
      } else {
        this.collectedAchievementIds.push(achId)
      }
    },
    addRecentSearch(query) {
      if (!query || !query.trim()) return
      const trimmed = query.trim()
      this.recentSearches = [trimmed, ...this.recentSearches.filter(q => q !== trimmed)].slice(0, 10)
    }
  },
  persist: true
})
