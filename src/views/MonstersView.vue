<template>
  <div class="page-view-container">
    <!-- Top Filter Header -->
    <div class="filter-sticky-bar pet-filter-sticky">
      <!-- Action & Pool Filter Row -->
      <div class="recommend-filter-row">
        <!-- Left: Action & Star Filter Tags (3星, 4星, 5星) -->
        <div class="tag-group">
          <span
            v-for="tag in ['全部', '卖', '喂', '按需选择', '3星', '4星', '5星']"
            :key="tag"
            :class="['action-filter-tag', { active: activeTagFilter === tag }]"
            @click="activeTagFilter = tag"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Right: Pool Switcher & Reset Button -->
        <div class="right-action-group">
          <div class="pool-segmented-btn">
            <button
              :class="['pool-btn', { active: activePool === 'gold' }]"
              @click="togglePool('gold')"
            >
              金币池
            </button>
            <button
              :class="['pool-btn', { active: activePool === 'premium' }]"
              @click="togglePool('premium')"
            >
              氪金池
            </button>
          </div>
          <button class="reset-btn" @click="resetFilters">重置</button>
        </div>
      </div>

      <!-- Display Field Control Collapsible Panel -->
      <div class="field-control-panel">
        <div class="field-control-header" @click="isFieldPanelOpen = !isFieldPanelOpen">
          <span class="panel-title">
            <span class="blue-bar"></span>
            显示字段 <span class="selected-count">(已选 {{ selectedFields.length }} 项)</span>
          </span>
          <span class="arrow" :class="{ open: isFieldPanelOpen }">▼</span>
        </div>

        <div v-show="isFieldPanelOpen" class="field-checkboxes-grid">
          <label
            v-for="field in allFields"
            :key="field.key"
            :class="['field-checkbox-item', { checked: selectedFields.includes(field.key) }]"
          >
            <input
              type="checkbox"
              :value="field.key"
              v-model="selectedFields"
            />
            <span class="checkbox-box"></span>
            <span class="field-label">{{ field.label }}</span>
          </label>
        </div>
      </div>

      <!-- Table Header Row in Strict Standard Field Order -->
      <div class="table-header-row">
        <div class="th-cell th-name" @click="toggleSort('name')">
          名称 <span class="sort-icon">{{ getSortIcon('name') }}</span>
        </div>
        <div
          v-for="fKey in activeOrderedFields"
          :key="fKey"
          class="th-cell"
          :class="`th-${fKey}`"
          @click="toggleSort(fKey)"
        >
          {{ getFieldLabel(fKey) }} <span class="sort-icon">{{ getSortIcon(fKey) }}</span>
        </div>
      </div>
    </div>

    <!-- Main Async Fetch Loading State -->
    <div v-if="!isDataReady" class="global-loading-state">
      <div class="global-loading-spinner"></div>
      <span>正在拉取并解析魔物蛋数据...</span>
    </div>

    <!-- Main Table Row List -->
    <div v-else class="data-grid-scroll pet-table-scroll" id="petTableGrid">
      <div class="pet-table-container">
        <div
          v-for="pet in filteredPets"
          :key="pet.id"
          class="pet-table-row"
          @click="openDetail(pet)"
        >
          <!-- Left: Name + Egg Icon -->
          <div class="td-cell td-name">
            <div class="egg-icon-wrapper">
              <img
                :src="`/pet/eggs/${pet.eggImg}.png`"
                :alt="pet.name"
                class="egg-img"
                loading="lazy"
                @error="handleImgError"
              />
            </div>
            <span class="pet-name" :class="`rarity-text-${pet.rarityLevel}`">{{ pet.name }}</span>
          </div>

          <!-- Dynamic Metric Cells in Strict Standard Field Order -->
          <div
            v-for="fKey in activeOrderedFields"
            :key="fKey"
            class="td-cell"
            :class="`td-${fKey}`"
          >
            <template v-if="fKey === 'recommend'">
              <span :class="['rec-badge', `rec-${pet.recommendationKey}`]">
                {{ pet.recommendationText }}
              </span>
            </template>
            <template v-else-if="fKey === 'eggTime'">
              {{ pet.formattedTime }}
            </template>
            <template v-else-if="fKey === 'goldEff'">
              {{ pet.goldEff.toFixed(2) }}
            </template>
            <template v-else-if="fKey === 'expEff'">
              {{ pet.expEff.toFixed(4) }}
            </template>
            <template v-else-if="fKey === 'goldPerMin'">
              {{ pet.goldPerMin.toFixed(2) }}
            </template>
            <template v-else-if="fKey === 'expPerMin'">
              {{ pet.expPerMin.toFixed(2) }}
            </template>
            <template v-else>
              {{ pet[fKey] }}
            </template>
          </div>
        </div>
      </div>

      <div v-if="filteredPets.length === 0" class="no-data">未找到匹配的魔物蛋数据</div>
    </div>

    <!-- Detail Modal -->
    <BaseModal :visible="detailModal.visible" :title="`${detailModal.pet.name || ''} 详情`" @close="closeDetail">
      <div class="detail-top">
        <div class="detail-egg-icon">
          <img
            v-if="detailModal.pet.eggImg"
            :src="`/pet/eggs/${detailModal.pet.eggImg}.png`"
            :alt="detailModal.pet.name"
            class="detail-egg-img"
            loading="lazy"
          />
        </div>
        <div class="detail-basic">
          <div class="detail-title-row">
            <span class="detail-title" :class="`rarity-text-${detailModal.pet.rarityLevel}`">
              {{ detailModal.pet.name }}
            </span>
            <span :class="['rec-badge', `rec-${detailModal.pet.recommendationKey}`]">
              {{ detailModal.pet.recommendationText }}
            </span>
          </div>
          <div class="detail-labels">
            <span class="rarity-badge" :class="`badge-${detailModal.pet.rarityLevel}`">{{ detailModal.pet.displayStar }}星</span>
            <span class="mini-tag tag-time">孵化时长：{{ detailModal.pet.formattedTime }}</span>
          </div>
        </div>
      </div>
