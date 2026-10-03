<template>
  <div
    ref="appScrollRoot"
    class="app-container"
    :class="{ 'dark-theme': isDarkMode, 'is-native-shell': isNative, 'is-mail-reader': route.path === '/partner-mails', 'is-gacha-stage': isGachaFullscreen }"
    @scroll.passive="scheduleStickyClipping"
  >
    <!-- 顶部木质导航条 -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-top-row">
          <div class="header-left">
            <img :src="getImageUrl('/ui/logo.webp')" class="app-logo" alt="深渊之歌" />
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
            <!--
              深色模式切换：暂时隐藏，功能代码完整保留（useNativeShell 的 isDarkMode /
              toggleDarkMode 与 html.dark-mode 样式都没删）。深色模式尚有未解决的问题，
              等修好后再用 v-if 恢复这个按钮即可。localStorage 里已存的 theme=dark
              仍会在启动时生效，不会因为按钮隐藏而失效。
            -->
            <button
              v-if="showThemeToggle"
              class="icon-btn"
              @click="toggleDarkMode"
              :title="isDarkMode ? '切换浅色模式' : '切换暗色模式'"
            >
              <img
                :src="isDarkMode ? getImageUrl('/ui/theme-light.svg') : getImageUrl('/ui/theme-dark.svg')"
                class="theme-icon-img"
                alt="主题切换"
                loading="lazy"
              />
            </button>

            <!-- 讨论区入口：进入独立路由 /#/discussions（不在当前页就地替换，
                 这样链接可分享可刷新、滚动天然隔离，也不用 11 个视图各自接入聊天状态） -->
            <button
              class="icon-btn"
              :class="{ 'is-active': route.path === '/discussions' }"
              @click.stop="openDiscussions"
              :title="route.path === '/discussions' ? '返回上一页' : '讨论区'"
            >
              <img :src="getImageUrl('/ui/chat-bubble.svg')" alt="讨论区" class="theme-icon-img" />
            </button>

            <!-- 账号：点击弹出账号面板 -->
            <button class="icon-btn" @click.stop="isAccountOpen = true" title="账号">
              <img :src="getImageUrl('/ui/account.svg')" alt="账号" class="theme-icon-img" />
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

      <!-- 右栏：讨论区预览（用户要求把原「页面信息面板」换成讨论）。
           原面板放的是当前模块/网站版本/游戏版本/交流群/备注；
           按用户决定替换为讨论预览。**交流群链接保留在底部**（拉新入口）；
           版本号原是硬编码 v1.0.0、仓库内仅此一处，随面板一并移除。
           卡池页是固定设计分辨率画面，隐藏右栏把宽度让给设计画布。 -->
      <div v-if="!isNative && route.path !== '/gacha'" class="desktop-right-container desktop-only">
        <aside class="page-info-panel paper-panel corner-nails">
          <div class="info-title-bar">
            <button type="button" class="info-title-text info-title-link" @click="openDiscussions">
              最新讨论
            </button>
            <!-- 进入讨论区：放在标题栏右侧（用户指定位置）。
                 用文字「进入→」而不是箭头图形符号——后者在这套羊皮纸样式里显得突兀 -->
            <button type="button" class="info-title-enter" @click="openDiscussions">进入→</button>
          </div>
          <div class="info-body">
            <!-- 最近几条（只读、不放输入框）：点开进入讨论区 -->
            <div class="recent-discussions">
              <UiEmptyState v-if="recentLoading" type="loading" text="加载中..." />
              <p v-else-if="!recentComments.length" class="info-note">还没有讨论。</p>
              <ul v-else class="recent-list">
                <li v-for="c in recentComments" :key="c.id" class="recent-item">
                  <button type="button" class="recent-btn" @click="openDiscussionFor(c)">
                    <!-- 缩小的头像：与讨论区里一致，没有头像时用昵称首字占位 -->
                    <img
                      v-if="recentAvatarUrl(c.avatar)"
                      class="recent-avatar"
                      :src="recentAvatarUrl(c.avatar)"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span v-else class="recent-avatar recent-avatar-fallback" aria-hidden="true">
                      {{ (c.nick || '?').slice(0, 1) }}
                    </span>
                    <span class="recent-main">
                      <!-- 不显示「站内讨论区」标签：这里本来就只放站内讨论区的内容，
                           每条都标一遍是冗余（用户要求删掉） -->
                      <span class="recent-nick">{{ c.nick }}</span>
                      <span class="recent-body">{{ c.body }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>

            <div class="info-section recent-foot">
              <!-- 交流群：原信息面板的唯一入口，保留。配色与「进入讨论区」按钮一致 -->
              <p class="info-note recent-group">
                交流群
                <a
                  class="recent-group-link"
                  href="https://qm.qq.com/q/iolDkZyD2E"
                  target="_blank"
                  rel="noopener noreferrer"
                >963318625</a>
              </p>
            </div>

            <SidebarMascot v-if="mascotDesktop" />
          </div>
        </aside>
      </div>
    </div>

    <!-- 移动端导航悬浮按钮（模拟招募为整页游戏画面，不显示） -->
    <button v-if="!isGachaFullscreen" type="button" class="nav-fab-btn" :class="{ 'mobile-only': !isNative }" @click.stop="isNavOpen = !isNavOpen" title="功能导航" aria-label="功能导航">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <!-- 侧边导航栏（模拟招募为整页游戏画面，不显示） -->
    <NavigationMenu v-if="!isGachaFullscreen" :class="{ 'mobile-only': !isNative }" :is-open="isNavOpen" :menu-mode="menuMode" @close="isNavOpen = false" />
      
    <!-- 全局弹窗 -->
    <UpdateModal ref="updateModalRef" />
    <MenuModeModal v-model="showMenuModeModal" v-model:mode="menuMode" />
    <NoticeModal v-model="showNoticeModal" />
    <VersionCheckModal v-model="showVersionCheckModal" @request-update="handleRequestUpdate" />
    <AboutModal v-model="showAboutModal" />
    <AccountModal v-model="isAccountOpen" />
    <UiModal
      :visible="!!itemLoadError"
      title="物品详情加载失败"
      max-width="480px"
      scroll-id="itemLoadErrorScroll"
      teleport-to="body"
      @update:visible="dismissItemLoadError"
    >
      <div class="message-content">{{ itemLoadError }}</div>
      <template #footer>
        <UiButton @click="loadGlobalItem(route.query.itemId)">重新加载</UiButton>
      </template>
    </UiModal>
    
    <RewardProbabilityModal />

    <UiModal
      v-model:visible="showMessageModal"
      :title="messageTitle"
      max-width="480px"
      :z-index="12000"
      teleport-to="body"
      @close="onMessageModalClose"
    >
      <div class="message-content">{{ messageText }}</div>
      <template #footer>
        <UiButton @click="onMessageModalClose">确定</UiButton>
      </template>
    </UiModal>
    
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
import { ref, computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavigationMenu from './components/NavigationMenu.vue'
import GlobalSearchBox from './components/GlobalSearchBox.vue'
import UpdateModal from './components/UpdateModal.vue'
import MenuModeModal from './components/MenuModeModal.vue'
import NoticeModal from './components/NoticeModal.vue'
import VersionCheckModal from './components/VersionCheckModal.vue'
import AboutModal from './components/AboutModal.vue'
import AccountModal from './components/AccountModal.vue'
import { loadIdentity, registerAccountModal, avatarPath, avatarCatalogState, loadAvatarCatalog } from './utils/identity.js'
import { fetchRecentComments } from './utils/commentApi.js'
import { lastPostedComment, commentPostedAt } from './utils/commentEvents.js'
import { UiButton, UiEmptyState, UiModal } from './components/ui/index.js'
import ItemDetailModal from './components/ItemDetailModal.vue'
import RewardProbabilityModal from './components/RewardProbabilityModal.vue'
import { itemModalState, openItemDetail } from './utils/itemModalState'
import { fetchItemData } from './utils/itemParser'
import { resetModalScrollCoordinator } from './utils/modalScrollCoordinator.js'
import { prefetchRouteChunks } from './router/index.js'

import { isBlacklisted } from './config/blacklist.js'
import { getImageUrl, handleImageFallback, isNative } from './utils/env.js'
import { useBackupData } from './composables/app/useBackupData.js'
import { useGlobalSearch } from './composables/app/useGlobalSearch.js'
import { useNativeShell } from './composables/app/useNativeShell.js'
import { useOverlay } from './composables/useOverlay.js'

const route = useRoute()
const router = useRouter()

// Load the decorative SVG only when the desktop information panel can be shown.
const SidebarMascot = defineAsyncComponent(() => import('./components/SidebarMascot.vue'))
const mascotDesktop = ref(false)
let mascotViewport
const updateMascotViewport = () => { mascotDesktop.value = !isNative && mascotViewport.matches }
onMounted(() => {
  mascotViewport = window.matchMedia('(min-width: 1025px) and (min-height: 700px)')
  updateMascotViewport()
  mascotViewport.addEventListener('change', updateMascotViewport)
})
onBeforeUnmount(() => mascotViewport?.removeEventListener('change', updateMascotViewport))

const PAGE_TITLES = {
  '/items': '物品图鉴',
  '/furniture': '家具图鉴',
  '/facilities': '设施功能',
  '/equip': '装备图鉴',
  '/runes': '符石图鉴',
  '/heroes': '角色图鉴',
  '/partner-mails': '伙伴邮件',
  '/pets': '魔物图鉴',
  '/monsters': '怪物图鉴',
  '/recipes': '菜谱查询',
  '/rewards': '其他',
  '/achievement': '成就查询',
  '/tasks': '任务图鉴',
  '/events': '事件图鉴',
  '/exchange': '兑换',
  '/petseggs': '魔物收益',
  '/dungeons': '副本图鉴',
  '/chapters': '关卡图鉴',
  '/glossary': '词条',
  '/gacha': '模拟招募',
  '/admin': '评论管理',
  '/discussions': '讨论区'
}

const pageTitle = computed(() => {
  return PAGE_TITLES[route.path] || route.meta?.title || '资源库'
})

/** 模拟招募是整页游戏画面：隐藏 Wiki 顶栏与左右栏，画布独占视口（背板由页面自己提供）。 */
const isGachaFullscreen = computed(() => route.path === '/gacha')

const isNavOpen = ref(false)
const { globalQuery, isSearchOpen, filteredSearchIndex, handleSearchFocus, handleSelectSearchResult } = useGlobalSearch(route, router)
const { isDarkMode, toggleDarkMode } = useNativeShell()

/**
 * 深色模式切换按钮是否显示。
 * 暂时关闭：按钮位置改成了账号入口，而深色模式自身还有问题待修。
 * 代码与 `html.dark-mode` 样式、localStorage 持久化都完整保留，改回 true 即恢复。
 */
const showThemeToggle = false

/** 账号弹窗可见性 */
const isAccountOpen = ref(false)

/**
 * 打开/离开讨论区。
 *
 * 讨论区是独立路由（不在当前页就地替换内容区）：链接可分享可刷新、
 * 滚动天然隔离在内容区里，也不必让 11 个视图各自接入"聊天模式"状态。
 * 在讨论区内再点一次 = 返回上一页。
 */
function openDiscussions() {
  if (route.path === '/discussions') {
    router.back()
    return
  }
  // 从物品详情进入时带上当前物品，讨论区默认定位到它（见 DiscussionsView）
  const query = {}
  if (route.query.itemId) query.page = `item:${route.query.itemId}`
  router.push({ path: '/discussions', query })
}

/** 右栏"最新讨论"：跳到那条讨论所属页面的讨论 */
function openDiscussionFor(comment) {
  router.push({
    path: '/discussions',
    query: { page: comment.pageKey, label: comment.pageLabel || '' }
  })
}

/**
 * 右栏的最近讨论。**数据由服务端带 30 秒边缘共享缓存**（`GET /api/recent`），
 * 所以右栏在每个页面都可见，也不会变成"每打开一页查一次库"。
 *
 * 刷新时机有三个，缺一不可：
 *   1. **路由变化**——覆盖站内切页，但**15 秒节流**（`allowThrottled` 可强制穿透）；
 *   2. **本机发表评论后**（监听 commentEvents 广播，绕过缓存）——
 *      实测踩到的坑：本站是 hash 路由，站内发帖**不改变路由也不重载应用**，
 *      光靠时机 1 会看到"刚发的评论只在左边、右栏还是旧的"；
 *   3. **30 秒定时 + 从后台切回时刷新**——让**别人发的**也能出现：
 *      用户停在某页不动时，光靠前两个时机右栏会一直停在旧内容。
 *
 * 三个时机都走 `fresh`（跳服务端共享缓存 + 时间戳穿透中间层缓存），
 * 否则会撞上 30 秒缓存窗口看到旧快照（实测：切页后新评论仍不出现）。
 */
const recentComments = ref([])
const recentLoading = ref(false)
/** 是否已经成功载入过——用来避免"重拉时先把列表抹成加载态"的闪烁 */
const recentLoaded = ref(false)
const RECENT_CLIENT_THROTTLE_MS = 15000
let recentFetchedAt = 0
let recentInFlight = false

async function loadRecentDiscussions({ fresh = false, allowThrottled = false } = {}) {
  if (recentInFlight) return
  if (!allowThrottled && !fresh && Date.now() - recentFetchedAt < RECENT_CLIENT_THROTTLE_MS) return
  recentInFlight = true
  // 只在**首次**载入时显示加载态：已有内容时静默替换，否则列表会先被抹掉再重建（闪一下）
  if (!recentLoaded.value) recentLoading.value = true
  try {
    const data = await fetchRecentComments({ fresh })
    /*
     * 接口按"最新在前"返回。右栏要与站内讨论区**同一种阅读顺序**（最新在下），
     * 所以先取最新 5 条、再整体反转成"时间正序"——否则用户会觉得
     * "左边最新在下面、右边最新在上面"，两处对不上（实测被指出过）。
     */
    recentComments.value = (data?.comments || []).slice(0, 5).reverse()
    recentLoaded.value = true
    recentFetchedAt = Date.now()
  } catch {
    // 右栏是辅助信息：失败**保留已有内容**（清空会让它闪一下变成空态），首次失败才留空
    if (!recentLoaded.value) recentComments.value = []
  } finally {
    recentInFlight = false
    recentLoading.value = false
  }
}

/**
 * 本机发表成功后**直接把新评论插进右栏**，不重新拉取。
 *
 * 重新拉取会把整个列表替换掉（即使内容一样，DOM 也会被销毁重建），
 * 用户看到的就是"右栏闪一下"（实测反馈）。站内讨论区在本站是唯一评论入口，
 * 所以新评论一定属于 `site:general`，直接插入即可。
 */
function addRecentComment(comment) {
  if (!comment?.id) return
  if (recentComments.value.some((c) => c.id === comment.id)) return
  // 最新在下：追加到末尾；超过 5 条时丢掉最旧的一条
  const next = [...recentComments.value, comment]
  recentComments.value = next.slice(-5)
  recentLoaded.value = true
}


// 站内切页时刷新右栏。**绕过节流**：用户切页是明确意图，且服务端共享缓存让开销可控
watch(() => route.fullPath, () => loadRecentDiscussions({ fresh: true }))
// 本机发表评论后**直接把那一条插进右栏**（不重新拉取，列表不重建、不闪）
watch(commentPostedAt, () => addRecentComment(lastPostedComment.value))

/**
 * 定时刷新右栏，让**别人发的**评论也能出现。
 * 间隔与服务端共享缓存的窗口对齐，所以多数轮询会命中缓存、不落库。
 * 页面隐藏时跳过（后台标签页不做无意义请求）。
 */
const RECENT_POLL_MS = 30000
let recentTimer = 0

function startRecentPolling() {
  stopRecentPolling()
  recentTimer = window.setInterval(() => {
    if (document.visibilityState === 'hidden') return
    loadRecentDiscussions({ fresh: true })
  }, RECENT_POLL_MS)
}

function stopRecentPolling() {
  if (recentTimer) {
    window.clearInterval(recentTimer)
    recentTimer = 0
  }
}

/** 从后台切回前台时立即刷新一次（用户回来的第一眼应该是最新的） */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') loadRecentDiscussions({ fresh: true })
}

/**
 * 右栏每条评论的缩小头像路径。
 * 用与讨论区同一份头像清单（`avatarPath`），没有清单或 ID 未知时返回空串，
 * 模板会退化用昵称首字占位。
 */
function recentAvatarUrl(id) {
  const path = avatarPath(id)
  return path ? getImageUrl(path) : ''
}

// 右栏有带头像的评论时才需要清单（与讨论区同样的按需加载）
watch(
  recentComments,
  (list) => {
    if (list.some((c) => c.avatar) && avatarCatalogState.value === 'idle') loadAvatarCatalog()
  },
  { immediate: true }
)

/**
 * 本机身份（昵称 + 头像）与账号弹窗的接线：
 *   - 启动时读一次 localStorage，评论面板与账号弹窗共用同一份响应式状态；
 *   - 把"打开账号弹窗"注册给 identity 模块，评论面板在未设昵称时调用它，
 *     从而不必让子组件各自维护一份弹窗开关（页面上只有一个账号弹窗）。
 */
loadIdentity()
registerAccountModal(() => {
  isAccountOpen.value = true
})
// 右栏的"最新讨论"：首屏就绪后拉一次（服务端有 30 秒边缘缓存，成本可控）
loadRecentDiscussions()

// 新增设置菜单和弹窗状态
const isSettingsOpen = ref(false)
useOverlay(isNavOpen, { priority: 6001, close: () => { isNavOpen.value = false } })
useOverlay(() => isSearchOpen.value && !!globalQuery.value.trim(), {
  priority: 11000,
  close: () => { isSearchOpen.value = false; document.activeElement?.blur() }
})
useOverlay(isSettingsOpen, { priority: 11001, close: () => { isSettingsOpen.value = false } })
const showMenuModeModal = ref(false)
const showNoticeModal = ref(false)
const showVersionCheckModal = ref(false)
const showAboutModal = ref(false)
const showMessageModal = ref(false)
const messageTitle = ref('提示')
const messageText = ref('')
const messageCallback = ref(null)

const menuMode = ref(localStorage.getItem('menuMode') || 'side')
const appScrollRoot = ref(null)
let stickyClipFrame = 0
let pendingClearRaf = 0

/**
 * 页面切换期间顶住滚动范围：切页瞬间记录旧页滚动高度（此刻旧 DOM 仍在），
 * 写入 .main-layout-row 的 --route-pending-h 行内变量作为临时 min-height，
 * 新页加载骨架消失（loading/error 空态移除）后撤销，避免加载间隙滚动条拇指闪变。
 */
const setRoutePending = () => {
  const root = appScrollRoot.value
  const row = document.querySelector('.main-layout-row')
  if (!root || !row || window.innerWidth < 1025) return
  const h = Math.max(root.scrollHeight, 1)
  row.style.setProperty('--route-pending-h', `${h}px`)
  row.classList.add('is-route-pending')
  if (pendingClearRaf) cancelAnimationFrame(pendingClearRaf)
  const started = performance.now()
  const poll = () => {
    const page = document.querySelector('.page-view-container')
    const done = !page || !page.querySelector('.ui-empty-state--loading, .ui-empty-state--error')
    if (done || performance.now() - started > 4000) {
      document.querySelectorAll('.main-layout-row.is-route-pending').forEach(r => r.classList.remove('is-route-pending'))
      pendingClearRaf = 0
      return
    }
    pendingClearRaf = requestAnimationFrame(poll)
  }
  pendingClearRaf = requestAnimationFrame(poll)
}

const setClipTop = (element, boundary) => {
  if (!element) return
  const clipTop = Math.max(0, boundary - element.getBoundingClientRect().top)
  element.style.setProperty('--sticky-clip-top', `${clipTop}px`)
}

const updateStickyClipping = () => {
  stickyClipFrame = 0
  if (window.innerWidth < 1025) return

  document.querySelectorAll('.page-view-container').forEach(page => {
    const filter = page.querySelector(':scope > .filter-panel, :scope > .filter-sticky-bar, :scope > [class*="-filter-panel"]')
    if (!filter) return
    const boundary = filter.getBoundingClientRect().bottom
    page.querySelectorAll('[data-main-scroll]').forEach(content => setClipTop(content, boundary))
  })

  document.querySelectorAll('.ui-modal-overlay:not(.is-teleported)').forEach(modal => {
    const header = modal.querySelector('.ui-modal-header')
    const body = modal.querySelector('.ui-modal-body')
    if (header && body) setClipTop(body, header.getBoundingClientRect().bottom)
  })

  syncInlineModalAlignment()
}

/**
 * 内嵌弹窗兜底对齐：弹窗打开且页面在顶部时，把弹窗/中间容器高度
 * 强算为「两栏底边 - 弹窗顶部」，保证与左右两栏底边齐平。底层页面
 * 的显示隐藏由 UiModal 的统一 CSS 生命周期接管，避免关闭过渡时闪现。
 */
const syncInlineModalAlignment = () => {
  if (window.innerWidth < 1025) return
  const root = appScrollRoot.value
  const rightCol = document.querySelector('.desktop-right-container')
  const appMain = document.querySelector('.app-main')
  const overlay = appMain?.querySelector(':scope > .ui-modal-host > .ui-modal-overlay:not(.is-teleported)')
  const pv = appMain ? appMain.querySelector('.page-view-container') : null
  const modalOpen = !!overlay
  // 页面级弹窗（角色/事件/副本等，UiModal 渲染在 .page-view-container 内部）由 CSS 接管，
  // JS 不干预。跨路由时旧 App 弹窗可能仍在退场，必须先清掉它留在新页面上的行内隐藏。
  const pageOverlay = pv?.querySelector(':scope > .ui-modal-host > .ui-modal-overlay:not(.is-teleported)')
  if (pageOverlay) {
    if (overlay) overlay.style.removeProperty('min-height')
    if (appMain?.style.minHeight) appMain.style.removeProperty('min-height')
    return
  }
  if (modalOpen && root && root.scrollTop <= 2 && rightCol && overlay && appMain) {
    // 用 appMain.top（稳定值）而非 overlay.top（进入动画 translateY 期间会偏移）计算目标高度
    const h = Math.max(rightCol.getBoundingClientRect().bottom - appMain.getBoundingClientRect().top, 1)
    overlay.style.minHeight = `${h}px`
    appMain.style.minHeight = `${h}px`
  } else {
    if (overlay) overlay.style.removeProperty('min-height')
    if (appMain && appMain.style.minHeight) appMain.style.removeProperty('min-height')
  }
}

const scheduleStickyClipping = () => {
  if (stickyClipFrame) return
  stickyClipFrame = window.requestAnimationFrame(updateStickyClipping)
}

let bootLoadingRaf = 0
let mainObserver = null
const handleGlobalImageError = event => {
  if (!(event.target instanceof HTMLImageElement) || event.target.closest('[data-image-fallback="custom"]')) return
  handleImageFallback(event)
  // Legacy handlers used to hide failed images; let the shared fallback finish first.
  event.stopImmediatePropagation()
}

onMounted(() => {
  document.addEventListener('error', handleGlobalImageError, true)
  window.addEventListener('resize', scheduleStickyClipping, { passive: true })
  scheduleStickyClipping()
  // 中间区内容变化（弹窗开合/列表渲染/懒加载）→ 节流重算三栏对齐与 sticky 剪裁
  const mainEl = document.querySelector('.app-main')
  if (mainEl && 'MutationObserver' in window) {
    mainObserver = new MutationObserver(() => scheduleStickyClipping())
    mainObserver.observe(mainEl, { childList: true, subtree: true })
  }
  // 首屏：骨架期隐藏滚动条（gutter 仍占位不横跳），首个页面数据就绪后以终态尺寸亮出
  const rootEl = appScrollRoot.value
  if (rootEl && window.innerWidth >= 1025) {
    rootEl.classList.add('is-boot-loading')
    const started = performance.now()
    let doneFrames = 0
    const reveal = () => {
      // 必须「页面已挂载 且 无 loading/error 骨架」才算就绪：
      // router-view 初始解析空窗期页面尚未出现，不能误判为就绪（否则骨架期滚动条就可见了）
      const page = document.querySelector('.page-view-container')
      const ready = page && !page.querySelector('.ui-empty-state--loading, .ui-empty-state--error')
      if (ready) doneFrames++
      else doneFrames = 0
      if (doneFrames >= 2 || performance.now() - started > 4000) {
        rootEl.classList.remove('is-boot-loading')
        // 首屏稳定后再预取其余路由分包：此时不再与首屏数据/图片抢带宽，
        // 之后切换页面无需等待 chunk 下载，消除「先卡一下再切过去」。
        prefetchRouteChunks()
        return
      }
      bootLoadingRaf = requestAnimationFrame(reveal)
    }
    bootLoadingRaf = requestAnimationFrame(reveal)
  } else {
    // 移动端 / 窄屏没有骨架期滚动条处理，但仍要在首屏就绪后预取路由分包。
    const started = performance.now()
    const settle = () => {
      const page = document.querySelector('.page-view-container')
      const ready = page && !page.querySelector('.ui-empty-state--loading, .ui-empty-state--error')
      if (ready || performance.now() - started > 4000) {
        prefetchRouteChunks()
        return
      }
      bootLoadingRaf = requestAnimationFrame(settle)
    }
    bootLoadingRaf = requestAnimationFrame(settle)
  }

  // 右栏「最新讨论」定时刷新（见 startRecentPolling 的说明）
  startRecentPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('error', handleGlobalImageError, true)
  window.removeEventListener('resize', scheduleStickyClipping)
  stopRecentPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (stickyClipFrame) window.cancelAnimationFrame(stickyClipFrame)
  if (pendingClearRaf) cancelAnimationFrame(pendingClearRaf)
  if (bootLoadingRaf) cancelAnimationFrame(bootLoadingRaf)
  if (mainObserver) mainObserver.disconnect()
})

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
  isSearchOpen.value = false
  isSettingsOpen.value = !isSettingsOpen.value
}

