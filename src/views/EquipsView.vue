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
    </UiFilterPanel>

    <!-- 列表区（桌面端精准一行 7 列，懒加载每批 60 项） -->
    <UiCardGrid id="itemsGridScroll" class="items-card-grid" v-if="isDataReady">
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
    </UiCardGrid>
    <UiEmptyState v-else-if="loadError" type="error" text="装备数据暂时不可用">
      <template #action><UiButton @click="loadItems">重新加载</UiButton></template>
    </UiEmptyState>
    <UiEmptyState v-else type="loading" text="数据加载中..." />
    <UiBackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { compareItemsByCategoryQuality, fetchItemData, getItemImageUrl, isVisibleEquipItem } from '../utils/itemParser'
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
  UiFilterPanel, UiSearchInput
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
</script>

<style scoped>
/* 装备网格：桌面端精准 7 列布局（与物品图鉴完全统一） */
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