d
      <!-- Core Metrics Table Section -->
      <div class="detail-section">
        <div class="section-title">孵化收益数据</div>
        <div class="metrics-table">
          <div class="table-row">
            <span class="row-k">孵化时长</span>
            <span class="row-v">{{ detailModal.pet.eggTimeMin }} 分钟 ({{ detailModal.pet.formattedTime }})</span>
          </div>
          <div class="table-row">
            <span class="row-k">出售金币</span>
            <span class="row-v gold-color">{{ detailModal.pet.sellPrice }} 金币</span>
          </div>
          <div class="table-row">
            <span class="row-k">喂养经验</span>
            <span class="row-v exp-color">{{ detailModal.pet.exp }} 经验</span>
          </div>
          <div class="table-row">
            <span class="row-k">分钟金币率</span>
            <span class="row-v highlight">{{ (detailModal.pet.goldPerMin || 0).toFixed(2) }} 金币/分</span>
          </div>
          <div class="table-row">
            <span class="row-k">分钟经验率</span>
            <span class="row-v highlight">{{ (detailModal.pet.expPerMin || 0).toFixed(2) }} 经验/分</span>
          </div>
          <div class="table-row">
            <span class="row-k">金效 (售价 ÷ 经验)</span>
            <span class="row-v">{{ (detailModal.pet.goldEff || 0).toFixed(2) }}</span>
          </div>
          <div class="table-row">
            <span class="row-k">经效 (经验 ÷ 售价)</span>
            <span class="row-v">{{ (detailModal.pet.expEff || 0).toFixed(4) }}</span>
          </div>
        </div>
      </div>

      <!-- Base Attributes -->
      <div class="detail-section" v-if="detailModal.pet.hp">
        <div class="section-title">基础属性</div>
        <div class="attr-grid">
          <div class="attr-cell"><span class="attr-k">生命</span><span class="attr-v">{{ detailModal.pet.hp }}</span></div>
          <div class="attr-cell"><span class="attr-k">攻击</span><span class="attr-v">{{ detailModal.pet.atk }}</span></div>
          <div class="attr-cell"><span class="attr-k">防御</span><span class="attr-v">{{ detailModal.pet.def }}</span></div>
          <div class="attr-cell"><span class="attr-k">敏捷</span><span class="attr-v">{{ detailModal.pet.dex }}</span></div>
        </div>
      </div>

      <!-- Description -->
      <div class="detail-section">
        <div class="section-title">图鉴描述</div>
        <div class="section-content">{{ detailModal.pet.des }}</div>
      </div>
    </BaseModal>

    <BackToTop scroll-container="#petTableGrid" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '../components/BaseModal.vue'