const { universalFileInput, handleExportData, triggerUniversalImport, handleUniversalImport } = useBackupData(showMessage)

const updateModalRef = ref(null)

const handleRequestUpdate = (info) => {
  if (updateModalRef.value) {
    updateModalRef.value.startUpdateWithInfo(info)
  }
}

watch(() => route.path, () => {
  // Reset the shared page scroll before the old view is unmounted so route changes do not jump.
  resetModalScrollCoordinator()
  if (appScrollRoot.value) appScrollRoot.value.scrollTop = 0
  setRoutePending()
  nextTick(scheduleStickyClipping)
}, { flush: 'sync' })

const itemLoadError = ref('')
let itemLoadOperation = 0
const dismissItemLoadError = () => {
  itemLoadError.value = ''
  const query = { ...route.query }
  delete query.itemId
  router.replace({ query })
}
const loadGlobalItem = async newId => {
  const operation = ++itemLoadOperation
  itemLoadError.value = ''
  if (newId) {
    // 在覆盖式详情打开（app-main 被锁为视口高度、页面被钳到顶部）之前，先捕获列表滚动位置，
    // 关闭时用它把列表滚回点击处。否则 app-main 被钳制后捕获到的 scrollTop 会被钳到 0。
    const savedScroll = appScrollRoot.value?.scrollTop ?? 0
    try {
      const { items, categoryTree } = await fetchItemData()
      // The detail can be closed before the async data request resolves. Do
      // not let that stale request reopen the modal after itemId was removed.
      if (operation !== itemLoadOperation || route.query.itemId !== newId) return
      const item = items.find(i => i.typeId === newId)
      if (item && !isBlacklisted(item)) {
        openItemDetail(item, categoryTree, savedScroll)
      } else {
        dismissItemLoadError()
      }
    } catch (e) {
      console.error('Failed to global invoke item:', e)
      if (operation === itemLoadOperation && route.query.itemId === newId) {
        itemLoadError.value = '物品数据暂时不可用，请检查网络后重试。'
      }
    }
  }
}
watch(() => route.query.itemId, loadGlobalItem, { immediate: true })
onBeforeUnmount(() => { itemLoadOperation += 1 })
</script>

