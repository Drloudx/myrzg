<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索怪物名称、描述、弱点..." />

      <!-- 图鉴大分类分段页签 -->
      <UiSegmentedTabs
        :model-value="activePokedexTab"
        :options="[{ value: 'official', label: '怪物图鉴' }, { value: 'all', label: '全怪物图鉴' }]"
        @update:model-value="setPokedexTab"
      />

      <!-- 标签筛选（怪物图鉴） -->
      <UiFilterRow v-if="activePokedexTab === 'official' && allLabels.length > 0" label="种类：">
        <UiFilterPill :active="selectedLabel === null" @click="selectedLabel = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="label in allLabels"
          :key="label"
          :active="selectedLabel === label"
          @click="selectedLabel = label"
        >{{ label }}</UiFilterPill>
      </UiFilterRow>
    </div>

    <!-- 列表区（5列大幅面卡片展示，懒加载每批 60 项） -->
    <UiCardGrid id="monstersGridScroll" class="monsters-card-grid" v-if="isDataReady">
      <UiItemCard
        v-for="mon in displayedMonsters"
        :key="mon.id"
        :img="getImageUrl(`/images/MonstersView/${mon.icon}.png`)"
        :name="mon.name"
        @click="handleMonsterClick(mon)"
        @img-error="e => handleImgError(e, mon)"
      />
      <UiEmptyState v-if="filteredMonsters.length === 0" text="无匹配怪物" />
    </UiCardGrid>
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />
    <UiEmptyState v-else type="loading" text="数据加载中..." />

    <!-- Monster Detail Modal -->
    <MonsterDetailModal v-model:visible="isModalVisible" />

    <UiBackToTop scroll-container="#monstersGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchMonsterData, fetchFullMonsterHandbook } from '../utils/monsterParser'
import { getImageUrl } from '../utils/env'
import { useRoute, useRouter } from 'vue-router'
import MonsterDetailModal from '../components/MonsterDetailModal.vue'
import { isBlacklisted } from '../config/blacklist.js'
import { useLazyList } from '../composables/useLazyList'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiItemCard,
  UiSearchInput,
  UiSegmentedTabs
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const allMonsters = ref([])
const allFullMonsters = ref([])
const allLabels = ref([])
const isDataReady = ref(false)
const isModalVisible = ref(false)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedLabel = ref(null)
const activePokedexTab = ref('official')

onMounted(async () => {
  try {
    const [data, fullData] = await Promise.all([
      fetchMonsterData(),
      fetchFullMonsterHandbook()
    ])
    allMonsters.value = data
    allFullMonsters.value = fullData

    // Extract unique labels for official guide
    const labels = new Set()
    data.forEach(m => {
      if (m.label) labels.add(m.label)
    })
    allLabels.value = Array.from(labels).sort()

    isDataReady.value = true
  } catch (err) {
    errorMessage.value = '加载失败: ' + err.message
    console.error(err)
  }
})

const filteredMonsters = computed(() => {
  if (!isDataReady.value) return []

  if (activePokedexTab.value === 'official') {
    let result = allMonsters.value.filter(m => !isBlacklisted(m))
    if (selectedLabel.value) {
      result = result.filter(m => m.label === selectedLabel.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(m => m.keywords.includes(q))
    }
    return result
  } else {
    let result = allFullMonsters.value.filter(m => !isBlacklisted(m))
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(m => m.keywords.includes(q))
    }
    return result
  }
})

const { displayedItems: displayedMonsters } = useLazyList(filteredMonsters, 60, '#monstersGridScroll')

const setPokedexTab = (tab) => {
  activePokedexTab.value = tab
  selectedLabel.value = null
}

const handleMonsterClick = (mon) => {
  isModalVisible.value = true
  const targetId = mon.forms?.[0]?.id || mon.summons?.[0]?.id || mon.id
  router.push({ query: { ...route.query, id: targetId } })
}

const handleImgError = (e, mon) => {
  const currentSrc = e.target.src
  
  // 1. If MonstersView/colect_mon_... fails, try PicHandBookPanel/colect_mon_...
  if (currentSrc.includes('/images/MonstersView/')) {
    e.target.src = currentSrc.replace('/images/MonstersView/', '/images/PicHandBookPanel/')
    return
  }
  
  // 2. Try spelling variant (colect_mon_xxx -> colectr_mon_xxx)
  if (currentSrc.includes('colect_mon_')) {
    e.target.src = currentSrc.replace('colect_mon_', 'colectr_mon_')
    return
  }
  
  // 3. Fallback to rawIcon
  if (mon?.rawIcon) {
    e.target.src = getImageUrl(`/images/MonstersView/${mon.rawIcon}.png`)
    return
  }
  
  // 4. Otherwise hide
  e.target.style.display = 'none'
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

/* 怪物卡片网格（5列大幅面展示，卡片更大更精致） */
.monsters-card-grid :deep(.ui-card-grid) {
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.monsters-card-grid :deep(.ui-item-card) {
  max-width: 135px;
  width: 100%;
}

.monsters-card-grid :deep(.ui-item-card__name) {
  width: calc(100% - 10px);
  margin-top: 4px;
  font-size: 12px;
  padding: 2.5px 4px;
}

@media (max-width: 1100px) {
  .monsters-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
}

@media (max-width: 768px) {
  .monsters-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .monsters-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}
</style>