import BackToTop from '../components/BackToTop.vue'

const route = useRoute()
const router = useRouter()

// Exact Gold Pool & Premium Pool Name Matching Lists
const goldPoolNames = [
  '繁茂杜吉芽', '秋风妖精', '源泉猫', '雷素', '提灯妖精', '吵吵蕈', '臭臭蕈',
  '角布林', '掘地芙洛波', '扬沙芙洛波', '顽劣灯火', '游离灯火', '射水杜吉芽',
  '囊袋恐兽', '利齿恐兽', '草原黏团', '魔水粘团', '鱼布林', '绿色史莱姆', '格莉姆'
]

const premiumPoolNames = [
  '宝石迷迷可', '真护之黑龙', '星云史莱姆', '东天之青龙', '格里芬', '繁茂杜吉芽',
  '秋风妖精', '源泉猫', '雷素', '熔火喷炎者', '石像鬼', '蜂刺骑兵', '白银迷迷可',
  '提灯妖精', '吵吵蕈', '臭臭蕈', '角布林', '掘地芙洛波', '扬沙芙洛波', '顽劣灯火',
  '游离灯火', '射水杜吉芽', '囊袋恐兽', '利齿恐兽', '草原黏团', '魔水粘团', '鱼布林',
  '绿色史莱姆', '格莉姆', '冰棱妖精', '抛雪芙洛波', '布丁史莱姆'
]

// Filter & Control States ('all' | 'gold' | 'premium')
const activePool = ref(route.query.pool || 'all')
const activeTagFilter = ref(route.query.tag || '全部')
const isFieldPanelOpen = ref(false)

// Display Field Control Panel Checkboxes Order Definitions
const allFields = [
  { key: 'eggTime', label: '时间' },
  { key: 'sellPrice', label: '金币' },
  { key: 'exp', label: '经验' },
  { key: 'goldPerMin', label: '金币/分' },
  { key: 'expPerMin', label: '经验/分' },
  { key: 'goldEff', label: '金效' },
  { key: 'expEff', label: '经效' },
  { key: 'recommend', label: '优先级' }
]

// Default selected fields
const selectedFields = ref(['sellPrice', 'exp', 'recommend'])

// Computed Ordered Active Fields: Ensures column order strictly matches allFields definition
const activeOrderedFields = computed(() => {
  return allFields.map(f => f.key).filter(k => selectedFields.value.includes(k))
})

// Sorting state: default sort by star rating descending (5星 -> 4星 -> 3星)
const sortState = ref({ field: 'star', dir: 'desc' })

const pets = ref([])
const isDataReady = ref(false)
const detailModal = ref({ visible: false, pet: {} })

const formatEggTime = (seconds) => {
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) {
    return `${totalMin}分钟`
  }
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins > 0 ? `${hrs}小时${mins}分` : `${hrs}小时`
}

const getFieldLabel = (key) => {
  const match = allFields.find(f => f.key === key)
  return match ? match.label : key
}

const togglePool = (pool) => {
  if (activePool.value === pool) {
    activePool.value = 'all' // Clicking active pool deselects it to show all pets
  } else {
    activePool.value = pool
  }
}

const resetFilters = () => {
  activePool.value = 'all'
  activeTagFilter.value = '全部'
  selectedFields.value = ['sellPrice', 'exp', 'recommend']
  sortState.value = { field: 'star', dir: 'desc' }
}

const toggleSort = (field) => {
  if (sortState.value.field === field) {
    sortState.value.dir = sortState.value.dir === 'desc' ? 'asc' : 'desc'
  } else {
    sortState.value = { field, dir: 'desc' }
  }
}

const getSortIcon = (field) => {
  if (sortState.value.field !== field && !(field === 'star' && sortState.value.field === 'name')) return '↑↓'
  return sortState.value.dir === 'desc' ? '↓' : '↑'
}

