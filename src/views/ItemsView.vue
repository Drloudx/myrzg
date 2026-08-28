<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索物品名称、描述..." />

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
      <UiEmptyState v-if="filteredItems.length === 0" text="无匹配物品" />
    </UiCardGrid>
    <UiEmptyState v-else type="loading" text="数据加载中..." />

    <UiBackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchItemData, getItemImageUrl } from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { openItemDetail } from '../utils/itemModalState'
import { isBlacklisted } from '../config/blacklist.js'
import { getRarityName } from '../utils/gameMappings'
import { useRoute, useRouter } from 'vue-router'
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
const categoryTree = ref([])
const isDataReady = ref(false)

const searchQuery = ref('')
const selectedMain = ref(null)
const selectedSub = ref(null)
const selectedMini = ref(null)
const selectedRarity = ref(null)

onMounted(async () => {
  const data = await fetchItemData()
  allItems.value = data.items
  categoryTree.value = data.categoryTree
  isDataReady.value = true
  
  // 处理全局 URL 唤起
  if (route.query.itemId && categoryTree.value.length) {
    const targetItem = allItems.value.find(i => i.typeId === route.query.itemId)
    if (targetItem) {
      openItemDetail(targetItem, categoryTree.value)
    }
  }
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
  const list = mainNode?.info ? [...mainNode.info] : []
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

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

const filteredItems = computed(() => {
  if (!isDataReady.value) return []
  return allItems.value.filter(item => {
    // 黑名单过滤
    if (isBlacklisted(item)) return false

    // 开发者调试开关：隐藏没有图标的物品（img 字段为空）
    // 如果需要开启此功能，取消下面一行的注释即可
    if (!item.img) return false

    // 搜索过滤
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchName = item.name && item.name.toLowerCase().includes(q)
      const matchDesc = item.desc && item.desc.toLowerCase().includes(q)
      const matchId = item.typeId && item.typeId.toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchId) return false
    }

    // 稀有度过滤
    if (selectedRarity.value !== null && item.quality !== selectedRarity.value) {
      return false
    }

    // 分类过滤
    if (selectedMain.value !== null) {
      if (!item.category || String(item.category[0]) !== String(selectedMain.value)) return false
      
      if (selectedSub.value !== null) {
        if (selectedSub.value === 'fav_gift') {
          const isFavGift = (item.favValue !== undefined && item.favValue !== 0 && item.favValue !== 1) && 
                            (item.useDes && item.useDes.includes('好感'))
          if (!isFavGift) return false
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

    // 2. 中类 (Category 1)
    const cat1A = a.category && a.category[1] ? Number(a.category[1]) : 0
    const cat1B = b.category && b.category[1] ? Number(b.category[1]) : 0
    if (cat1A !== cat1B) return cat1A - cat1B

    // 3. 小类 (Category 2)
    const cat2A = a.category && a.category[2] ? Number(a.category[2]) : 0
    const cat2B = b.category && b.category[2] ? Number(b.category[2]) : 0
    if (cat2A !== cat2B) return cat2A - cat2B

    // 4. 品质 (Quality) - 从高到低
    const qualA = a.quality || 0
    const qualB = b.quality || 0
    if (qualA !== qualB) return qualB - qualA

    // 5. ID (typeId)
    const idA = a.typeId || ''
    const idB = b.typeId || ''
    const idCmp = idA.localeCompare(idB)
    if (idCmp !== 0) return idCmp

    // 6. 同 id 再按名称（中文拼音兜底）
    const nameA = a.name || ''
    const nameB = b.name || ''
    return nameA.localeCompare(nameB, 'zh-Hans-CN')
  })
})

const { displayedItems } = useLazyList(filteredItems, 60, '#itemsGridScroll')

const handleItemClick = (item) => {
  // Update URL to trigger App.vue watcher and open modal, keeping it in sync
  router.push({ query: { ...route.query, itemId: item.typeId } })
}
</script>

<style scoped>
/* 筛选面板：半透明羊皮纸容器（底色/描边由 theme.css .paper-panel 提供） */
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  margin: 0 0 12px 0;
  flex-shrink: 0;
  max-height: 55vh;
  overflow-y: auto;
  box-sizing: border-box;
}

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