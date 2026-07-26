<template>
  <div class="page-view-container">
    <!-- Top Control Bar (3-Row Layout matching Image 1 & Image 2) -->
    <div class="filter-sticky-bar achievement-filter-sticky">
      <!-- Row 1: Full-Width Category Segmented Pill Bar (图1 款式) -->
      <div class="control-row-1">
        <div class="segmented-pill-container category-segmented">
          <div
            v-for="cat in categoryOptions"
            :key="cat.key"
            :class="['segmented-pill-item', { active: filterCategory === cat.key }]"
            @click="filterCategory = cat.key"
          >
            {{ cat.label }}
          </div>
        </div>
      </div>

      <!-- Row 2: Compact Status Segmented Bar (图2 款式) + Right Counter -->
      <div class="control-row-2">
        <div class="segmented-pill-container status-segmented">
          <div
            v-for="status in statusOptions"
            :key="status.key"
            :class="['segmented-pill-item', { active: filterStatus === status.key }]"
            @click="filterStatus = status.key"
          >
            {{ status.label }}
          </div>
        </div>

        <div class="collection-counter">
          已收集 <span class="count-num">{{ collectedCount }}</span> / {{ achievements.length }}
        </div>
      </div>

      <!-- Row 3: Full-Width In-Page Search Bar using /ui/search.svg -->
      <div class="control-row-3">
        <div class="search-input-wrapper-full">
          <img :src="getImageUrl('/ui/search.svg')" class="search-icon-img" alt="搜索" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索成就或道具..."
            class="ach-search-input-full"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">✕</button>
        </div>
      </div>
    </div>

    <!-- Async Data Loading State -->
    <div v-if="!isDataReady" class="global-loading-state">
      <div class="global-loading-spinner"></div>
      <span>正在装配成就与奖励数据...</span>
    </div>

    <!-- Achievement Cards List -->
    <div v-else class="data-grid-scroll ach-scroll-container" id="achGridScroll">
      <div class="ach-cards-list">
        <div
          v-for="item in filteredAchievements"
          :key="item.id"
          :id="'ach-card-' + item.id"
          class="ach-card"
          :class="{
            collected: isCollected(item.id),
            'card-highlight-pulse': highlightedAchId === item.id
          }"
        >
          <!-- Card Left: Category Image Icon + Title & Description -->
          <div class="card-left">
            <div class="icon-box-wrapper">
              <img
                :src="getCategoryIcon(item.category)"
                :alt="item.category"
                class="ach-category-icon"
                loading="lazy"
                @error="handleImgError"
              />
            </div>

            <div class="ach-info">
              <div class="ach-name-row">
                <span class="ach-name">{{ item.name }}</span>
              </div>
              <div class="ach-des">{{ item.des }}</div>
            </div>
          </div>

          <!-- Card Right: Custom Switch Top + Rewards List Bottom -->
          <div class="card-right">
            <!-- Custom Switch (Compact Height 24px) -->
            <div
              class="custom-switch"
              :class="{ active: isCollected(item.id) }"
              @click.stop="toggleCollected(item.id)"
              :title="isCollected(item.id) ? '已收集 (点击取消)' : '未收集 (点击标记)'"
            >
              <span class="switch-mark icon-check">✓</span>
              <span class="switch-mark icon-cross">✕</span>
              <div class="switch-knob"></div>
            </div>

            <!-- Reward Items Flex Row (Icon + Count ONLY, No Names Rendered) -->
            <div class="card-rewards-row" v-if="item.rewards && item.rewards.length > 0">
              <div
                v-for="(rw, rIdx) in item.rewards"
                :key="rIdx"
                class="reward-item"
              >
                <img
                  :src="rw.icon"
                  :alt="rw.name || '奖励'"
                  class="reward-icon-img"
                  loading="lazy"
                  @error="handleImgError"
                />
                <span class="reward-count">× {{ rw.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredAchievements.length === 0" class="no-data">
          未找到符合条件的成就数据
        </div>
      </div>
    </div>

    <BackToTop scroll-container="#achGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStateStore } from '../stores/appState'
import BackToTop from '../components/BackToTop.vue'
import BaseModal from '../components/BaseModal.vue'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'

const route = useRoute()
const router = useRouter()
const appStateStore = useAppStateStore()

// Filter Options
const statusOptions = [
  { key: 'all', label: '全部' },
  { key: 'collected', label: '已收集' },
  { key: 'uncollected', label: '未收集' }
]

const categoryOptions = [
  { key: 'all', label: '全部' },
  { key: 'adv', label: '冒险' },
  { key: 'exp', label: '探索' },
  { key: 'live', label: '生活' },
  { key: 'hide', label: '隐藏' }
]

// Filter States
const filterStatus = ref(route.query.status || 'all')
const filterCategory = ref(route.query.category || 'all')
const searchQuery = ref(route.query.q || '')
const highlightedAchId = ref('')

const achievements = ref([])
const isDataReady = ref(false)

// Map category to icons in /AchievementPanel/
const getCategoryIcon = (cat) => {
  const iconMap = {
    adv: getImageUrl('/AchievementPanel/achv_icon_adv.png'),
    exp: getImageUrl('/AchievementPanel/achv_icon_exp.png'),
    hide: getImageUrl('/AchievementPanel/achv_icon_hide.png'),
    live: getImageUrl('/AchievementPanel/achv_icon_live.png')
  }
  return iconMap[cat] || getImageUrl('/AchievementPanel/achv_icon_adv.png')
}

const isCollected = (id) => {
  return appStateStore.collectedAchievementIds.includes(id)
}

const toggleCollected = (id) => {
  appStateStore.toggleAchievementCollected(id)
}

const collectedCount = computed(() => {
  return achievements.value.filter(a => isCollected(a.id)).length
})

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

const handleLocateAchievement = (targetId, queryQ) => {
  if (!isDataReady.value || !achievements.value.length) return

  let match = null
  if (targetId) {
    match = achievements.value.find(a => String(a.id) === String(targetId))
  }
  if (!match && queryQ) {
    const qLower = queryQ.trim().toLowerCase()
    match = achievements.value.find(a => a.name.toLowerCase().includes(qLower))
  }

  if (match) {
    // Reset conflicting category/status filters to ensure card is visible
    if (filterCategory.value !== 'all' && filterCategory.value !== match.category) {
      filterCategory.value = 'all'
    }
    if (filterStatus.value !== 'all') {
      filterStatus.value = 'all'
    }

    highlightedAchId.value = match.id

    nextTick(() => {
      const el = document.getElementById(`ach-card-${match.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    setTimeout(() => {
      highlightedAchId.value = ''
    }, 2800)
  }
}

onMounted(async () => {
  try {
    const [achRes, rewRes, itemRes] = await Promise.all([
      fetchWithFallback('data/achievement.json'),
      fetchWithFallback('data/reward.json'),
      fetchWithFallback('data/item.json')
    ])

    const achJson = achRes
    const rewJson = rewRes
    const itemJson = itemRes

    const rawAchList = Object.values(achJson.achievement || {})
    const rewardMap = rewJson.datas || {}
    const itemMap = itemJson.datas || {}

    // Filter out blacklisted achievements at data assembly stage
    const filteredRawList = rawAchList.filter(a => !isBlacklisted(a))

    const assembled = filteredRawList.map(a => {
      const rewardObj = rewardMap[a.reward] || {}
      const rewards = []
      const rewardItemNames = []

      // Money (银币) -> /Common_ItemIcon/item_00001.png
      if (rewardObj.money && rewardObj.money > 0) {
        rewards.push({
          icon: getImageUrl('/Common_ItemIcon/item_00001.png'),
          count: rewardObj.money,
          name: '银币'
        })
      }

      // Ke (氪金) -> /Common_ItemIcon/item_00002.png
      if (rewardObj.ke && rewardObj.ke > 0) {
        rewards.push({
          icon: getImageUrl('/Common_ItemIcon/item_00002.png'),
          count: rewardObj.ke,
          name: '氪金'
        })
      }



      // Items Array -> /Common_ItemIcon/{typeId}.png
      if (rewardObj.items && Array.isArray(rewardObj.items)) {
        rewardObj.items.forEach(it => {
          if (it.rules && Array.isArray(it.rules)) {
            it.rules.forEach(rule => {
              if (rule.typeId) {
                const count = rule.min || rule.max || it.num || 1
                rewards.push({
                  icon: getImageUrl(`/Common_ItemIcon/${rule.typeId}.png`),
                  count,
                  typeId: rule.typeId
                })

                // Hidden item name extraction for search
                const matchedItem = itemMap[rule.typeId]
                if (matchedItem && matchedItem.name) {
                  rewardItemNames.push(matchedItem.name)
                }
              }
            })
          }
        })
      }

      return {
        id: a.typeId,
        name: a.name,
        des: a.des,
        category: a.category || 'adv',
        rewardId: a.reward,
        rewards,
        rewardItemNames
      }
    })

    achievements.value = assembled
    isDataReady.value = true

    // Check if mounted with target ID or query
    if (route.query.id || route.query.q) {
      handleLocateAchievement(route.query.id, route.query.q)
    }
  } catch (err) {
    console.error('Fetch achievement/reward/item data error:', err)
    isDataReady.value = true
  }
})

// Bidirectional URL Query State Sync
watch([filterStatus, filterCategory, searchQuery], () => {
  const query = {}
  if (filterStatus.value !== 'all') query.status = filterStatus.value
  if (filterCategory.value !== 'all') query.category = filterCategory.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  router.replace({ query })
})

// Watch route.query for external changes (e.g. global search routing while on achievement page)
watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.q !== undefined && newQuery.q !== searchQuery.value) {
      searchQuery.value = newQuery.q || ''
    }
    if (newQuery.id || newQuery.q) {
      handleLocateAchievement(newQuery.id, newQuery.q)
    }
  },
  { deep: true }
)

const filteredAchievements = computed(() => {
  return achievements.value.filter(item => {
    // Collection status filter
    if (filterStatus.value === 'collected' && !isCollected(item.id)) return false
    if (filterStatus.value === 'uncollected' && isCollected(item.id)) return false

    // Category filter
    if (filterCategory.value !== 'all' && item.category !== filterCategory.value) {
      return false
    }

    // Search query filter (matches name, des, or hidden rewardItemNames)
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = item.name.toLowerCase().includes(q)
      const matchDes = item.des.toLowerCase().includes(q)
      const matchRewardNames = item.rewardItemNames.some(n => n.toLowerCase().includes(q))
      if (!matchName && !matchDes && !matchRewardNames) return false
    }

    return true
  })
})
</script>

<style scoped>
.achievement-filter-sticky {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Control Row 1: Full-Width Category Segmented Bar (图1 款式) */
.control-row-1 {
  width: 100%;
}

/* Segmented Pill Track (分段控制器框架 - 灰底全圆角) */
.segmented-pill-container {
  display: flex;
  align-items: center;
  padding: 3px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-sizing: border-box;
}

/* Row 1: Category Pill Bar is 100% Full Width (图1 款式) */
.category-segmented {
  width: 100%;
}

/* Row 2: Status Pill Bar is Content Width (图2 款式) */
.status-segmented {
  display: inline-flex;
  width: auto;
}

/* Segmented Pill Item (分段内部按钮) */
.segmented-pill-item {
  flex: 1;
  text-align: center;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
}

.segmented-pill-item:hover {
  color: var(--text-main);
}

/* Active Selected Item (图1 & 图2 款式: 白底/暗底卡片浮起 + Primary 文字) */
.segmented-pill-item.active {
  background: var(--card-bg, #ffffff);
  color: var(--primary);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Control Row 2: Compact Status Segmented + Right Counter Text */
.control-row-2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  white-space: nowrap;
}

.count-num {
  color: var(--primary);
  font-weight: 700;
}

/* Control Row 3: Full-Width Search Input using /ui/search.svg */
.control-row-3 {
  width: 100%;
}

.search-input-wrapper-full {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon-img {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  filter: var(--icon-filter);
  pointer-events: none;
}

.ach-search-input-full {
  width: 100%;
  height: 34px;
  padding: 4px 30px 4px 34px;
  border: 1px solid var(--input-border);
  border-radius: 17px;
  font-size: 13px;
  background: var(--input-bg);
  color: var(--input-text);
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.ach-search-input-full:focus {
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
}

/* Achievement Cards List Container */
.ach-scroll-container {
  padding-top: 4px;
}

.ach-cards-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 20px;
}

/* Card Container (Reduced height & padding) */
.ach-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: all 0.25s ease;
  gap: 10px;
}

.ach-card:hover {
  background: var(--hover-bg);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.04);
}

/* Card Highlight Animation upon Global Search Selection */
.ach-card.card-highlight-pulse {
  border-color: var(--primary) !important;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.45) !important;
  animation: cardPulse 0.8s ease-in-out 3;
}

@keyframes cardPulse {
  0%, 100% {
    border-color: var(--primary);
    box-shadow: 0 0 14px rgba(59, 130, 246, 0.4);
  }
  50% {
    border-color: #60a5fa;
    box-shadow: 0 0 22px rgba(96, 165, 250, 0.7);
  }
}

/* Card Left Section */
.card-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.icon-box-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ach-category-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ach-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ach-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ach-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ach-des {
  font-size: 11px;
  color: var(--text-sub);
  line-height: 1.35;
}

/* Card Right Section */
.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

/* Custom Switch Component (Compact 44px x 24px) */
.custom-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #94a3b8;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5px;
  box-sizing: border-box;
}

.custom-switch.active {
  background: #22c55e;
}

.switch-mark {
  font-size: 10px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1;
  z-index: 1;
}

.icon-check {
  margin-left: 1px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.icon-cross {
  margin-right: 1px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.custom-switch.active .icon-check {
  opacity: 1;
}

.custom-switch.active .icon-cross {
  opacity: 0;
}

.switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}

.custom-switch.active .switch-knob {
  transform: translateX(20px);
}

/* Reward Items Flex Row */
.card-rewards-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.reward-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.reward-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
}
</style>
