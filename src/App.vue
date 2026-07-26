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
                :src="isDarkMode ? getImageUrl('/ui/theme-light.svg') : getImageUrl('/ui/theme-dark.svg')"
                class="theme-icon-img"
                alt="主题切换"
                loading="lazy"
              />
            </button>
            <div class="settings-container">
              <button class="icon-btn" @click.stop="toggleSettings" title="设置">
                <img :src="getImageUrl('/ui/setting.svg')" alt="设置" class="setting-icon-img" />
              </button>

              <!-- 点击外部关闭的透明遮罩 -->
              <div v-if="isSettingsOpen" class="settings-mask" @click.stop="isSettingsOpen = false"></div>

              <div v-if="isSettingsOpen" class="settings-dropdown">
                <div class="dropdown-item" :class="{ 'mobile-only': !isNative }" @click="showMenuModeModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/menu.svg')" class="item-icon" />
                  <span>切换菜单模式</span>
                </div>
                <div class="dropdown-item" @click="showNoticeModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/announcement.svg')" class="item-icon" />
                  <span>公告</span>
                </div>
<!--                 <div class="dropdown-item" v-if="isNative" @click="showVersionCheckModal = true; isSettingsOpen = false">-->
<!--                  <img :src="getImageUrl('/ui/update.svg')" class="item-icon" />-->
<!--                  <span>版本检查</span>-->
<!--                </div>-->
                <div class="dropdown-item" @click="showVersionCheckModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/update.svg')" class="item-icon" />
                  <span>版本检查</span>
                </div>
                <div class="dropdown-item" @click="showAboutModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/we.svg')" class="item-icon" />
                  <span>关于我们</span>
                </div>
                <div class="dropdown-item" @click="handleExportData(); isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/export .svg')" class="item-icon" />
                  <span>导出数据</span>
                </div>
                <div class="dropdown-item" @click="triggerUniversalImport(); isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/output.svg')" class="item-icon" />
                  <span>导入数据</span>
                </div>
              </div>
            </div>
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
    <div class="main-layout-row">
      <!-- 电脑端侧边栏 (原版组件，仅在宽屏显示) -->
      <div v-if="!isNative" class="desktop-sidebar-container desktop-only">
        <NavigationMenu :is-desktop="true" menu-mode="side" />
      </div>

      <main class="app-main" @click="isSearchOpen = false">
        <router-view />
      </main>

      <!-- 右侧空白占位，保证 app-main 完美居中 -->
      <div v-if="!isNative" class="desktop-right-spacer desktop-only"></div>
    </div>

    <!-- Navigation (FAB Button) -->
    <div class="nav-fab-btn" :class="{ 'mobile-only': !isNative }" @click.stop="isNavOpen = !isNavOpen" title="功能导航">
      <span></span>
      <span></span>
      <span></span>
    </div>

    <!-- 侧边导航栏 -->
    <NavigationMenu :class="{ 'mobile-only': !isNative }" :is-open="isNavOpen" :menu-mode="menuMode" @close="isNavOpen = false" />

    <!-- Hot Update Modal -->
    <UpdateModal ref="updateModalRef" />
    <MenuModeModal v-model="showMenuModeModal" v-model:mode="menuMode" />
    <NoticeModal v-model="showNoticeModal" />
    <VersionCheckModal v-model="showVersionCheckModal" @request-update="handleRequestUpdate" />
    <AboutModal v-model="showAboutModal" />
    
    <BaseModal 
      :visible="showMessageModal" 
      :title="messageTitle" 
      @close="onMessageModalClose(false)"
    >
      <div class="message-content" style="text-align: center; padding: 10px 0; font-size: 14px; color: var(--text-main);">
        {{ messageText }}
      </div>
      <template #footer>
        <button class="modal-btn-confirm" @click="onMessageModalClose(false)">确定</button>
      </template>
    </BaseModal>
    
    <input
      type="file"
      ref="universalFileInput"
      style="display: none"
      accept=".json"
      @change="handleUniversalImport"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import NavigationMenu from './components/NavigationMenu.vue'
import UpdateModal from './components/UpdateModal.vue'
import MenuModeModal from './components/MenuModeModal.vue'
import NoticeModal from './components/NoticeModal.vue'
import VersionCheckModal from './components/VersionCheckModal.vue'
import AboutModal from './components/AboutModal.vue'
import BaseModal from './components/BaseModal.vue'

import { isBlacklisted } from './config/blacklist.js'
import { fetchWithFallback } from './utils/request.js'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { getImageUrl, isNative } from './utils/env.js'

const route = useRoute()
const router = useRouter()

const currentRoute = computed(() => route.path)
const handleNavigate = (path) => {
  if (currentRoute.value !== path) {
    router.push(path)
  }
}

const isNavOpen = ref(false)
const isDarkMode = ref(false)
const globalQuery = ref('')
const isSearchOpen = ref(false)
const searchIndex = ref([])

// 新增设置菜单和弹窗状态
const isSettingsOpen = ref(false)
const showMenuModeModal = ref(false)
const showNoticeModal = ref(false)
const showVersionCheckModal = ref(false)
const showAboutModal = ref(false)
const showMessageModal = ref(false)
const messageTitle = ref('提示')
const messageText = ref('')
const messageCallback = ref(null)

const menuMode = ref(localStorage.getItem('menuMode') || 'side')
const universalFileInput = ref(null)

