<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }">
    <!-- Top Fixed Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-top-row">
          <div class="header-left">
            <img src="/ui/logo.png" class="app-logo" alt="深渊之歌" />
            <h1 class="header-title">{{ pageTitle }}</h1>
          </div>

          <!-- Desktop Global Search Bar -->
          <div class="global-search-container desktop-search">
            <div class="global-search-box">
              <img src="/ui/search.svg" class="search-icon-img" alt="搜索" />
              <input
                type="text"
                v-model="globalQuery"
                @focus="handleSearchFocus"
                placeholder="全局搜索..."
                class="global-search-input"
              />
              <button v-if="globalQuery" class="clear-btn" @click="globalQuery = ''">✕</button>
            </div>

            <!-- Quick Dropdown Results -->
            <div v-if="isSearchOpen && globalQuery.trim()" class="global-search-dropdown">
              <div v-if="filteredSearchIndex.length === 0" class="search-empty">
                未找到“{{ globalQuery }}”的相关结果
              </div>
              <div v-else class="search-result-list">
                <div
                  v-for="item in filteredSearchIndex.slice(0, 8)"
                  :key="`${item.type}-${item.id}`"
                  class="search-result-item"
                  @click="handleSelectSearchResult(item)"
                >
                  <span class="item-type-badge" :class="item.type">
                    {{ item.type === 'role' ? '角色' : (item.type === 'equip' ? '装备' : (item.type === 'achievement' ? '成就' : (item.type === 'recipe' ? '料理' : '魔物蛋'))) }}
                  </span>
                  <span class="item-name" :class="`rarity-text-${item.rarityLevel}`">{{ item.name }}</span>
                  <div class="item-tags-flex" v-if="item.categoryTags && item.categoryTags.length">
                    <span v-for="tag in item.categoryTags" :key="tag" class="category-tag-pill">{{ tag }}</span>
                  </div>
                  <span v-else class="item-tag">{{ item.type === 'pet' ? '魔物蛋' : (item.type === 'achievement' ? item.category : `${item.category} · ${item.subTag}`) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="header-right">
            <button class="icon-btn" @click="toggleDarkMode" :title="isDarkMode ? '切换浅色模式' : '切换暗色模式'">
              <img
                :src="isDarkMode ? '/ui/theme-light.svg' : '/ui/theme-dark.svg'"
                class="theme-icon-img"
                alt="主题切换"
                loading="lazy"
              />
            </button>
            <button class="icon-btn" @click="isNavOpen = true" title="菜单">
              ☰
            </button>
          </div>
        </div>

        <!-- Mobile Search Row (Only Shown on Mobile < 768px) -->
        <div class="mobile-search-row">
          <div class="global-search-container mobile-search">
            <div class="global-search-box">
              <img src="/ui/search.svg" class="search-icon-img" alt="搜索" />
              <input
                type="text"
                v-model="globalQuery"
                @focus="handleSearchFocus"
                placeholder="全局搜索..."
                class="global-search-input"
              />
              <button v-if="globalQuery" class="clear-btn" @click="globalQuery = ''">✕</button>
            </div>

            <!-- Quick Dropdown Results -->
            <div v-if="isSearchOpen && globalQuery.trim()" class="global-search-dropdown">
              <div v-if="filteredSearchIndex.length === 0" class="search-empty">
                未找到“{{ globalQuery }}”的相关结果
              </div>
              <div v-else class="search-result-list">
                <div
                  v-for="item in filteredSearchIndex.slice(0, 8)"
                  :key="`${item.type}-${item.id}`"
                  class="search-result-item"
                  @click="handleSelectSearchResult(item)"
                >
                  <span class="item-type-badge" :class="item.type">
                    {{ item.type === 'role' ? '角色' : (item.type === 'equip' ? '装备' : (item.type === 'achievement' ? '成就' : (item.type === 'recipe' ? '料理' : '魔物蛋'))) }}
                  </span>
                  <span class="item-name" :class="`rarity-text-${item.rarityLevel}`">{{ item.name }}</span>
                  <div class="item-tags-flex" v-if="item.categoryTags && item.categoryTags.length">
                    <span v-for="tag in item.categoryTags" :key="tag" class="category-tag-pill">{{ tag }}</span>
                  </div>
                  <span v-else class="item-tag">{{ item.type === 'pet' ? '魔物蛋' : (item.type === 'achievement' ? item.category : `${item.category} · ${item.subTag}`) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Router View Area -->
    <main class="app-main" @click="isSearchOpen = false">
      <router-view />
    </main>

    <!-- Navigation Drawer -->
    <NavigationMenu :is-open="isNavOpen" @close="isNavOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import NavigationMenu from './components/NavigationMenu.vue'

import { isBlacklisted } from './config/blacklist.js'

const route = useRoute()
const router = useRouter()

const isNavOpen = ref(false)
const isDarkMode = ref(false)
const globalQuery = ref('')
const isSearchOpen = ref(false)
const searchIndex = ref([])
const isIndexLoaded = ref(false)

const pageTitle = computed(() => {
  if (route.path === '/equip') return '装备图鉴'
  if (route.path === '/monsterseggs') return '魔物收益'
  if (route.path === '/achievement') return '成就查询'
  if (route.path === '/recipes') return '菜谱查询'
  return '角色图鉴'
})

const fetchSearchIndex = async () => {
  if (isIndexLoaded.value) return
  try {
    const res = await fetch('/data/search-index.json')
    searchIndex.value = await res.json()
    isIndexLoaded.value = true
  } catch (err) {
    console.error('Fetch search-index.json error:', err)
  }
}

const handleSearchFocus = () => {
  isSearchOpen.value = true
  fetchSearchIndex()
}

const filteredSearchIndex = computed(() => {
  if (!globalQuery.value.trim()) return []
  const q = globalQuery.value.trim().toLowerCase()
  return searchIndex.value.filter(item => !isBlacklisted(item) && item.keywords && item.keywords.includes(q))
})

const handleSelectSearchResult = (item) => {
  isSearchOpen.value = false
  let targetPath = '/role'
  if (item.type === 'equip') targetPath = '/equip'
  else if (item.type === 'pet') targetPath = '/monsterseggs'
  else if (item.type === 'achievement') targetPath = '/achievement'
  else if (item.type === 'recipe') targetPath = '/recipes'
  router.push({
    path: targetPath,
    query: { id: item.id, q: item.name }
  })
  globalQuery.value = ''
}

const syncNativeStatusBar = async (isDark) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light
      })
    } catch (e) {
      console.warn('Native status bar sync skipped:', e)
    }
  }
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-mode')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark-mode')
    localStorage.setItem('theme', 'light')
  }
  syncNativeStatusBar(isDarkMode.value)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark-mode')
  } else {
    isDarkMode.value = false
    document.documentElement.classList.remove('dark-mode')
  }
  syncNativeStatusBar(isDarkMode.value)
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-color: var(--bg);
  color: var(--text-main);
}

