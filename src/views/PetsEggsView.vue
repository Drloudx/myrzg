<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板（池子星级 + 孵化行动 + 显示字段 + 表头） -->
    <div class="filter-sticky-bar pet-filter-sticky paper-panel">
      <!-- Row 1: 全宽 池子/星级 分段页签 -->
      <div class="control-row-1">
        <UiSegmentedTabs v-model="activeRow1Filter" :options="row1Options" />
      </div>

      <!-- Row 2: 孵化行动分段页签 + 重置 -->
      <div class="control-row-2">
        <UiSegmentedTabs v-model="activeRow2Filter" :options="row2Options" />
        <UiButton size="sm" variant="secondary" @click="resetFilters">重置</UiButton>
      </div>

      <!-- 显示字段折叠面板 -->
      <UiAccordion v-model="isFieldPanelOpen" :title="`显示字段 (已选 ${selectedFields.length} 项)`">
        <div class="field-checkboxes-grid">
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
      </UiAccordion>

      <!-- 表头行（木色条，按标准字段顺序） -->
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

    <!-- 加载态 -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在拉取并解析魔物蛋数据..." />

    <!-- 表格主体（懒加载每批 60 项） -->
    <div v-else class="pet-table-scroll" id="petTableGrid">
      <div class="pet-table-container paper-panel">
        <div
          v-for="pet in displayedPets"
          :key="pet.id"
          class="pet-table-row"
          @click="openDetail(pet)"
        >
          <!-- 名称 + 蛋图标 -->
          <div class="td-cell td-name">
            <div class="egg-icon-wrapper">
              <img
                :src="getImageUrl(`/pet/eggs/${pet.eggImg}.png`)"
                :alt="pet.name"
                class="egg-img"
                loading="lazy"
                @error="handleImgError"
              />
            </div>
            <span class="pet-name" :class="`quality-text-${pet.quality}`">{{ pet.name }}</span>
          </div>

          <!-- 动态指标列（严格标准字段顺序） -->
          <div
            v-for="fKey in activeOrderedFields"
            :key="fKey"
            class="td-cell"
            :class="`td-${fKey}`"
          >
            <template v-if="fKey === 'recommend'">
              <UiTag :tone="pet.recommendationKey === 'sell' ? 'danger' : (pet.recommendationKey === 'feed' ? 'accent' : 'gold')">
                {{ pet.recommendationText }}
              </UiTag>
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

        <UiEmptyState v-if="filteredPets.length === 0" text="未找到匹配的魔物蛋数据" />
      </div>
    </div>

    <!-- 详情弹窗 -->
    <UiModal
      v-model:visible="detailModal.visible"
      :title="detailModal.pet && detailModal.pet.name ? detailModal.pet.name : '魔物蛋详情'"
      max-width="820px"
      scroll-id="petEggModalScroll"
      @close="closeDetail"
    >
      <template v-if="detailModal.pet && detailModal.pet.name">
        <UiInfoPanel>
          <template #media>
            <img
              v-if="detailModal.pet.eggImg"
              :src="getImageUrl(`/pet/eggs/${detailModal.pet.eggImg}.png`)"
              :alt="detailModal.pet.name"
              class="detail-egg-img"
              loading="lazy"
            />
          </template>
          <UiInfoRow label="星级">
            <UiTag :quality="detailModal.pet.quality">{{ detailModal.pet.displayStar }}星</UiTag>
          </UiInfoRow>
          <UiInfoRow label="推荐">
            <UiTag :tone="detailModal.pet.recommendationKey === 'sell' ? 'danger' : (detailModal.pet.recommendationKey === 'feed' ? 'accent' : 'gold')">
              {{ detailModal.pet.recommendationText }}
            </UiTag>
          </UiInfoRow>
          <UiInfoRow label="孵化时长" :value="detailModal.pet.formattedTime" />
        </UiInfoPanel>

        <UiSection title="孵化收益数据">
          <UiInfoRow label="孵化时长" :value="detailModal.pet.formattedTime" />
          <UiInfoRow label="出售金币">
            <span class="gold-val">{{ detailModal.pet.sellPrice }} 金币</span>
          </UiInfoRow>
          <UiInfoRow label="喂养经验">
            <span class="exp-val">{{ detailModal.pet.exp }} 经验</span>
          </UiInfoRow>
          <UiInfoRow label="分钟金币率">
            <span class="value-highlight">{{ (detailModal.pet.goldPerMin || 0).toFixed(2) }} 金币/分</span>
          </UiInfoRow>
          <UiInfoRow label="分钟经验率">
            <span class="value-highlight">{{ (detailModal.pet.expPerMin || 0).toFixed(2) }} 经验/分</span>
          </UiInfoRow>
          <UiInfoRow label="金效 (售价 ÷ 经验)" :value="(detailModal.pet.goldEff || 0).toFixed(2)" />
          <UiInfoRow label="经效 (经验 ÷ 售价)" :value="(detailModal.pet.expEff || 0).toFixed(4)" />
        </UiSection>

      </template>

      <UiBackToTop scroll-container="#petEggModalScroll" />
    </UiModal>

    <UiBackToTop scroll-container="#petTableGrid" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiSegmentedTabs,
  UiAccordion,
  UiButton,
  UiEmptyState,
  UiModal,
  UiInfoPanel,
  UiInfoRow,
  UiSection,
  UiTag,
  UiBackToTop
} from '../components/ui/index.js'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'
import { buildPetEggsData } from '../utils/petEggsData.js'
import { useLazyList } from '../composables/useLazyList'

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