const handleImgError = (e) => {
  e.target.style.display = 'none'
}

// Decision Rule for Recommendation Tag (卖 / 喂 / 按需选择)
const calcRecommendation = (sellPrice, exp) => {
  if (!exp || exp === 0) return { key: 'sell', text: '卖' }
  const ratio = sellPrice / exp
  if (ratio > 3.0) {
    return { key: 'sell', text: '卖' }
  } else if (ratio < 2.2) {
    return { key: 'feed', text: '喂' }
  } else {
    return { key: 'optional', text: '按需选择' }
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/data/pet.json')
    const json = await res.json()
    const rawList = Object.values(json.datas || {})

    const processed = rawList.map(p => {
      const eggTimeMin = p.eggTime > 0 ? p.eggTime / 60 : 1
      const goldPerMin = p.sellPrice / eggTimeMin
      const expPerMin = p.exp / eggTimeMin
      const goldEff = p.exp > 0 ? (p.sellPrice / p.exp) : 0
      const expEff = p.sellPrice > 0 ? (p.exp / p.sellPrice) : 0
      const rec = calcRecommendation(p.sellPrice, p.exp)

      // Star Mapping: In game minimum star is 3 (1->3星, 2->4星, 3->5星)
      const displayStar = p.star + 2

      return {
        id: p.monId || p.typeId,
        eggImg: p.eggImg || p.typeId,
        name: p.name,
        star: p.star,
        displayStar,
        rarityLevel: displayStar >= 5 ? 'SS' : (displayStar === 4 ? 'S' : 'A'),
        des: p.des,
        eggTime: p.eggTime,
        eggTimeMin: Math.round(eggTimeMin * 10) / 10,
        formattedTime: formatEggTime(p.eggTime),
        sellPrice: p.sellPrice,
        exp: p.exp,
        goldPerMin,
        expPerMin,
        goldEff,
        expEff,
        recommendationKey: rec.key,
        recommendationText: rec.text,
        hp: p.hp,
        atk: p.atk,
        def: p.def,
        dex: p.dex
      }
    })

    pets.value = processed
  } catch (err) {
    console.error('Fetch /data/pet.json error:', err)
  } finally {
    isDataReady.value = true
    if (route.query.id) {
      const match = pets.value.find(p => p.id === String(route.query.id))
      if (match) openDetail(match)
    }
  }
})

// Bidirectional URL Query State Sync
watch([activePool, activeTagFilter], () => {
  const query = {}
  if (activePool.value !== 'all') query.pool = activePool.value
  if (activeTagFilter.value !== '全部') query.tag = activeTagFilter.value
  if (detailModal.value.visible && detailModal.value.pet?.id) {
    query.id = detailModal.value.pet.id
  }
  router.replace({ query })
})

// Watch router query for external routing
watch(() => route.query, (newQuery) => {
  if (newQuery.id && isDataReady.value) {
    const match = pets.value.find(p => p.id === String(newQuery.id))
    if (match) openDetail(match)
  }
})

