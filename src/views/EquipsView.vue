<template>
  <div class="page-view-container">

    <!-- 搜索 + 筛选区（半透明羊皮纸面板） -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索装备名称、描述..." />

      <UiFilterRow label="部位：">
        <UiFilterPill :active="selectedSub === null" @click="selectedSub = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="sub in subCategories"
          :key="sub.type"
          :active="selectedSub === sub.type"
          @click="selectedSub = sub.type"
        >{{ sub.name }}</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow label="品阶：">
        <UiFilterPill :active="selectedLevel === null" @click="selectedLevel = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="lvl in [1, 2, 3, 4, 5]"
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
    </div>

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
    <UiEmptyState v-else type="loading" text="数据加载中..." />
    <UiBackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchItemData, getItemImageUrl } from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { openItemDetail } from '../utils/itemModalState'
import { isBlacklisted } from '../config/blacklist.js'
import { getRarityName } from '../utils/gameMappings'
import { useLazyList } from '../composables/useLazyList'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiItemCard,
  UiSearchInput
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const allItems = ref([])
const subCategories = ref([])
const isDataReady = ref(false)

const searchQuery = ref('')
const selectedSub = ref(null)
const selectedLevel = ref(null)
const selectedRarity = ref(null)

onMounted(async () => {
  const data = await fetchItemData()
  allItems.value = data.items
  
  // 从大分类中找到装备（分类代码为 4），提取其子分类（即部位：武器、防具等）
  const equipNode = data.categoryTree.find(c => String(c.type) === '4')
  if (equipNode) {
    subCategories.value = equipNode.info || []
  }
  
  isDataReady.value = true
  
  // 处理全局 URL 直接唤起
  if (route.query.itemId && data.categoryTree.length) {
    const targetItem = allItems.value.find(i => i.typeId === route.query.itemId)
    if (targetItem) {
      openItemDetail(targetItem, data.categoryTree)
    }
  }
})

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

const filteredItems = computed(() => {
  if (!isDataReady.value) return []
  return allItems.value.filter(item => {
    // 1. 过滤：只保留分类[0]为“4”（装备）的物品
    if (!item.category || String(item.category[0]) !== '4') return false

    // 过滤掉装备箱/展示装备组的容器项（以 'show_' 开头的 ID）
    if (item.typeId && item.typeId.startsWith('show_')) return false

    // 2. 黑名单过滤
    if (isBlacklisted(item)) return false

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
      if (String(item.category[1]) !== String(selectedSub.value)) return false
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
  }).sort((a, b) => {
    // 排序：先按部位升序，再按品阶降序，接着是品质降序，最后是 ID 排序
    const cat1A = a.category && a.category[1] ? Number(a.category[1]) : 0
    const cat1B = b.category && b.category[1] ? Number(b.category[1]) : 0
    if (cat1A !== cat1B) return cat1A - cat1B

    const lvlA = a.equip ? Number(a.equip.equipLevel) : 0
    const lvlB = b.equip ? Number(b.equip.equipLevel) : 0
    if (lvlA !== lvlB) return lvlB - lvlA

    const qualA = a.quality || 0
    const qualB = b.quality || 0
    if (qualA !== qualB) return qualB - qualA

    const idA = a.typeId || ''
    const idB = b.typeId || ''
    return idA.localeCompare(idB)
  })
})

const { displayedItems } = useLazyList(filteredItems, 60, '#itemsGridScroll')

const handleItemClick = (item) => {
  router.push({ query: { ...route.query, itemId: item.typeId } })
}
</script>

<style scoped>
/* 搜索/筛选面板：布局微调，面板底色/描边/间距由全局 .paper-panel 与主题变量提供 */
.filter-panel {
  margin: 0 0 12px 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

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