<template>
  <div class="page-view-container">

    <!-- 搜索 + 筛选区（半透明羊皮纸面板） -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索装备名称、描述..." />
      </template>

      <UiFilterRow label="部位：">
        <UiFilterPill :active="selectedSub === null" @click="selectedSub = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="sub in subCategories"
          :key="sub.type"
          :active="selectedSub === sub.type"
          @click="selectedSub = sub.type"
        >{{ sub.name }}</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow v-if="tierOptions.length > 1" label="品阶：">
        <UiFilterPill :active="selectedLevel === null" @click="selectedLevel = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="lvl in tierOptions"
          :key="lvl"
          :active="selectedLevel === lvl"
          @click="selectedLevel = lvl"
        >{{ lvl }}阶</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow label="稀有度：">
        <UiFilterPill :active="selectedRarity === null" @click="selectedRarity = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="r in [1, 2, 3, 4, 5]"
          :key="r"
          :quality="r"
          :active="selectedRarity === r"
          @click="selectedRarity = r"
        >{{ getRarityName(r) }}</UiFilterPill>
      </UiFilterRow>

      <!-- 底部工具栏：计数与视图切换 -->
      <template #footer>
        <div class="equips-toolbar">
          <span class="collection-counter">共 <span class="count-num">{{ filteredItems.length }}</span> 件装备</span>
          <div class="view-mode-toggle" role="group" aria-label="视图模式切换">
            <button
              type="button"
              class="view-mode-btn"
              :class="{ 'is-active': viewMode === 'detail' }"
              title="图文详情模式（直接查看装备主属性与适用职业）"
              @click="viewMode = 'detail'"
            >
              <svg class="view-mode-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3h3v3H2V3zm5 1h7v1H7V4zm0 6h7v1H7v-1zM2 9h3v3H2V9z"/>
              </svg>
              <span>图文模式</span>
            </button>
            <button
              type="button"
              class="view-mode-btn"
              :class="{ 'is-active': viewMode === 'grid' }"
              title="紧凑图标模式（7 列背包格子布局）"
              @click="viewMode = 'grid'"
            >
              <svg class="view-mode-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
              </svg>
              <span>图标模式</span>
            </button>
          </div>
        </div>
      </template>
    </UiFilterPanel>

    <!-- 列表区：支持图文详情与紧凑网格双模式 -->
    <UiCardGrid
      id="itemsGridScroll"
      v-if="isDataReady"
      :class="{ 'items-card-grid': viewMode === 'grid', 'equips-content paper-panel': viewMode === 'detail' }"
      :content-style="viewMode === 'detail' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null"
    >
      <!-- 1. 图文详情模式（仿符石图鉴） -->
      <template v-if="viewMode === 'detail'">
        <div v-if="filteredItems.length" class="equips-grid">
          <article
            v-for="item in displayedItems"
            :key="item.typeId"
            class="equip-entry"
            @click="handleItemClick(item)"
          >
            <UiItemCard
              :img="getImageUrl(getItemImageUrl(item))"
              :name="item.name"
              :quality="item.quality"
              @img-error="handleImgError"
            />
            <div class="equip-entry__body">
              <h3 class="equip-entry__name">{{ item.name }}</h3>
              <div class="equip-entry__meta">
                <UiTag :quality="item.quality">{{ item.equip?.equipLevel || 1 }} 阶</UiTag>
                <span>{{ getMetaText(item) }}</span>
              </div>
              <p v-if="getEquipEffectHtml(item)" class="equip-entry__effect" v-html="getEquipEffectHtml(item)"></p>
            </div>
          </article>
        </div>
        <UiEmptyState v-else text="无匹配装备" />
      </template>

      <!-- 2. 紧凑图标模式（7 列背包格子布局） -->
      <template v-else>
        <UiItemCard
          v-for="item in displayedItems"
          :key="item.typeId"
          :img="getImageUrl(getItemImageUrl(item))"
          :name="item.name"
          :quality="item.quality"
          @click="handleItemClick(item)"
          @img-error="handleImgError"
        />
        <UiEmptyState v-if="filteredItems.length === 0" text="无匹配装备" />
      </template>
    </UiCardGrid>

    <UiEmptyState v-else-if="loadError" type="error" text="装备数据暂时不可用">
      <template #action><UiButton @click="loadItems">重新加载</UiButton></template>
    </UiEmptyState>
    <UiEmptyState v-else type="loading" text="数据加载中..." />
    <UiBackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  compareItemsByCategoryQuality,
  fetchItemData,
  getItemImageUrl,
  isVisibleEquipItem,
  calculateEquipAttributeRange,
  buildEquipAttributeItems,
  translateAttr,
  translateJobArray
} from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { isBlacklisted, isEquipTierHidden, visibleEquipTiers } from '../config/blacklist.js'
import { getRarityName } from '../utils/gameMappings'
import { useLazyList } from '../composables/useLazyList'
import {
  UiBackToTop,
  UiButton,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiItemCard,
  UiTag,
  UiFilterPanel,
  UiSearchInput
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const allItems = ref([])
const subCategories = ref([])
const isDataReady = ref(false)
const loadError = ref(false)
let loadOperation = 0

const searchQuery = ref('')
const selectedSub = ref(null)
const selectedLevel = ref(null)
const selectedRarity = ref(null)

// 视图模式：'detail' 图文模式（默认），'grid' 紧凑图标模式
const viewMode = ref(localStorage.getItem('equips_view_mode') || 'detail')
watch(viewMode, val => {
  try {
    localStorage.setItem('equips_view_mode', val)
  } catch (_) {}
})

/** 可见品阶（已排除 config/blacklist.js 里隐藏的阶） */
const tierOptions = computed(() => visibleEquipTiers())

const loadItems = async () => {
  const operation = ++loadOperation
  loadError.value = false
  try {
    const data = await fetchItemData()
    if (operation !== loadOperation) return
    allItems.value = data.items
    subCategories.value = data.categoryTree.find(c => String(c.type) === '4')?.info || []
    isDataReady.value = true
  } catch (error) {
    if (operation === loadOperation) loadError.value = true
    console.error('Equipment loading failed:', error)
  }
}
onMounted(loadItems)
onBeforeUnmount(() => { loadOperation += 1 })

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

const filteredItems = computed(() => {
  if (!isDataReady.value) return []
  return allItems.value.filter(item => {
    // 1. 与游戏 PicHandBookPanel 一致：只保留正式、未隐藏的装备
    if (!isVisibleEquipItem(item)) return false

    // 2. 黑名单过滤
    if (isBlacklisted(item)) return false

    // 2.5 被隐藏的装备品阶（config/blacklist.js）
    if (isEquipTierHidden(item)) return false

    // 3. 必须包含图标
    if (!item.img) return false

    // 4. 搜索关键词匹配
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchName = item.name && item.name.toLowerCase().includes(q)
      const matchDesc = item.desc && item.desc.toLowerCase().includes(q)
      const matchId = item.typeId && item.typeId.toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchId) return false
    }

    // 5. 部位过滤 (category[1] 对应部位类型)
    if (selectedSub.value !== null) {
      if (String(item.category?.[1]) !== String(selectedSub.value)) return false
    }

    // 6. 装备品阶过滤 (对应 equip.equipLevel)
    if (selectedLevel.value !== null) {
      if (!item.equip || Number(item.equip.equipLevel) !== Number(selectedLevel.value)) return false
    }

    // 7. 稀有度过滤
    if (selectedRarity.value !== null && item.quality !== selectedRarity.value) {
      return false
    }

    return true
  }).sort(compareItemsByCategoryQuality)
})