const showMessage = (text, title = '提示', callback = null) => {
  messageTitle.value = title
  messageText.value = text
  messageCallback.value = callback
  showMessageModal.value = true
}

const onMessageModalClose = () => {
  showMessageModal.value = false
  if (messageCallback.value) {
    messageCallback.value()
    messageCallback.value = null
  }
}

const toggleSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
}

const handleExportData = async () => {
  try {
    const appState = JSON.parse(localStorage.getItem('appState') || '{}')
    
    const data = {
      timestamp: Date.now(),
      version: '1.0',
      type: 'myrzg_backup',
      data: {
        appState
      }
    }
    const jsonStr = JSON.stringify(data)
    const fileName = `myrzg_backup_${new Date().getTime()}.json`

    if (isNative) {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: jsonStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      })
      await Share.share({
        title: '导出深渊之歌数据',
        url: result.uri,
        dialogTitle: '保存或分享数据备份'
      })
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('导出失败:', error)
    showMessage('导出失败: ' + error.message, '错误')
  }
}

const triggerUniversalImport = () => {
  if (universalFileInput.value) {
    universalFileInput.value.click()
  }
}

const handleUniversalImport = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result)
      if (parsed.type !== 'myrzg_backup') {
        throw new Error('无效的备份文件')
      }
      if (parsed.data && parsed.data.appState) {
        localStorage.setItem('appState', JSON.stringify(parsed.data.appState))
      }
      showMessage('数据导入成功，即将刷新页面', '成功', () => {
        location.reload()
      })
    } catch (err) {
      showMessage('导入失败: ' + err.message, '错误')
    }
  }
  reader.readAsText(file)
  event.target.value = '' // reset input
}

const updateModalRef = ref(null)

const handleRequestUpdate = (info) => {
  if (updateModalRef.value) {
    updateModalRef.value.startUpdateWithInfo(info)
  }
}

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
    const res = await fetchWithFallback('data/search-index.json')
    searchIndex.value = res
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
  const validTypes = ['recipe', 'achievement', 'pet']
  return searchIndex.value.filter(item => 
    validTypes.includes(item.type) && 
    !isBlacklisted(item) && 
    item.keywords && 
    item.keywords.includes(q)
  )
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

  // 处理原生 Android 物理返回键/侧滑返回
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1. 如果菜单开着，先关菜单
      if (isNavOpen.value) {
        isNavOpen.value = false
        return
      }
      // 2. 如果搜索栏开着，清空搜索栏
      if (isSearchOpen.value && globalQuery.value) {
        globalQuery.value = ''
        return
      }
      
      // 3. 如果在首页（无论是默认的还是明确在 / 路径），则退出软件
      if (route.path === '/' || route.path === '/recipes' || !canGoBack) {
        CapApp.exitApp()
      } else {
        // 否则返回上一页
        router.back()
      }
    })
  }
})
</script>

<style scoped>
/* 顶部设置与下拉菜单 */
.settings-container {
  position: relative;
  display: flex;
  align-items: center;
}

.settings-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.settings-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 160px;
  z-index: 1001;
  background: var(--bg-color, #ffffff);
  border-radius: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  animation: slideDown 0.2s ease-out;
  overflow: hidden;
}

.dark-mode .settings-dropdown {
  background: #1e1e1e;
  border-color: #333;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--text-color, #333);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.dark-mode .dropdown-item {
  color: #fff;
}

.dropdown-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dark-mode .dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.dropdown-item .item-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  margin-left: 0;
  filter: var(--icon-filter, none);
}

.setting-icon-img {
  width: 20px;
  height: 20px;
  filter: var(--icon-filter, none);
  transition: transform 0.2s;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nav-fab-btn {
  position: fixed;
  right: 20px;
  bottom: calc(80px + var(--safe-bottom));
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--bg-color, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  z-index: 990;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 16px #00000026;
}

.dark-mode .nav-fab-btn {
  background: var(--card-bg, #ffffff);
  border-color: rgba(255, 255, 255, 0.1);
}

.nav-fab-btn span {
  display: block;
  width: 18px;
  height: 2px;
  background-color: var(--text-color, #333);
  border-radius: 2px;
  transition: all 0.2s;
}

.dark-mode .nav-fab-btn span {
  background-color: #fff;
}

.nav-fab-btn:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}

.nav-fab-btn:active {
  transform: translateY(-2px);
  filter: brightness(0.9);
}

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
  height: 42px;
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
  font-size: 14px;
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
  flex: 0 1 800px;
  width: 100%;
  max-width: 800px;
  overflow: hidden;
  position: relative;
}

/* 桌面端/移动端显示控制 (仅用于 Web 端的响应式降级) */
@media (min-width: 769px) {
  .mobile-only {
    display: none !important;
  }
}
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
}

/* 整体排版行 (3列布局保证中间内容完美居中) */
.main-layout-row {
  display: flex;
  flex: 1;
  width: 100%;
  position: relative;
  overflow: hidden;
}

/* 桌面端左侧容器 */
.desktop-sidebar-container {
  flex: 1;
  display: flex;
  justify-content: flex-end; /* 使侧边栏贴靠在中间内容的左侧 */
  padding-right: 0px;
  overflow-y: auto;
}

/* 桌面端右侧空白占位 */
.desktop-right-spacer {
  flex: 1;
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
