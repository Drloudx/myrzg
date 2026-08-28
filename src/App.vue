<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }">
    <!-- 顶部木质导航条 -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-top-row">
          <div class="header-left">
            <img src="/ui/logo.png" class="app-logo" alt="深渊之歌" />
            <div class="header-title-wrap">
              <h1 class="header-title">{{ pageTitle }}</h1>
              <span class="header-brand">深渊之歌 · 资料库</span>
            </div>
          </div>

          <!-- 桌面端全局搜索 -->
          <GlobalSearchBox
            container-class="desktop-search"
            v-model="globalQuery"
            :is-search-open="isSearchOpen"
            :results="filteredSearchIndex"
            @focus="handleSearchFocus"
            @select="handleSelectSearchResult"
          />

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

              <div v-if="isSettingsOpen" class="settings-dropdown paper-panel">
                <div class="dropdown-item" :class="{ 'mobile-only': !isNative }" @click="showMenuModeModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/menu.svg')" class="item-icon" />
                  <span>切换菜单模式</span>
                </div>
                <div class="dropdown-item" @click="showNoticeModal = true; isSettingsOpen = false">
                  <img :src="getImageUrl('/ui/announcement.svg')" class="item-icon" />
                  <span>公告</span>
                </div>
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

        <!-- 移动端搜索行 -->
        <div class="mobile-search-row">
          <GlobalSearchBox
            container-class="mobile-search"
            v-model="globalQuery"
            :is-search-open="isSearchOpen"
            :results="filteredSearchIndex"
            @focus="handleSearchFocus"
            @select="handleSelectSearchResult"
          />
        </div>
      </div>
    </header>

    <!-- 主区域 -->
    <div class="main-layout-row">
      <!-- 电脑端左侧导航 -->
      <div v-if="!isNative" class="desktop-sidebar-container desktop-only">
        <NavigationMenu :is-desktop="true" menu-mode="side" />
      </div>

      <main class="app-main" @click="isSearchOpen = false">
        <!-- 全局物品详情弹窗 -->
        <ItemDetailModal 
          v-model:visible="itemModalState.visible" 
          :item="itemModalState.item"
          :categoryTree="itemModalState.categoryTree" 
        />
        <router-view />
      </main>

      <!-- 右侧页面信息面板（模板 infobox 风格）：放页面标题 + 概况 + 备注区 -->
      <div v-if="!isNative" class="desktop-right-container desktop-only">
        <aside class="page-info-panel paper-panel corner-nails">
          <div class="info-title-bar">
            <span class="info-title-text">{{ pageTitle }}</span>
          </div>
          <div class="info-cover-image"></div>
          <div class="info-body">
            <div class="info-meta-rows">
              <div class="info-row">
                <span class="info-label">当前模块</span>
                <span class="info-value">{{ pageTitle }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">网站版本</span>
                <span class="info-value">v1.0.0</span>
              </div>
              <div class="info-row">
                <span class="info-label">游戏版本</span>
                <span class="info-value">v1.0.0</span>
              </div>
            </div>
            <div class="info-section">
              <h3 class="info-section-title">备注与说明</h3>
              <p class="info-note">
                点击卡片可查看详细属性、词条与来源关系。
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- 移动端导航悬浮按钮 -->
    <div class="nav-fab-btn" :class="{ 'mobile-only': !isNative }" @click.stop="isNavOpen = !isNavOpen" title="功能导航">
      <span></span>
      <span></span>
      <span></span>
    </div>

    <!-- 侧边导航栏 -->
    <NavigationMenu :class="{ 'mobile-only': !isNative }" :is-open="isNavOpen" :menu-mode="menuMode" @close="isNavOpen = false" />
      
    <!-- 全局弹窗 -->
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
      <div class="message-content">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import NavigationMenu from './components/NavigationMenu.vue'
import GlobalSearchBox from './components/GlobalSearchBox.vue'
import UpdateModal from './components/UpdateModal.vue'
import MenuModeModal from './components/MenuModeModal.vue'
import NoticeModal from './components/NoticeModal.vue'
import VersionCheckModal from './components/VersionCheckModal.vue'
import AboutModal from './components/AboutModal.vue'
import BaseModal from './components/BaseModal.vue'
import ItemDetailModal from './components/ItemDetailModal.vue'
import { itemModalState, openItemDetail } from './utils/itemModalState'
import { fetchItemData } from './utils/itemParser'

import { isBlacklisted } from './config/blacklist.js'
import { fetchWithFallback } from './utils/request.js'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { getImageUrl, isNative } from './utils/env.js'

const route = useRoute()
const router = useRouter()

const PAGE_TITLES = {
  '/items': '物品图鉴',
  '/equip': '装备图鉴',
  '/heroes': '角色图鉴',
  '/pets': '魔物图鉴',
  '/monsters': '怪物图鉴',
  '/recipes': '料理图鉴',
  '/rewards': '魔物收益',
  '/achievement': '成就查询',
  '/tasks': '任务图鉴',
  '/events': '事件图鉴',
  '/exchange': '兑换图鉴',
  '/petseggs': '魔物蛋图鉴',
  '/dungeons': '副本图鉴',
  '/other': '其他'
}

const pageTitle = computed(() => {
  return PAGE_TITLES[route.path] || route.meta?.title || '资源库'
})

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

const fetchSearchIndex = async () => {
  if (isIndexLoaded.value) return
  try {
    const res = await fetchWithFallback('data/parsed/search-index.json')
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
  const qParts = q.split(/\s+/).filter(Boolean)
  const validTypes = ['recipe', 'achievement', 'pet', 'pet_egg', 'item', 'role', 'equip', 'monster', 'task', 'event', 'explore', 'exchange', 'hidden']
  const results = searchIndex.value.filter(item => 
    validTypes.includes(item.type) && 
    !isBlacklisted(item) && 
    item.keywords && 
    // 多词查询：每个词都需命中（AND），解决「辛普拉 长子」这类带空格查询失败的问题
    qParts.every(part => item.keywords.includes(part))
  )

  // Sort results to prioritize exact matches and prefix matches
  results.sort((a, b) => {
    const aName = (a.name || '').toLowerCase()
    const bName = (b.name || '').toLowerCase()
    
    const aExact = aName === q ? 1 : 0
    const bExact = bName === q ? 1 : 0
    if (aExact !== bExact) return bExact - aExact
    
    const aStarts = aName.startsWith(q) ? 1 : 0
    const bStarts = bName.startsWith(q) ? 1 : 0
    if (aStarts !== bStarts) return bStarts - aStarts
    
    const aContains = aName.includes(q) ? 1 : 0
    const bContains = bName.includes(q) ? 1 : 0
    if (aContains !== bContains) return bContains - aContains
    
    return 0
  })

  return results
})

const handleSelectSearchResult = async (item) => {
  isSearchOpen.value = false
  
  // Force close any open modals by clearing query
  await router.push({ path: route.path, query: {} })
  
  // Wait a short delay for closing animation, then open the new one
  setTimeout(() => {
    if (item.type === 'item') {
      // If it's an item, add itemId to query while maintaining the current path
      router.push({ query: { itemId: item.id } })
      globalQuery.value = ''
      return
    }

    if (item.type === 'equip') {
      // If it's an equipment, redirect to /equip and open detail modal
      router.push({ path: '/equip', query: { itemId: item.id } })
      globalQuery.value = ''
      return
    }

    if (item.type === 'task') {
      router.push({ path: '/tasks', query: { task: item.id } })
      globalQuery.value = ''
      return
    }
    if (item.type === 'event') {
      router.push({ path: '/events', query: { event: item.id } })
      globalQuery.value = ''
      return
    }
    if (item.type === 'explore') {
      router.push({ path: '/events', query: { tab: 'explore', explore: item.id } })
      globalQuery.value = ''
      return
    }
    if (item.type === 'exchange') {
      router.push({ path: '/exchange' })
      globalQuery.value = ''
      return
    }
    if (item.type === 'hidden') {
      router.push({ path: '/rewards' })
      globalQuery.value = ''
      return
    }

    let targetPath = '/'
    if (item.type === 'pet') targetPath = '/pets'
    else if (item.type === 'pet_egg') targetPath = '/petseggs'
    else if (item.type === 'achievement') targetPath = '/achievement'
    else if (item.type === 'recipe') targetPath = '/recipes'
    else if (item.type === 'monster') targetPath = '/monsters'
    else if (item.type === 'role') targetPath = '/heroes'
    
    router.push({
      path: targetPath,
      query: { id: item.id, q: item.name }
    })
    globalQuery.value = ''
  }, 150)
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

// 全局唤起监听
watch(() => route.query.itemId, async (newId) => {
  if (newId) {
    try {
      const { items, categoryTree } = await fetchItemData()
      const item = items.find(i => i.typeId === newId)
      if (item) {
        openItemDetail(item, categoryTree)
      }
    } catch (e) {
      console.error('Failed to global invoke item:', e)
    }
  }
}, { immediate: true })
</script>

<style scoped>
/* ====== 顶部木质导航条（模板 header 风格） ====== */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-color: transparent;
  color: var(--text-main);
}

.app-header {
  flex-shrink: 0;
  background-color: var(--wood, #2b1f15);
  z-index: 10000;
  padding-top: var(--safe-top);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  border-bottom: 3px solid var(--accent-bright, #7a9a99);
}

.header-content {
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.header-top-row {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: center;
  height: var(--header-height, 60px);
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
}

.app-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
}

.header-title-wrap {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
  color: var(--paper, #dfceb3);
  letter-spacing: 2px;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
}

.header-brand {
  font-size: 11px;
  color: rgba(223, 206, 179, 0.65);
  letter-spacing: 3px;
}

.desktop-search {
  display: flex;
  width: 100%;
  max-width: 100%;
  margin: 0;
}

.mobile-search-row {
  display: none;
  padding-bottom: 10px;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 12px;
  }
  .header-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    height: 52px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .app-logo {
    height: 32px;
    flex-shrink: 0;
  }
  .header-title-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    min-width: 0;
  }
  .header-title {
    font-size: 15px;
    line-height: 1.15;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .header-brand {
    font-size: 10.5px;
    line-height: 1.2;
    white-space: nowrap;
    letter-spacing: 1px;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .header-right {
    width: auto;
    flex-shrink: 0;
    gap: 6px;
  }
  .desktop-search {
    display: none;
  }
  .mobile-search-row {
    display: block;
  }
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: auto;
}

.icon-btn {
  background: rgba(70, 52, 36, 0.85);
  border: 1px solid rgba(143, 115, 81, 0.65);
  color: var(--paper, #dfceb3);
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: inset 0 1px 0 rgba(223, 206, 179, 0.15), 0 2px 4px rgba(0, 0, 0, 0.3);
}
.icon-btn:hover {
  background: rgba(85, 117, 116, 0.5);
  border-color: var(--accent-bright, #7a9a99);
}

.theme-icon-img,
.setting-icon-img {
  width: 19px;
  height: 19px;
  object-fit: contain;
  filter: brightness(0) saturate(100%) invert(88%) sepia(16%) saturate(380%) hue-rotate(345deg) brightness(96%) contrast(88%);
  opacity: 0.95;
  transition: opacity 0.2s ease;
}
.icon-btn:hover .theme-icon-img,
.icon-btn:hover .setting-icon-img {
  opacity: 1;
  filter: brightness(0) saturate(100%) invert(95%) sepia(12%) saturate(300%) hue-rotate(345deg) brightness(102%) contrast(92%);
}

/* ====== 设置下拉菜单（羊皮纸面板） ====== */
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
  top: calc(100% + 10px);
  right: 0;
  width: 176px;
  z-index: 1001;
  padding: 6px;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.45);
  animation: dropdownIn 0.2s ease-out;
}
@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  cursor: pointer;
  color: var(--text-main, #3e2a14);
  font-size: 13px;
  font-weight: 600;
  border-radius: 3px;
  border-bottom: 1px dashed var(--border-faint, rgba(143, 115, 81, 0.25));
  transition: all 0.15s ease;
}
.dropdown-item:last-child {
  border-bottom: none;
}
.dropdown-item:hover {
  background-color: var(--hover-bg, rgba(85, 117, 116, 0.14));
  color: var(--accent-ink, #557574);
}
.dropdown-item .item-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  filter: var(--icon-filter, invert(1));
}

/* ====== 移动端悬浮导航按钮（木质） ====== */
.nav-fab-btn {
  position: fixed;
  right: 20px;
  bottom: calc(80px + var(--safe-bottom));
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--wood-soft, #463424), var(--wood, #2b1f15));
  border: 2px solid var(--border-color, #8f7351);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(223, 206, 179, 0.3);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  z-index: 4000;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
}
.nav-fab-btn span {
  display: block;
  width: 19px;
  height: 2px;
  background-color: var(--paper, #dfceb3);
  border-radius: 2px;
  transition: all 0.2s;
}
.nav-fab-btn:hover {
  transform: translateY(-4px);
  border-color: var(--accent-bright, #7a9a99);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
}
.nav-fab-btn:active {
  transform: translateY(-2px);
  filter: brightness(0.9);
}

/* ====== 主区域布局（三列等高 grid，严格与 ui模板.html 对齐：左 250 / 中 1fr / 右 300，间距 20px，顶部留白 30px） ====== */
.app-main {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 1025px) {
  .mobile-only {
    display: none !important;
  }
  .desktop-only {
    display: block;
  }
}
@media (max-width: 1024px) {
  .desktop-only,
  .desktop-sidebar-container,
  .desktop-right-container {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
}

.main-layout-row {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 300px;
  gap: 20px;
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px 20px 20px 20px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  min-height: 0;
}

.desktop-sidebar-container {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.desktop-right-container {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 移动端/平板端：彻底隐藏左右侧边栏与右侧信息区，中间主视图全屏铺满 */
@media (max-width: 1024px) {
  .main-layout-row {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    flex: 1 !important;
    min-height: 0 !important;
    min-width: 0 !important;
    padding: 8px 8px calc(8px + var(--safe-bottom, 0px)) 8px !important;
    margin: 0 !important;
    gap: 0 !important;
    overflow: hidden !important;
  }
  .app-main {
    width: 100% !important;
    height: 100% !important;
    flex: 1 !important;
    min-height: 0 !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }
}

/* 右侧页面信息面板（模板 .infobox 风格）：与左侧导航栏等高（height: 100%） */
.page-info-panel {
  width: 100%;
  height: 100%;
  flex: 1;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}
.info-title-bar {
  background-color: var(--border-color, #8f7351);
  color: var(--paper, #dfceb3);
  text-align: center;
  padding: 10px 14px;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 2px;
  border-bottom: 2px solid #5c4327;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.info-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.info-cover-image {
  width: 100%;
  height: 110px;
  background-image: url('/ui/map_w1_bg.png');
  background-position: center;
  background-size: cover;
  border-bottom: 1px solid var(--border-color, #8f7351);
}
.info-body {
  padding: 14px 16px;
  flex: 1;
  overflow-y: auto;
}
.info-meta-rows {
  margin-bottom: 14px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  font-size: 13px;
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.info-value {
  color: var(--text-main, #3e2a14);
  font-weight: 600;
}
.info-section {
  margin-top: 4px;
}
.info-section-title {
  margin: 8px 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  border-bottom: 1px solid var(--border-color, #8f7351);
  padding-bottom: 5px;
  letter-spacing: 1px;
}
.info-note {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-muted, #6b5134);
  line-height: 1.65;
}

/* 全局消息弹窗文本 */
.message-content {
  text-align: center;
  padding: 10px 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