<style scoped>
/* ====== 顶部木质导航条（模板 header 风格） ====== */
.app-container {
  display: flex;
  flex-direction: column;
  height: var(--vh100);
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
  box-shadow: 0 4px 10px #00000080;
  border-bottom: 2px solid var(--border-color, #6b5134);
}

@media (min-width: 1025px) {
  .app-container {
    display: block;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: none;
    scrollbar-gutter: stable;
  }
  /* 首屏骨架期隐藏滚动条（gutter 仍占位），首个页面数据就绪后以终态尺寸亮出，避免刷新时滚动条短闪 */
  .app-container.is-boot-loading {
    overflow-y: hidden;
  }
  .app-header {
    position: fixed;
    top: 0;
    width: 100vw;
    max-width: none;
  }
}

.header-content {
  display: flex;
  flex-direction: column;
  padding: 0 max(20px, env(safe-area-inset-right, 0px)) 0 max(20px, env(safe-area-inset-left, 0px));
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
  color: var(--on-wood-text);
  letter-spacing: 2px;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-ui);
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
    padding: 0 max(12px, env(safe-area-inset-right, 0px)) 0 max(12px, env(safe-area-inset-left, 0px));
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
  color: var(--on-wood-text);
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

/* 当前正停留在这个入口对应的页面时（如讨论区）：给出选中态，
   否则用户看不出"我已经在讨论区里" */
.icon-btn.is-active {
  background: rgba(85, 117, 116, 0.7);
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
  width: var(--floating-control-size, 44px);
  height: var(--floating-control-size, 44px);
  box-sizing: border-box;
  padding: 0;
  appearance: none;
  border-radius: 50%;
  background: var(--floating-control-background, linear-gradient(180deg, #463424, #2b1f15));
  border: var(--floating-control-border, 2px solid #8f7351);
  box-shadow: var(--floating-control-shadow, 0 4px 12px rgba(0, 0, 0, 0.4));
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  z-index: var(--floating-control-z, 6002);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
.nav-fab-btn span {
  display: block;
  width: 19px;
  height: 2px;
  background-color: var(--on-wood-text);
  border-radius: 2px;
  transition: all 0.2s;
}
.nav-fab-btn:hover {
  border-color: var(--accent-bright, #7a9a99);
  background: linear-gradient(180deg, var(--wood, #2b1f15), var(--wood-deep, #1e150d));
}
.nav-fab-btn:active {
  filter: brightness(0.9);
}

/* ====== 主区域布局（三列等高 grid，严格与 ui模板.html 对齐：左 250 / 中 1fr / 右 300，间距 20px，顶部留白 33px = sticky 吸附位一致，切换页面不跳动） ====== */
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
  .app-main {
    display: block;
    height: auto;
    min-height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
    overflow: visible;
  }
  .app-main :deep(.page-view-container) {
    height: auto;
    min-height: inherit;
    overflow: visible;
  }
  .app-main :deep([data-main-scroll]) {
    flex: none;
    height: auto !important;
    max-height: none !important;
    overflow-y: visible !important;
    overscroll-behavior: auto;
    clip-path: inset(var(--sticky-clip-top, 0px) 0 0);
  }
  /* Camp paper fills the space left by filters, including when they collapse.
     Longer content still expands into the desktop page scroll. */
  .app-main :deep(.camp-panel > .camp-grid) {
    flex: 1 0 auto;
  }
  .app-main :deep(.page-view-container > .filter-panel),
  .app-main :deep(.page-view-container > .filter-sticky-bar),
  .app-main :deep(.page-view-container > [class*="-filter-panel"]) {
    position: sticky;
    top: calc(var(--header-height, 60px) + var(--safe-top, 0px) + 33px);
    z-index: 30;
    overflow: visible;
    background-color: var(--paper);
    box-shadow: 0 8px 18px rgba(43, 31, 21, 0.3), inset 0 0 20px rgba(135, 107, 72, 0.1);
  }
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

.is-native-shell .main-layout-row {
  grid-template-columns: minmax(0, 1fr);
}
.is-native-shell .header-top-row {
  grid-template-columns: minmax(180px, 250px) minmax(0, 1fr) auto;
}
.is-native-shell :deep(.ui-back-to-top) {
  right: 20px;
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

@media (min-width: 1025px) {
  .main-layout-row {
    align-items: start;
    flex: none;
    /* 基线=视口高：内容不超一屏时页面无人工溢出（无滚动条）；切页/首屏保护由 is-route-pending/is-boot-loading 负责 */
    min-height: calc(var(--vh100) - var(--safe-top, 0px));
    padding-top: calc(33px + var(--header-height, 60px) + var(--safe-top, 0px));
    overflow: visible;
  }
  /* Facility panels end at the same baseline as the fixed side information panels. */
  .main-layout-row:has(.facilities-page) { padding-bottom: 0; }
  /* 切页瞬间临时顶住旧页高度：见 setRoutePending()，新页加载完成即撤销 */
  .main-layout-row.is-route-pending {
    min-height: var(--route-pending-h, calc(var(--vh100) - var(--safe-top, 0px)));
  }
  .desktop-sidebar-container,
  .desktop-right-container {
    position: sticky;
    top: calc(var(--header-height, 60px) + var(--safe-top, 0px) + 33px);
    height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
    max-height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
  }
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
    padding: 8px max(8px, env(safe-area-inset-right, 0px)) calc(8px + var(--safe-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)) !important;
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

/* 邮件是固定三栏阅读器：覆盖桌面通用的 height:auto / overflow:visible。
   高度使用与两侧栏相同的公式，筛选栏占用多少，阅读器就使用剩余空间。 */
.app-container.is-mail-reader { overflow: hidden; }
@media (min-width: 1025px) {
  .is-mail-reader .main-layout-row {
    height: var(--vh100);
    min-height: 0;
    overflow: hidden;
  }
  .is-mail-reader .app-main {
    display: flex;
    height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
    min-height: 0;
    overflow: hidden;
  }
  .is-mail-reader .app-main :deep(.partner-mails-page) {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .is-mail-reader .app-main :deep(.partner-mails-page > .filter-panel) {
    position: static;
    max-height: 50%;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

/* 模拟招募：整页游戏画面。隐藏 Wiki 顶栏 / 左导航 / 右信息栏，主视图区独占整个视口，
   画布由 `GachaStage` 等比缩放居中，背板由页面自己的模糊主视觉铺满（见 assets/gacha.css）。
   注意：`.main-layout-row` 是 `grid-template-columns: 250px 1fr 300px`，只把左右栏
   `display:none` 不够——唯一剩下的子元素会落进第一列 250px（画布会被压到 250/1534 缩放），
   因此这里必须把行布局改成单列 flex。 */
.app-container.is-gacha-stage {
  display: flex;
  flex-direction: column;
  height: var(--vh100);
  overflow: hidden;
  /* 桌面端基础规则为页面滚动预留了 scrollbar-gutter: stable，
     整页游戏画面不需要它，否则右边缘会留出一条露出页面背景的槽宽 */
  scrollbar-gutter: auto;
  max-width: none;
}

.is-gacha-stage .app-header,
.is-gacha-stage .desktop-sidebar-container,
.is-gacha-stage .desktop-right-container,
.is-gacha-stage > .nav-fab-btn {
  display: none !important;
}

.is-gacha-stage .main-layout-row {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1 1 auto;
  width: 100%;
  max-width: none;
  height: var(--vh100);
  min-height: 0;
  margin: 0;
  /* 移动端媒体查询（≤1024px）给行容器加了 `padding: 8px + safe-area !important`
     的 Wiki 页边距，横屏手机的刘海/手势条会让左右各留出几十像素、露出 body 的
     羊皮纸背景；整页游戏画面必须用 !important 归零（桌面端无此竞争，行为不变）。 */
  padding: 0 !important;
  overflow: hidden;
}

.is-gacha-stage .app-main {
  display: flex;
  flex-flow: column;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  visibility: visible;
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
  position: relative; /* 供右侧「进入讨论区」箭头绝对定位（标题保持居中不动） */
  background-color: var(--border-color, #8f7351);
  color: var(--on-wood-text);
  text-align: center;
  padding: 10px 34px 10px 14px; /* 右侧留出箭头宽度，长标题也不会压到箭头 */
  font-family: var(--font-ui);
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

/* 右栏标题做成可点入口（进讨论区），沿用原标题的字号与颜色 */
.info-title-link {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.info-title-link:hover {
  text-decoration: underline;
}

/* 标题栏右侧的「进入→」：绝对定位在右侧，标题保持居中 */
.info-title-enter {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  padding: 1px 6px;
  border: 1px solid rgba(223, 206, 179, 0.5);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.12);
  color: var(--on-wood-text, #dfceb3);
  font-family: inherit;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.5;
  cursor: pointer;
}
.info-title-enter:hover {
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
}

/* 交流群链接配色与「进入讨论区」的强调色一致（用户要求） */
.recent-group-link {
  color: var(--accent-ink);
  text-decoration: none;
}
.recent-group-link:hover {
  text-decoration: underline;
}

/* 右栏「最新讨论」列表：紧凑、只读、不放输入框（点开进讨论区发言） */
.recent-discussions {
  /*
   * **按内容高度**（`flex: 0 1 auto`），不能是 `flex: 1 1 auto`：
   * 后者会把 info-body 的剩余高度全吃掉，评论只有几条时会在列表下方留一大块空白
   * （用户反馈"这里为什么空这么多空白"）。仍需能收缩（`0 1` 的第二个 1）
   * 以便评论多时在内部滚动。
   */
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.recent-item {
  min-width: 0;
}
.recent-btn {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--paper-soft);
  color: var(--text-main);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.recent-btn:hover {
  border-color: var(--accent-bright);
}

/* 缩小的头像（24px）：与讨论区里的头像同源，没有头像时用昵称首字占位 */
.recent-avatar {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border-soft);
  object-fit: cover;
}
.recent-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-solid);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

/* 昵称 + 正文：竖排，占满头像右侧剩余宽度 */
.recent-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.recent-nick {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 正文最多两行：右栏很窄，长评论会把其余消息挤下去 */
.recent-body {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.recent-foot {
  flex-shrink: 0;
  /*
   * 用普通间距，**不要 `margin-top: auto`**：吉祥物（SidebarMascot）自己就带
   * `margin-top: auto` 且高约 240px，两边都抢剩余空间的话，空白会被"摊"成
   * 列表→交流群之间的一大段（用户反馈"为什么空这么多空白"）。
   * 这里让列表与交流群紧跟标题，剩余空白统一留在最下方。
   */
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 交流群：字号/字重/颜色与上面聊天的昵称保持一致（用户要求） */
.recent-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.recent-group-link {
  font-size: 13px;
  font-weight: 700;
}
.info-cover-image {
  width: 100%;
  height: 110px;
  background-image: url('/ui/map_w1_bg.webp');
  background-position: center;
  background-size: cover;
  border-bottom: 1px solid var(--border-color, #8f7351);
}
.info-body {
  padding: 14px 16px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.info-body > .info-meta-rows,
.info-body > .info-section {
  flex-shrink: 0;
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
/* 可点击的 info-value（交流群）：字号、配色、字重全部沿用 .info-value，仅加可点提示 */
.info-value--link {
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.info-value--link:hover {
  opacity: 0.75;
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