const filteredPets = computed(() => {
  const result = pets.value.filter(pet => {
    // 1. Pool filter
    if (activePool.value === 'gold' && !goldPoolNames.includes(pet.name)) return false
    if (activePool.value === 'premium' && !premiumPoolNames.includes(pet.name)) return false

    // 2. Action or Star tag filter ('全部' | '卖' | '喂' | '按需选择' | '3星' | '4星' | '5星')
    if (activeTagFilter.value !== '全部') {
      if (['卖', '喂', '按需选择'].includes(activeTagFilter.value)) {
        if (pet.recommendationText !== activeTagFilter.value) return false
      } else if (['3星', '4星', '5星'].includes(activeTagFilter.value)) {
        const targetStar = parseInt(activeTagFilter.value)
        if (pet.displayStar !== targetStar) return false
      }
    }

    return true
  })

  // Dynamic sorting based on sortState (default / name column clicks sort by star level)
  result.sort((a, b) => {
    const field = sortState.value.field
    const dir = sortState.value.dir

    if (field === 'star' || field === 'name') {
      if (a.displayStar !== b.displayStar) {
        return dir === 'desc'
          ? b.displayStar - a.displayStar
          : a.displayStar - b.displayStar
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    }

    let valA = a[field]
    let valB = b[field]

    if (field === 'recommend') {
      const recWeight = { sell: 3, optional: 2, feed: 1 }
      valA = recWeight[a.recommendationKey] || 0
      valB = recWeight[b.recommendationKey] || 0
    }

    if (valA < valB) return dir === 'desc' ? 1 : -1
    if (valA > valB) return dir === 'desc' ? -1 : 1
    return 0
  })

  return result
})

const openDetail = (pet) => {
  detailModal.value = { visible: true, pet }
  const query = { ...route.query, id: pet.id }
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
.pet-filter-sticky {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Action & Pool Filter Row */
.recommend-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-filter-tag {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.action-filter-tag.active {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
  font-weight: 700;
}

.right-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.pool-segmented-btn {
  display: flex;
  background: var(--input-bg, #f1f5f9);
  padding: 3px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
}

.pool-btn {
  padding: 4px 12px;
  border-radius: 16px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.pool-btn.active {
  background: var(--card-bg, #ffffff);
  color: var(--primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.reset-btn {
  padding: 4px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--card-bg, #ffffff);
  font-size: 13px;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reset-btn:hover {
  background: var(--hover-bg);
  color: var(--text-main);
}

/* Display Field Control Panel */
.field-control-panel {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.blue-bar {
  width: 4px;
  height: 14px;
  background: var(--primary);
  border-radius: 2px;
}

.selected-count {
  font-size: 11px;
  color: var(--text-sub);
  font-weight: normal;
}

.arrow {
  font-size: 10px;
  color: var(--text-sub);
  transition: transform 0.2s ease;
}

.arrow.open {
  transform: rotate(180deg);
}

.field-checkboxes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-color);
}

.field-checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--input-bg, #f8fafc);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.field-checkbox-item input {
  display: none;
}

.checkbox-box {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--text-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.field-checkbox-item.checked {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.06);
  color: var(--primary);
  font-weight: 600;
}

.field-checkbox-item.checked .checkbox-box {
  background: var(--primary);
  border-color: var(--primary);
}

.field-checkbox-item.checked .checkbox-box::after {
  content: '✓';
  color: #ffffff;
  font-size: 10px;
  font-weight: bold;
}

/* Table Header Row - Vertically & Horizontally Centered */
.table-header-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.06);
  border-radius: 8px;
  user-select: none;
}

.th-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  cursor: pointer;
}

.th-name {
  flex: 1.4;
  justify-content: flex-start;
  text-align: left;
}

.sort-icon {
  font-size: 11px;
  opacity: 0.7;
}

/* Table Rows & Scroll */
.pet-table-scroll {
  padding-top: 4px;
}

.pet-table-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pet-table-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--card-bg, #ffffff);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.15s ease;
}

.pet-table-row:hover {
  background: var(--hover-bg);
}

/* Table Cell Vertically & Horizontally Centered */
.td-cell {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.td-name {
  flex: 1.4;
  justify-content: flex-start;
  text-align: left;
  gap: 8px;
}

.egg-icon-wrapper {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.egg-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.pet-name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Recommendation Badges ("卖", "喂", "按需选择") */
.rec-badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  display: inline-block;
}

/* 卖 - 浅红背景粉字 */
.rec-sell {
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* 喂 - 浅绿背景绿字 */
.rec-feed {
  background: #ecfdf5;
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

/* 按需选择 - 浅黄/橙背景 */
.rec-optional {
  background: #fffbe8;
  color: #d97706;
  border: 1px solid rgba(217, 119, 6, 0.2);
}

/* Detail Modal Styles */
.detail-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.detail-egg-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-egg-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
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

.detail-labels {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-time {
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.metrics-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg);
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.table-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.row-k {
  color: var(--text-sub);
}

.row-v {
  font-weight: 600;
  color: var(--text-main);
}

.row-v.highlight {
  color: var(--primary);
  font-weight: 700;
}

.gold-color { color: #d97706; }
.exp-color { color: #9333ea; }

.attr-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.attr-cell {
  background: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.attr-k {
  font-size: 10px;
  color: var(--text-sub);
}

.attr-v {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.section-content {
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.5;
}
</style>
