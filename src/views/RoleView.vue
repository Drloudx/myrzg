<template>
  <div class="page-view-container">
    <!-- Top Filter Header -->
    <div class="filter-sticky-bar">
      <div class="search-row">
        <div class="search-box">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索角色名称、职业、特质..."
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
          <span class="filter-label">职业</span>
          <div class="filter-options">
            <span
              v-for="c in ['全部', '战士', '游侠', '法师', '圣职']"
              :key="c"
              :class="['filter-tag', { active: activeClass === c }]"
              @click="activeClass = c"
            >
              {{ c }}
            </span>
          </div>
        </div>

        <div class="filter-row">
          <span class="filter-label">属性</span>
          <div class="filter-options">
            <span
              v-for="e in ['全部', '光', '暗', '火', '水', '风', '地', '冰', '土']"
              :key="e"
              :class="['filter-tag', { active: activeElement === e }]"
              @click="activeElement = e"
            >
              {{ e }}
            </span>
          </div>
        </div>
      </div>

      <!-- Result Count Bar -->
      <div class="count-bar">
        当前检索角色数量：<span class="count-num">{{ filteredRoles.length }}</span>
      </div>
    </div>

    <!-- Main List Container (Async Fetch Loading) -->
    <div v-if="!isDataReady" class="global-loading-state">
      <div class="global-loading-spinner"></div>
      <span>正在拉取并解析角色图鉴数据...</span>
    </div>

    <div v-else class="data-grid-scroll" id="roleGrid">
      <div class="data-grid-container">
        <div
          v-for="role in filteredRoles"
          :key="role.id"
          class="data-card"
          @click="openDetail(role)"
        >
          <div class="card-top-row">
            <div class="card-avatar" :class="`rarity-bg-${role.rarityLevel}`">
              {{ role.name.substring(0, 1) }}
            </div>
            <div class="card-main-info">
              <div class="card-title-row">
                <span class="card-name" :class="`rarity-text-${role.rarityLevel}`">{{ role.name }}</span>
                <span class="rarity-badge" :class="`badge-${role.rarityLevel}`">{{ role.rarity }}</span>
              </div>
              <div class="filter-options">
                <span class="mini-tag tag-job">{{ role.class }}</span>
                <span class="mini-tag tag-attr">{{ role.element }}</span>
              </div>
            </div>
          </div>
          <div class="card-desc">{{ role.desc }}</div>
        </div>
      </div>

      <div v-if="filteredRoles.length === 0" class="no-data">未找到匹配的角色</div>
    </div>

    <!-- Detail Modal -->
    <BaseModal :visible="detailModal.visible" :title="`${detailModal.role.name || ''} 详情`" @close="closeDetail">
      <div class="detail-top">
        <div class="detail-avatar" :class="`rarity-bg-${detailModal.role.rarityLevel}`">
          {{ (detailModal.role.name || '').substring(0, 1) }}
        </div>
        <div class="detail-basic">
          <div class="detail-title-row">
            <span class="detail-title" :class="`rarity-text-${detailModal.role.rarityLevel}`">
              {{ detailModal.role.name }}
            </span>
            <button
              class="fav-btn"
              @click="appStore.toggleRoleFavorite(detailModal.role.id)"
            >
              {{ isFavorite(detailModal.role.id) ? '⭐ 已收藏' : '☆ 收藏' }}
            </button>
          </div>
          <div class="detail-labels">
            <span class="mini-tag tag-job">{{ detailModal.role.class }}</span>
            <span class="mini-tag tag-attr">{{ detailModal.role.element }}</span>
            <span class="rarity-badge" :class="`badge-${detailModal.role.rarityLevel}`">{{ detailModal.role.rarity }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-title">角色描述</div>
        <div class="section-content">{{ detailModal.role.desc }}</div>
      </div>

      <div class="detail-section">
        <div class="section-title">核心技能</div>
        <div class="skill-box">
          <div class="skill-name">{{ detailModal.role.skillName }}</div>
          <div class="skill-effect">{{ detailModal.role.skillEffect }}</div>
        </div>
      </div>
    </BaseModal>

    <BackToTop scroll-container="#roleGrid" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStateStore } from '../stores/appState'
import BaseModal from '../components/BaseModal.vue'
import BackToTop from '../components/BackToTop.vue'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'

const route = useRoute()
const router = useRouter()
const appStore = useAppStateStore()

// Filter states initialized from URL query (URL as State)
const searchQuery = ref(route.query.q || '')
const isFilterExpanded = ref(false)
const activeRarity = ref(route.query.rarity || '全部')
const activeClass = ref(route.query.class || '全部')
const activeElement = ref(route.query.element || '全部')

const roles = ref([])
const isDataReady = ref(false)
const detailModal = ref({ visible: false, role: {} })

const isFavorite = (id) => appStore.favoriteRoleIds.includes(id)

// Fetch data asynchronously from public/data/roles.json
onMounted(async () => {
  try {
    const res = await fetchWithFallback('data/roles.json')
    roles.value = res
  } catch (err) {
    console.error('Fetch /data/roles.json error:', err)
  } finally {
    isDataReady.value = true
    // Auto-open modal if URL query specifies id
    if (route.query.id) {
      const match = roles.value.find(r => r.id === String(route.query.id))
      if (match) openDetail(match)
    }
  }
})

// Bidirectional URL Query State Sync
watch([searchQuery, activeRarity, activeClass, activeElement], () => {
  const query = {}
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (activeRarity.value !== '全部') query.rarity = activeRarity.value
  if (activeClass.value !== '全部') query.class = activeClass.value
  if (activeElement.value !== '全部') query.element = activeElement.value
  if (detailModal.value.visible && detailModal.value.role?.id) {
    query.id = detailModal.value.role.id
  }
  router.replace({ query })
})

// Watch router query for external changes (e.g. global search routing)
watch(() => route.query, (newQuery) => {
  if (newQuery.q !== undefined && newQuery.q !== searchQuery.value) {
    searchQuery.value = newQuery.q || ''
  }
  if (newQuery.id && isDataReady.value) {
    const match = roles.value.find(r => r.id === String(newQuery.id))
    if (match) openDetail(match)
  }
})

const filteredRoles = computed(() => {
  return roles.value.filter(role => {
    if (isBlacklisted(role)) return false
    if (activeRarity.value !== '全部' && role.rarity !== activeRarity.value) return false
    if (activeClass.value !== '全部' && role.class !== activeClass.value) return false
    if (activeElement.value !== '全部' && role.element !== activeElement.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      return role.name.toLowerCase().includes(q) || role.desc.toLowerCase().includes(q)
    }
    return true
  })
})

const openDetail = (role) => {
  detailModal.value = { visible: true, role }
  const query = { ...route.query, id: role.id }
  router.replace({ query })
}

const closeDetail = () => {
  detailModal.value.visible = false
  const query = { ...route.query }
  delete query.id
  router.replace({ query })
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

.detail-top {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
}

.detail-basic {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.detail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
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

.detail-labels {
  display: flex;
  align-items: center;
  gap: 6px;
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

.section-content {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.5;
}

.skill-box {
  background: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary);
}

.skill-effect {
  font-size: 12px;
  color: var(--text-main);
  line-height: 1.4;
}
</style>
