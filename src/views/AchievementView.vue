<template>
  <div class="page-view-container">

    <!-- 筛选区（羊皮纸面板，和物品图鉴风格一致的 UiSearchInput + UiFilterRow + UiFilterPill） -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索成就名称、描述或道具..." />

      <!-- 分类筛选行 -->
      <UiFilterRow label="分类1：">
        <UiFilterPill
          v-for="cat in categoryOptions"
          :key="cat.key"
          :active="filterCategory === cat.key"
          @click="filterCategory = cat.key"
        >
          {{ cat.label }}
        </UiFilterPill>
      </UiFilterRow>

      <!-- 状态筛选行（右侧保留已收集计数） -->
      <UiFilterRow label="状态：">
        <UiFilterPill
          v-for="st in statusOptions"
          :key="st.key"
          :active="filterStatus === st.key"
          @click="filterStatus = st.key"
        >
          {{ st.label }}
        </UiFilterPill>

        <template #right>
          <div class="collection-counter">
            已收集 <span class="count-num">{{ collectedCount }}</span> / {{ achievements.length }}
          </div>
        </template>
      </UiFilterRow>
    </div>

    <!-- Async Data Loading State -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配成就与奖励数据..." />

    <!-- 列表区（懒加载每批 60 项） -->
    <UiCardGrid v-else id="achGridScroll" class="ach-scroll-container">
      <UiListRow
        v-for="item in displayedAchievements"
        :key="item.id"
        :id="'ach-card-' + item.id"
        class="ach-list-row"
        :class="{ 'card-highlight-pulse': highlightedAchId === item.id, 'is-collected': isCollected(item.id) }"
        clickable
        @click="openDetail(item)"
      >
        <div class="ach-card-main">
          <div class="ach-card-icon-wrap">
            <img
              :src="getCategoryIcon(item.category)"
              :alt="getCategoryName(item.category)"
              class="ach-category-icon"
              loading="lazy"
              @error="handleImgError"
            />
          </div>
          <div class="ach-card-info">
            <div class="ach-card-name-row">
              <span class="ach-card-name">{{ item.name }}</span>
            </div>
            <div class="ach-card-des">{{ item.requirementText || item.des || '（无达成条件）' }}</div>
          </div>
        </div>

        <template #right>
          <div class="ach-card-right">
            <UiCollectionToggle :active="isCollected(item.id)" @toggle="toggleCollected(item.id)" />

            <!-- 奖励图标列表（横排展示 × 数量） -->
            <div v-if="item.rewards && item.rewards.length" class="ach-card-rewards">
              <div
                v-for="(rw, rIdx) in item.rewards"
                :key="rIdx"
                class="ach-reward-pill"
                :title="`${rw.name || '奖励'} × ${rw.count}`"
              >
                <img
                  :src="rw.icon"
                  :alt="rw.name || '奖励'"
                  class="ach-reward-icon"
                  loading="lazy"
                  @error="handleImgError"
                />
                <span class="ach-reward-count">× {{ rw.count }}</span>
              </div>
            </div>
          </div>
        </template>
      </UiListRow>

      <UiEmptyState v-if="filteredAchievements.length === 0" type="empty" text="未找到符合条件的成就数据" />
    </UiCardGrid>

    <UiBackToTop scroll-container="#achGridScroll" />

    <!-- 成就详情弹窗（全屏详情） -->
    <UiModal
      v-model:visible="detailModal.visible"
      :title="detailModal.item ? detailModal.item.name : '成就详情'"
      max-width="820px"
      scroll-id="achModalScroll"
      :z-index="3000"
    >
      <div v-if="detailModal.item" class="ach-modal-body">
        <UiSection title="基础信息" class="ach-info-section">
          <UiInfoRow label="分类">
            <span class="ach-category-badge">{{ getCategoryName(detailModal.item.category) }}</span>
          </UiInfoRow>
        </UiSection>

        <UiSection v-if="detailModal.item.requirementText" title="达成条件">
          <p class="ach-condition-text">{{ detailModal.item.requirementText }}</p>
        </UiSection>

        <UiSection
          v-if="detailModal.item.previousAchievements?.length || detailModal.item.nextAchievements?.length"
          title="成就阶段"
          class="ach-info-section"
        >
          <UiInfoRow
            v-if="detailModal.item.previousAchievements?.length"
            label="解锁前置"
          >
            <span class="ach-stage-name">{{ formatAchievementNames(detailModal.item.previousAchievements) }}</span>
          </UiInfoRow>
          <UiInfoRow
            v-if="detailModal.item.nextAchievements?.length"
            label="完成后解锁"
          >
            <span class="ach-stage-name">{{ formatAchievementNames(detailModal.item.nextAchievements) }}</span>
          </UiInfoRow>
        </UiSection>

        <UiSection v-if="detailModal.item.rewards && detailModal.item.rewards.length" title="奖励">
          <div class="reward-list">
            <UiRewardCard
              v-for="(rw, rIdx) in detailModal.item.rewards"
              :key="rIdx"
              :clickable="!!rw.typeId"
              :rule="{
                targetName: rw.name || (rw.typeId ? '物品 ' + rw.typeId : '奖励'),
                targetImg: rw.icon,
                targetQuality: rw.quality,
                min: rw.count,
                max: rw.count,
                typeId: rw.typeId
              }"
              @click="handleRewardClick(rw)"
            />
          </div>
        </UiSection>
      </div>

      <UiBackToTop scroll-container="#achModalScroll" />
    </UiModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStateStore } from '../stores/appState'
