<template>
  <div class="page-view-container">
    <!-- Top Filter Header -->
    <div class="filter-sticky-bar">
      <div class="search-row">
        <div class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索装备名字、部位、词条效果..."
            class="search-input"
          />
        </div>
        <button class="filter-toggle-btn" @click="isFilterExpanded = !isFilterExpanded">
          <span>筛选</span>
          <span class="arrow" :class="{ open: isFilterExpanded }">▼</span>
        </button>
      </div>

      <!-- Collapsible Filter Panel -->
      <div v-show="isFilterExpanded" class="filter-panel">
        <div class="filter-row">
          <span class="filter-label">品质</span>
          <div class="filter-options">
            <span
              v-for="r in ['全部', '传说', '史诗', '稀有', '普通']"
              :key="r"
              :class="['filter-tag', { active: activeRarity === r }]"
              @click="activeRarity = r"
            >
              {{ r }}
            </span>
          </div>
        </div>

        <div class="filter-row">
          <span class="filter-label">部位</span>
          <div class="filter-options">
            <span
              v-for="s in ['全部', '武器', '头部', '衣服', '鞋子', '饰品']"
              :key="s"
              :class="['filter-tag', { active: activeSlot === s }]"
              @click="activeSlot = s"
            >
              {{ s }}
            </span>
          </div>
        </div>
      </div>

      <!-- Result Count Bar -->
      <div class="count-bar">
        当前检索装备数量：<span class="count-num">{{ filteredEquips.length }}</span>
      </div>
    </div>

    <!-- Main List Container (Async Fetch Loading) -->
    <div v-if="!isDataReady" class="global-loading-state">
      <div class="global-loading-spinner"></div>
      <span>正在拉取并解析装备图鉴数据...</span>
    </div>

    <div v-else class="data-grid-scroll" id="equipGrid">
      <div class="data-grid-container wide-cards">
        <div
          v-for="equip in filteredEquips"
          :key="equip.id"
          class="data-card"
          @click="openDetail(equip)"
        >
          <div class="card-top-row">
            <div class="card-icon" :class="`rarity-bg-${equip.rarityLevel}`">
              🗡️
            </div>
            <div class="card-main-info">
              <div class="card-title-row">
                <span class="card-name" :class="`rarity-text-${equip.rarityLevel}`">{{ equip.name }}</span>
                <span class="rarity-badge" :class="`badge-${equip.rarityLevel}`">{{ equip.rarity }}</span>
              </div>
              <div class="slot-tag">{{ equip.slot }}</div>
            </div>
          </div>

          <div class="equip-stats-preview">
            <span class="stat-name">主属性：</span>
            <span class="stat-val">{{ equip.mainStat }}</span>
          </div>

          <div class="card-desc">
            <span class="effect-label">装备特效：</span>
            {{ equip.effect }}
          </div>
        </div>
      </div>

      <div v-if="filteredEquips.length === 0" class="no-data">未找到匹配的装备</div>
    </div>

    <!-- Equip Detail Modal (BaseModal) -->
    <BaseModal :visible="detailModal.visible" :title="detailModal.equip.name || ''" @close="closeDetail">
      <template #header>
        <div class="detail-header-row">
          <h3 class="modal-title" :class="`rarity-text-${detailModal.equip.rarityLevel}`">
            {{ detailModal.equip.name }}
          </h3>
          <button
            class="fav-btn"
            @click="appStore.toggleEquipFavorite(detailModal.equip.id)"
          >
            {{ isFavorite(detailModal.equip.id) ? '⭐ 已收藏' : '☆ 收藏' }}
          </button>
        </div>
      </template>

      <!-- Star Switcher -->
      <div class="star-switcher">
        <span class="switcher-label">升星预览：</span>
        <div class="star-buttons">
          <button
            v-for="star in [0, 1, 2, 3]"
            :key="star"
            :class="['star-btn', { active: selectedStar === star }]"
            @click="selectedStar = star"
          >
            {{ star === 0 ? '基础' : `${star}星` }}
          </button>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-title">基础属性</div>
        <div class="stat-grid">
          <div class="stat-cell">
            <span class="stat-k">部位</span>
            <span class="stat-v">{{ detailModal.equip.slot }}</span>
          </div>
          <div class="stat-cell">
            <span class="stat-k">主属性</span>
            <span class="stat-v">{{ detailModal.equip.mainStat }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-title">星级特效 (当前 {{ selectedStar }} 星)</div>
        <div class="effect-box">
          {{ getStarEffect(detailModal.equip, selectedStar) }}
        </div>
      </div>
    </BaseModal>

    <BackToTop scroll-container="#equipGrid" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStateStore } from '../stores/appState'