const { displayedItems } = useLazyList(filteredItems, 60, '#itemsGridScroll')

const handleItemClick = (item) => {
  router.push({ query: { ...route.query, itemId: item.typeId } })
}

// 部位名称映射
function getPositionName(item) {
  const sub = subCategories.value.find(s => String(s.type) === String(item.category?.[1]))
  return sub?.name || '装备'
}

// 适用职业映射
function getJobText(item) {
  if (!item?.equip?.job) return ''
  const jobs = translateJobArray(item.equip.job)
  if (!jobs || !jobs.length) return ''
  if (jobs.length >= 6) return '全职业'
  return jobs.join(' / ')
}

// 部位与职业汇总（对齐符石图鉴第二行元信息）
function getMetaText(item) {
  const parts = [getPositionName(item), getJobText(item)].filter(Boolean)
  return parts.join(' · ')
}

// 提取全部装备属性效果（对齐符石图鉴效果文本与字体样式）
function getEquipEffectHtml(item) {
  if (!item?.equip) return ''
  const range = calculateEquipAttributeRange(item, item.quality, 0)
  if (!range) return ''
  const items = buildEquipAttributeItems(range)
  if (!items.length) return ''
  const parts = items.map(a => {
    const label = translateAttr(a.key)
    const val = a.min === a.max ? `${a.min}` : `${a.min}~${a.max}`
    return `${label}增加 <span class="value-highlight">${val}</span>`
  })
  return `${parts.join('，')}。`
}
</script>

<style scoped>
/* 底部工具栏与模式切换按钮 */
.equips-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px 2px 2px;
  border-top: 1px dashed var(--border-soft);
  margin-top: 2px;
}

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.count-num {
  color: var(--accent-ink);
  font-weight: 700;
}

.view-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--paper-soft, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 2px;
}

.view-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.4;
}

.view-mode-btn:hover {
  color: var(--accent-ink);
  background: rgba(255, 255, 255, 0.3);
}

.view-mode-btn.is-active {
  background: var(--paper-solid, #fff);
  color: var(--accent-ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.view-mode-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* ==================== 1. 图文详情网格（仿符石图鉴） ==================== */
.equips-content {
  background: var(--paper);
  padding: 12px 14px calc(88px + var(--safe-bottom, 0px));
}

.equips-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.equip-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  min-width: 0;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.equip-entry:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  border-color: var(--accent-ink);
}

.equip-entry :deep(.ui-item-card) {
  flex: 0 0 70px;
  margin: 0;
}

.equip-entry :deep(.ui-item-card__name) {
  display: none;
}

.equip-entry__body {
  flex: 1;
  min-width: 0;
}

.equip-entry__name {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.equip-entry__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  color: var(--text-muted);
  font-size: 13px;
}

.equip-entry__effect {
  margin: 8px 0 4px;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

/* ==================== 2. 紧凑图标模式（7 列背包格子布局） ==================== */
.items-card-grid :deep(.ui-card-grid) {
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

@media (max-width: 1100px) {
  .items-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }
}

@media (max-width: 900px) {
  .equips-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .equip-entry {
    padding: 10px;
  }
  .equip-entry :deep(.ui-item-card) {
    flex-basis: 58px;
  }
}

@media (max-width: 768px) {
  .items-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}

@media (max-width: 640px) {
  .equips-content {
    padding-inline: 10px;
  }
}

@media (max-width: 480px) {
  .items-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .view-mode-btn span:not(.view-mode-icon) {
    display: none;
  }
  .view-mode-btn {
    padding: 4px 6px;
  }
}
</style>