import {
  UiBackToTop,
  UiCardGrid,
  UiCollectionToggle,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiInfoRow,
  UiListRow,
  UiModal,
  UiRewardCard,
  UiSearchInput,
  UiSection
} from '../components/ui/index.js'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'
import { useLazyList } from '../composables/useLazyList'
import { alignElementInScrollTarget } from '../utils/scrollTarget.js'

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
let highlightTimer = 0

// 成就详情弹窗状态（按迁移契约第4条新增：卡面点击打开全屏详情）
const detailModal = ref({ visible: false, item: null })

const openDetail = (item) => {
  detailModal.value = { visible: true, item }
}

const getCategoryName = (cat) => {
  const found = categoryOptions.find(o => o.key === cat)
  return found ? found.label : (cat || '未知')
}

const formatAchievementNames = items => items.map(item => item.name).join('、')

// 奖励卡点击 → 通过全局 itemId 查询打开物品详情
const handleRewardClick = (rw) => {
  if (rw && rw.typeId) {
    router.push({ query: { ...route.query, itemId: rw.typeId } })
  }
}

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

const handleLocateAchievement = async (targetId, queryQ) => {
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

    await nextTick()
    const index = ensureAchievementVisible(match.id)
    if (index < 0) return

    highlightedAchId.value = match.id

    let el = null
    let aligned = false
    for (const delay of [0, 120, 280, 520]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      await nextTick()
      el = document.getElementById(`ach-card-${match.id}`)
      if (!el || !el.isConnected || el.getBoundingClientRect().height <= 0) continue
      alignElementInScrollTarget(el, '#achGridScroll')
      aligned = true
    }
    if (!aligned) return

    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => {
      highlightedAchId.value = ''
      highlightTimer = 0
    }, 2800)

    // `id` is a one-time locate command; keep `q` as the user's search state.
    if (String(route.query.id || '') === String(targetId || '')) {
      const query = { ...route.query }
      delete query.id
      await router.replace({ query })
    }
  }
}

onMounted(async () => {
  try {
    const { achievements: assembled } = await fetchWithFallback('data/parsed/achievements.json')

    // 黑名单过滤（与原组装后行为一致）
    achievements.value = assembled.filter(a => !isBlacklisted(a))
    isDataReady.value = true

    // Check if mounted with target ID or query
    if (route.query.id || route.query.q) {
      handleLocateAchievement(route.query.id, route.query.q)
    }
  } catch (err) {
    console.error('Fetch parsed achievements data error:', err)
    isDataReady.value = true
  }
})

// Bidirectional URL Query State Sync
watch([filterStatus, filterCategory, searchQuery], () => {
  const query = {}
  if (filterStatus.value !== 'all') query.status = filterStatus.value
  if (filterCategory.value !== 'all') query.category = filterCategory.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (route.query.id) query.id = route.query.id
  router.replace({ query })
})

// Search remains persistent state; only a new `id` is a locate command.
watch(() => route.query.q, newQuery => {
  if (newQuery !== undefined && newQuery !== searchQuery.value) {
    searchQuery.value = newQuery || ''
  }
})
watch(() => route.query.id, (newId, oldId) => {
  if (newId && newId !== oldId) handleLocateAchievement(newId, route.query.q)
})

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