import BaseModal from '../components/BaseModal.vue'
import BackToTop from '../components/BackToTop.vue'
import { isBlacklisted } from '../config/blacklist.js'

const route = useRoute()
const router = useRouter()
const appStore = useAppStateStore()

// Filter states initialized from URL query (URL as State)
const searchQuery = ref(route.query.q || '')
const isFilterExpanded = ref(false)
const activeRarity = ref(route.query.rarity || '全部')
const activeSlot = ref(route.query.slot || '全部')

const equips = ref([])
const isDataReady = ref(false)
const detailModal = ref({ visible: false, equip: {} })
const selectedStar = ref(0)

const isFavorite = (id) => appStore.favoriteEquipIds.includes(id)

// Fetch data asynchronously from public/data/equips.json
onMounted(async () => {
  try {
    const res = await fetch('/data/equips.json')
    equips.value = await res.json()
  } catch (err) {
    console.error('Fetch /data/equips.json error:', err)
  } finally {
    isDataReady.value = true
    // Auto-open modal if URL query specifies id
    if (route.query.id) {
      const match = equips.value.find(e => e.id === String(route.query.id))
      if (match) openDetail(match)
    }
  }
})

// Bidirectional URL Query State Sync
watch([searchQuery, activeRarity, activeSlot], () => {
  const query = {}
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (activeRarity.value !== '全部') query.rarity = activeRarity.value
  if (activeSlot.value !== '全部') query.slot = activeSlot.value
  if (detailModal.value.visible && detailModal.value.equip?.id) {
    query.id = detailModal.value.equip.id
  }
  router.replace({ query })
})

// Watch router query for external changes (e.g. global search routing)
watch(() => route.query, (newQuery) => {
  if (newQuery.q !== undefined && newQuery.q !== searchQuery.value) {
    searchQuery.value = newQuery.q || ''
  }
  if (newQuery.id && isDataReady.value) {
    const match = equips.value.find(e => e.id === String(newQuery.id))
    if (match) openDetail(match)
  }
})

const filteredEquips = computed(() => {
  return equips.value.filter(equip => {
    if (isBlacklisted(equip)) return false
    if (activeRarity.value !== '全部' && equip.rarity !== activeRarity.value) return false
    if (activeSlot.value !== '全部' && equip.slot !== activeSlot.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      return equip.name.toLowerCase().includes(q) || equip.effect.toLowerCase().includes(q)
    }
    return true
  })
})

const openDetail = (equip) => {
  selectedStar.value = 0
  detailModal.value = { visible: true, equip }
  const query = { ...route.query, id: equip.id }
  router.replace({ query })
}

const closeDetail = () => {
  detailModal.value.visible = false
  const query = { ...route.query }
  delete query.id
  router.replace({ query })
}

const getStarEffect = (equip, star) => {
  if (!equip.starEffects || !equip.starEffects[star]) return equip.effect
  return equip.starEffects[star]
}
</script>

<style scoped>
.fav-star {
  margin-left: auto;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-sub);
  transition: transform 0.15s ease;
}

.fav-star.active {
  color: #f59e0b;
}

.fav-star:hover {
  transform: scale(1.2);
}

.detail-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 10px;
}

.fav-btn {
  background: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-main);
  transition: all 0.2s ease;
}

.equip-stats-preview {
  font-size: 12px;
  color: var(--text-main);
  background: var(--bg);
  padding: 6px 8px;
  border-radius: 6px;
}

.stat-name {
  color: var(--text-sub);
}

.stat-val {
  font-weight: 600;
}

.effect-label {
  font-weight: 600;
  color: var(--text-main);
}

.star-switcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg);
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.switcher-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
}

.star-buttons {
  display: flex;
  gap: 6px;
}

.star-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--card-bg);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.star-btn.active {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
  font-weight: 700;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.stat-cell {
  background: var(--bg);
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--border-color);
}

.stat-k {
  font-size: 11px;
  color: var(--text-sub);
}

.stat-v {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.effect-box {
  background: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
}
</style>