.app-header {
  flex-shrink: 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  z-index: 800;
  padding-top: var(--safe-top);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  flex-direction: column;
  padding: 0 16px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.app-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
  margin: 0;
  color: var(--text-main);
}

.global-search-container {
  position: relative;
}

.desktop-search {
  display: flex;
  flex: 1;
  max-width: 420px;
  margin: 0 16px;
}

.mobile-search-row {
  display: none;
  padding-bottom: 10px;
}

@media (max-width: 767px) {
  .desktop-search {
    display: none;
  }
  .mobile-search-row {
    display: block;
  }
}

.global-search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon-img {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  filter: var(--icon-filter);
  pointer-events: none;
  flex-shrink: 0;
}

.global-search-input {
  width: 100%;
  height: 36px;
  padding: 6px 32px 6px 40px;
  border: 1px solid var(--input-border);
  border-radius: 20px;
  font-size: 13px;
  background: var(--input-bg);
  color: var(--input-text);
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.global-search-input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  background: var(--card-bg);
}

.clear-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}

.global-search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  max-height: 320px;
  overflow-y: auto;
}

.search-empty {
  padding: 14px;
  text-align: center;
  font-size: 13px;
  color: var(--text-sub);
}

.search-result-list {
  display: flex;
  flex-direction: column;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
/* border-bottom: 1px solid var(--border-color); */
  transition: background-color 0.15s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--hover-bg);
}

.item-type-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.item-type-badge.role {
  background: rgba(59, 130, 246, 0.12);
  color: var(--primary);
}

.item-type-badge.equip {
  background: rgba(147, 51, 234, 0.12);
  color: #9333ea;
}

.item-type-badge.pet {
  background: rgba(217, 119, 6, 0.12);
  color: #d97706;
}

.item-type-badge.achievement {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.item-type-badge.recipe {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.item-name {
  font-size: 13px;
  font-weight: 700;
  flex: 1;
}

.item-tag {
  font-size: 11px;
  color: var(--text-sub);
}

.item-tags-flex {
  display: flex;
  align-items: center;
  gap: 4px;
}

.category-tag-pill {
  color: var(--primary);
  background: #3b82f614;
  border: 1px solid #3b82f62e;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 1px 2px #00000005;
  white-space: nowrap;
}

.app-main {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.icon-btn {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  font-size: 16px;
  color: var(--text-main);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.icon-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
}

.theme-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: var(--icon-filter);
}
</style>