const { displayedItems: displayedAchievements, ensureItemVisible } = useLazyList(filteredAchievements, 20, '#achGridScroll')

const ensureAchievementVisible = matcher => {
  const index = filteredAchievements.value.findIndex(item => String(item.id) === String(matcher))
  return ensureItemVisible(index)
}
</script>

<style scoped>
/* ===== 页面特有布局（筛选面板继承全局 / 单列卡片流） ===== */
/* .filter-panel 全局定义于 theme.css（padding 12px 14px），页面不重复覆盖 */

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 0 4px;
}

/* ===== 成就列表行卡片（参考图与任务图鉴风格） ===== */
.ach-scroll-container :deep(.ui-card-grid) {
  grid-template-columns: 1fr;
  gap: 10px;
}

.ach-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background-color: rgba(223, 206, 179, 0.92);
  border: 1.5px solid var(--border-soft, rgba(143, 115, 81, 0.35));
  border-radius: 8px;
  padding: 12px 16px;
  min-height: 72px;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.dark-mode .ach-list-row {
  background-color: rgba(46, 34, 23, 0.84);
  border-color: rgba(143, 115, 81, 0.3);
}

.ach-list-row:hover {
  transform: translateY(-1px);
  border-color: var(--accent-bright, #7a9a99);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.ach-list-row.is-collected {
  border-color: rgba(122, 154, 153, 0.6);
  background-color: rgba(223, 206, 179, 0.96);
}
.dark-mode .ach-list-row.is-collected {
  background-color: rgba(56, 44, 32, 0.85);
  border-color: rgba(122, 154, 153, 0.45);
}

/* 左侧主体内容 */
.ach-card-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.ach-card-icon-wrap {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ach-category-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
}

.ach-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.ach-card-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ach-card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  font-family: var(--font-ui);
  letter-spacing: 0.5px;
  line-height: 1.3;
}

.ach-card-des {
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  line-height: 1.5;
  word-break: break-word;
}

/* 右侧：开关与奖励横排 */
.ach-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  min-height: 52px;
}

/* 收集状态切换胶囊滑块（仿图中的圆润开关） */
/* 奖励图标流 */
.ach-card-rewards {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ach-reward-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ach-reward-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}

.ach-reward-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  font-family: var(--font-ui);
}

/* 全局搜索定位高亮脉冲（主题青描边） */
.card-highlight-pulse {
  border-color: var(--accent-bright) !important;
  box-shadow: 0 0 16px rgba(122, 154, 153, 0.45) !important;
  animation: cardPulse 0.8s ease-in-out 3;
}

@keyframes cardPulse {
  0%, 100% {
    border-color: var(--accent-bright);
    box-shadow: 0 0 14px rgba(122, 154, 153, 0.4);
  }
  50% {
    border-color: var(--accent);
    box-shadow: 0 0 22px rgba(85, 117, 116, 0.7);
  }
}

/* ===== 成就详情弹窗 ===== */
.ach-modal-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ach-condition-text {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--accent-bright, #7a9a99);
  border-radius: 0 3px 3px 0;
  background: rgba(122, 154, 153, 0.10);
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main);
  white-space: pre-wrap;
}

.ach-info-section :deep(.ui-info-row__label) {
  width: 96px;
  box-sizing: border-box;
}

.ach-info-section :deep(.ui-info-row__value) {
  text-align: left;
  word-break: break-word;
  font-family: var(--font-ui);
  font-weight: 700;
  color: var(--accent-ink, #2f4a49);
}

.ach-category-badge,
.ach-stage-name {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 3px;
  background: rgba(122, 154, 153, 0.10);
}

.ach-category-badge {
  padding: 3px 12px;
  color: var(--accent-ink, #2f4a49);
}

.ach-stage-name {
  max-width: 100%;
  padding: 3px 10px;
  color: var(--text-main, #3e2a14);
  line-height: 1.5;
  white-space: normal;
}

.dark-mode .ach-condition-text,
.dark-mode .ach-category-badge,
.dark-mode .ach-stage-name {
  background: rgba(122, 154, 153, 0.14);
}

.reward-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

@media (max-width: 640px) {
  .ach-info-section :deep(.ui-info-row__label) {
    width: 88px;
  }

  .ach-condition-text {
    padding: 9px 10px;
  }
}
</style>
