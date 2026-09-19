<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索物品名称、描述..." />
      </template>

      <!-- 级联大类 -->
      <UiFilterRow label="大类：">
        <UiFilterPill :active="selectedMain === null" @click="selectMain(null)">全部</UiFilterPill>
        <UiFilterPill
          v-for="cat in categoryTree"
          :key="cat.type"
          :active="selectedMain === cat.type"
          @click="selectMain(cat.type)"
        >{{ cat.name }}</UiFilterPill>
      </UiFilterRow>

      <!-- 级联中类 -->
      <UiFilterRow v-if="subCategoryTree.length > 0" label="中类：">
        <UiFilterPill :active="selectedSub === null" @click="selectSub(null)">全部</UiFilterPill>
        <UiFilterPill
          v-for="sub in subCategoryTree"
          :key="sub.type"
          :active="selectedSub === sub.type"
          @click="selectSub(sub.type)"
        >{{ sub.name }}</UiFilterPill>
      </UiFilterRow>

      <!-- 级联小类 -->
      <UiFilterRow v-if="miniCategoryTree.length > 0" label="小类：">
        <UiFilterPill :active="selectedMini === null" @click="selectMini(null)">全部</UiFilterPill>
        <UiFilterPill
          v-for="mini in miniCategoryTree"
          :key="mini.type"
          :active="selectedMini === mini.type"
          @click="selectMini(mini.type)"
        >{{ mini.name }}</UiFilterPill>
      </UiFilterRow>

      <!-- 品阶：仅装备大类下显示（装备的「阶」= item.equip.equipLevel，与装备图鉴一致） -->
      <UiFilterRow v-if="showTierFilter" label="品阶：">
        <UiFilterPill :active="selectedTier === null" @click="selectedTier = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="tier in tierOptions"
          :key="tier"
          :active="selectedTier === tier"
          @click="selectedTier = tier"
        >{{ tier }}阶</UiFilterPill>
      </UiFilterRow>

      <!-- 稀有度 -->
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
    </UiFilterPanel>

    <!-- 按行窗口化，列数沿用响应式网格样式。 -->
    <UiVirtualGrid ref="itemGrid" id="itemsGridScroll" class="items-card-grid" v-if="isDataReady" :items="filteredItems" item-key="typeId">
      <template #default="{ item }">
        <UiItemCard
          :key="item.typeId"
          :data-item-id="item.typeId"
          :img="getImageUrl(getItemImageUrl(item))"
          :name="item.name"
          :quality="item.quality"
          @click="handleItemClick(item)"
          @img-error="handleImageFallback"
        />
      </template>
      <template #empty><UiEmptyState text="无匹配物品" /></template>
    </UiVirtualGrid>
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage">
      <template #action><UiButton @click="loadItems">重试</UiButton></template>
    </UiEmptyState>
    <UiEmptyState v-else type="loading" text="数据加载中..." />

    <UiBackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { compareItemsByCategoryQuality, fetchItemData, getItemImageUrl, isVisibleEquipItem } from '../utils/itemParser'