// Filter options definitions
const row1Options = [
  { value: '全部', label: '全部' },
  { value: '金币池', label: '金币池' },
  { value: '氪金池', label: '氪金池' },
  { value: '3星', label: '3星' },
  { value: '4星', label: '4星' },
  { value: '5星', label: '5星' }
]

const row2Options = [
  { value: '全部', label: '全部' },
  { value: '卖', label: '卖' },
  { value: '喂', label: '喂' },
  { value: '按需选择', label: '按需选择' }
]

// Filter & Control States
const getInitialRow1 = () => {
  if (route.query.pool === 'gold') return '金币池'
  if (route.query.pool === 'premium') return '氪金池'
  if (['3星', '4星', '5星'].includes(route.query.tag)) return route.query.tag
  return '全部'
}

const getInitialRow2 = () => {
  if (['卖', '喂', '按需选择'].includes(route.query.tag)) return route.query.tag
  return '全部'
}

const activeRow1Filter = ref(getInitialRow1())
const activeRow2Filter = ref(getInitialRow2())
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
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}秒`
  return secs > 0 ? `${mins}分钟${secs}秒` : `${mins}分钟`
}

const getFieldLabel = (key) => {
  const match = allFields.find(f => f.key === key)
  return match ? match.label : key
}

const resetFilters = () => {
  activeRow1Filter.value = '全部'
  activeRow2Filter.value = '全部'
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
    let processed = null

    // 优先读取构建期预解析单文件
    try {
      const data = await fetchWithFallback('data/parsed/pet-eggs.json')
      processed = data.pets
    } catch (e) {
      console.warn('parsed/pet-eggs.json 不可用，回退到原始多文件加载:', e?.message || e)
    }

    if (!processed) {
      const res = await fetchWithFallback('data/pet.json')
      processed = buildPetEggsData({ petJson: res }).pets
    }

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
watch([activeRow1Filter, activeRow2Filter], () => {
  const query = {}
  if (activeRow1Filter.value === '金币池') query.pool = 'gold'
  else if (activeRow1Filter.value === '氪金池') query.pool = 'premium'
  else if (activeRow1Filter.value !== '全部') query.tag = activeRow1Filter.value

  if (activeRow2Filter.value !== '全部') query.tag = activeRow2Filter.value

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
    if (isBlacklisted(pet)) return false

    // 1. Row 1 filter (全部 | 金币池 | 氪金池 | 3星 | 4星 | 5星)
    if (activeRow1Filter.value === '金币池' && !goldPoolNames.includes(pet.name)) return false
    if (activeRow1Filter.value === '氪金池' && !premiumPoolNames.includes(pet.name)) return false
    if (['3星', '4星', '5星'].includes(activeRow1Filter.value)) {
      const targetStar = parseInt(activeRow1Filter.value)
      if (pet.displayStar !== targetStar) return false
    }

    // 2. Row 2 filter (全部 | 卖 | 喂 | 按需选择)
    if (activeRow2Filter.value !== '全部') {
      if (pet.recommendationText !== activeRow2Filter.value) return false
    }

    return true
  })

  // Dynamic sorting based on sortState
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

const { displayedItems: displayedPets } = useLazyList(filteredPets, 60, '#petTableGrid')

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
/* 筛选区（半透明羊皮纸面板） */
.pet-filter-sticky {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

/* Row 1: 全宽分段页签均分 */
.control-row-1 {
  width: 100%;
}
.control-row-1 .ui-segmented {
  width: 100%;
}
.control-row-1 :deep(.ui-segmented__item) {
  flex: 1;
}

/* Row 2: 紧凑分段 + 右侧重置按钮 */
.control-row-2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

/* 显示字段复选框网格（页面特有） */
.field-checkboxes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 6px;
}

@media screen and (max-width: 768px) {
  .field-checkboxes-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.field-checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-faint);
  background: rgba(43, 31, 21, 0.06);
  font-size: 13px;
  color: var(--text-main);
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
  border-radius: 3px;
  border: 1.5px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.field-checkbox-item.checked {
  border-color: var(--accent-bright);
  background: rgba(122, 154, 153, 0.14);
}

.field-checkbox-item.checked .checkbox-box {
  background: var(--accent);
  border-color: var(--accent);
}

.field-checkbox-item.checked .checkbox-box::after {
  content: '✓';
  color: var(--paper);
  font-size: 10px;
  font-weight: bold;
}

/* 表头行：木色条 */
.table-header-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--paper);
  background: linear-gradient(180deg, var(--wood-soft), var(--wood));
  border: 1px solid #17100a;
  border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(223, 206, 179, 0.2);
  user-select: none;
  flex-shrink: 0;
}

.th-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  cursor: pointer;
  min-width: 0;
}

.th-name {
  flex: 1.4;
  justify-content: flex-start;
  text-align: left;
}

.sort-icon {
  font-size: 11px;
  opacity: 0.75;
}

/* 表格滚动容器 */
.pet-table-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0 14px 0;
  box-sizing: border-box;
  min-height: 0;
}

.pet-table-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pet-table-row {
  display: flex;
  align-items: center;
  padding: 9px 12px;
  background: transparent;
  border-bottom: 1px solid var(--border-faint);
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 13px;
}

.pet-table-row:last-child {
  border-bottom: none;
}

/* 行斑马纹 */
.pet-table-row:nth-child(even) {
  background: rgba(43, 31, 21, 0.05);
}

.pet-table-row:hover {
  background: rgba(122, 154, 153, 0.14);
}

/* 单元格 */
.td-cell {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.6;
  min-width: 0;
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

/* 详情弹窗内 */
.detail-egg-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}

.gold-val {
  color: var(--gold);
  font-weight: 700;
}

.exp-val {
  color: var(--q4);
  font-weight: 700;
}
</style>