import { getImageUrl, handleImageFallback } from '../utils/env'
import { itemModalState } from '../utils/itemModalState'
import { isBlacklisted, isEquipTierHidden, visibleEquipTiers } from '../config/blacklist.js'
import { getRarityName } from '../utils/gameMappings'
import { useRoute, useRouter } from 'vue-router'
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'
import {
  UiBackToTop,
  UiButton,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiItemCard,
  UiFilterPanel, UiSearchInput
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const allItems = shallowRef([])
const categoryTree = ref([])
const isDataReady = ref(false)
const errorMessage = ref('')
const itemGrid = ref(null)
let loadOperation = 0
let initialDetailId = route.query.itemId || null

const searchQuery = ref('')
const selectedMain = ref(null)
const selectedSub = ref(null)
const selectedMini = ref(null)
const selectedRarity = ref(null)
/** 装备品阶（equip.equipLevel）。仅装备大类下生效，见 showTierFilter */
const selectedTier = ref(null)

/** 装备大类的 type 为 '4'（与 items.json 的 categoryTree 一致） */
const EQUIP_MAIN_TYPE = '4'
/** 仅在装备大类（含其子类）下显示品阶筛选；被隐藏的阶不出现（否则点了是空列表） */
const showTierFilter = computed(() =>
  String(selectedMain.value) === EQUIP_MAIN_TYPE && visibleEquipTiers().length > 1)
const tierOptions = computed(() => visibleEquipTiers())

/** 切走装备大类时清掉品阶选择，避免留下无效筛选 */
watch(selectedMain, () => {
  if (String(selectedMain.value) !== EQUIP_MAIN_TYPE) selectedTier.value = null
})

const loadItems = async () => {
  const operation = ++loadOperation
  errorMessage.value = ''
  isDataReady.value = false
  try {
    const data = await fetchItemData()
    if (operation !== loadOperation) return
    allItems.value = data.items
    categoryTree.value = data.categoryTree
    isDataReady.value = true
  } catch (error) {
    if (operation === loadOperation) errorMessage.value = '物品数据加载失败，请重试'
  }
}

onMounted(loadItems)
onBeforeUnmount(() => { loadOperation += 1 })

watch(() => itemModalState.visible, async visible => {
  if (visible || !initialDetailId || !isDataReady.value) return
  const targetId = initialDetailId
  initialDetailId = null
  await nextTick()
  // A shared link has no earlier list position; wait for modal restoration first.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await itemGrid.value?.scrollToItem(targetId)
})

// 监听级联切换重置下级
const selectMain = (val) => {
  selectedMain.value = val
  selectedSub.value = null
  selectedMini.value = null
}

const selectSub = (val) => {
  selectedSub.value = val
  selectedMini.value = null
}

const selectMini = (val) => {
  selectedMini.value = val
}

const subCategoryTree = computed(() => {
  if (selectedMain.value === null) return []
  const mainNode = categoryTree.value.find(c => String(c.type) === String(selectedMain.value))
  const list = mainNode?.info ? mainNode.info
    .filter(sub => !(String(selectedMain.value) === '2' && String(sub.type) === '24'))
    .map(sub => (
      String(selectedMain.value) === '5' && String(sub.type) === '51'
        ? { ...sub, name: '配方' }
        : sub
    )) : []
  if (String(selectedMain.value) === '2') {
    list.unshift({ type: 'fav_gift', name: '好感礼物' })
  }
  return list
})

const miniCategoryTree = computed(() => {
  if (selectedSub.value === null) return []
  const subNode = subCategoryTree.value.find(c => String(c.type) === String(selectedSub.value))
  return subNode?.info || []
})

const isCollectionFormula = (item) => {
  return String(item?.category?.[1] || '') === '51'
    || item?.useAction === 'unlockMenu'
    || item?.useAction === 'unlockFormula'
}

const isCollectionFurniture = (item) => {
  return ['unlockHomeItem', 'unlockHomeItemSkin'].includes(item?.useAction)
    && item?.homeItemUnlocks?.some(unlock => unlock.catalogVisible)
}

const getCollectionSortGroup = (item) => {
  const name = String(item?.name || '')
  const subCategory = String(item?.category?.[1] || '')

  if (name.startsWith('指名契约书')) return 0
  if (name.includes('碎片') || item?.useAction === 'getHeroStar') return 1
  if (isCollectionFormula(item)) return 2
  if (isCollectionFurniture(item)) return 3
  if (subCategory === '54') return 4
  if (subCategory === '55' || item?.useAction === 'unlockHeroSkin') return 5
  return 6
}

const getCollectionSubtypeSortGroup = (item) => {
  if (!isCollectionFormula(item)) return 0
  if (String(item?.category?.[1] || '') === '51' || item?.useAction === 'unlockMenu') return 0
  if (item?.useAction === 'unlockFormula') return 1
  return 2
}

const filteredItems = computed(() => {
  if (!isDataReady.value) return []
  return allItems.value.filter(item => {
    // equipGroup 的 show_* 仅用于奖励池预览，不是玩家背包物品。
    if (String(item.typeId || '').startsWith('show_')) return false

    // 黑名单过滤
    if (isBlacklisted(item)) return false

    // 被隐藏的装备品阶（config/blacklist.js）
    if (isEquipTierHidden(item)) return false

    // 家具图纸在游戏 NewItemTips 中使用 BuildItem 图集，部分正式图纸没有 item.img。
    if (!item.img && !isCollectionFurniture(item)) return false

    // 搜索过滤
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchName = item.name && item.name.toLowerCase().includes(q)
      const matchDesc = item.desc && item.desc.toLowerCase().includes(q)
      const matchId = item.typeId && item.typeId.toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchId) return false
    }

    // 装备品阶过滤（仅装备有该字段；非装备不参与，避免把没有 equipLevel 的条目全滤掉）
    if (selectedTier.value !== null) {
      if (Number(item.equip?.equipLevel) !== Number(selectedTier.value)) return false
    }

    // 稀有度过滤
    if (selectedRarity.value !== null && item.quality !== selectedRarity.value) {
      return false
    }

    // 分类过滤
    // 装备分类遵循游戏图鉴的 hide/equipLevel 规则，避免混入测试装备。
    if (item.category && String(item.category[0]) === '4' && !isVisibleEquipItem(item)) return false

    if (selectedMain.value !== null) {
      if (!item.category || String(item.category[0]) !== String(selectedMain.value)) return false
      
      if (selectedSub.value !== null) {
        if (selectedSub.value === 'fav_gift') {
          const isFavGift = (item.favValue !== undefined && item.favValue !== 0 && item.favValue !== 1) && 
                            (item.useDes && item.useDes.includes('好感'))
          if (!isFavGift) return false
        } else if (String(selectedMain.value) === '5' && String(selectedSub.value) === '51') {
          if (!isCollectionFormula(item)) return false
        } else if (String(selectedMain.value) === '5' && String(selectedSub.value) === '52') {
          if (!isCollectionFurniture(item)) return false
        } else {
          if (String(item.category[1]) !== String(selectedSub.value)) return false
          
          if (selectedMini.value !== null) {
            if (String(item.category[2]) !== String(selectedMini.value)) return false
          }
        }
      }
    }

    return true
  }).sort((a, b) => {
    // 1. 大类 (Category 0)
    const cat0A = a.category && a.category[0] ? Number(a.category[0]) : 0
    const cat0B = b.category && b.category[0] ? Number(b.category[0]) : 0
    if (cat0A !== cat0B) return cat0A - cat0B

    // 收集类原表中大量条目缺少中类，按实际用途分组，避免契约、碎片和家具混排。
    if (cat0A === 5) {
      const groupDiff = getCollectionSortGroup(a) - getCollectionSortGroup(b)
      if (groupDiff) return groupDiff

      const subtypeDiff = getCollectionSubtypeSortGroup(a) - getCollectionSubtypeSortGroup(b)
      if (subtypeDiff) return subtypeDiff

      const qualityDiff = Number(b.quality || 0) - Number(a.quality || 0)
      if (qualityDiff) return qualityDiff

      const idDiff = String(a.typeId || '').localeCompare(String(b.typeId || ''))
      if (idDiff) return idDiff

      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    }

    return compareItemsByCategoryQuality(a, b)
  })
})

const handleItemClick = (item) => {
  initialDetailId = null
  // Update URL to trigger App.vue watcher and open modal, keeping it in sync
  router.push({ query: { ...route.query, itemId: item.typeId } })
}
</script>

<style scoped>
/* 物品网格：桌面端精准 7 列布局 */
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

@media (max-width: 768px) {
  .items-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .items-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
}
</style>
