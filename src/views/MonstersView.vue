<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索怪物名称、描述、弱点..." />
      </template>

      <UiFilterRow v-if="allLabels.length > 0" label="种类：">
        <UiFilterPill :active="selectedLabel === null" @click="selectedLabel = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="label in allLabels"
          :key="label"
          :active="selectedLabel === label"
          @click="selectedLabel = label"
        >{{ label }}</UiFilterPill>
      </UiFilterRow>
    </UiFilterPanel>

    <!-- 列表区（5列大幅面卡片展示，懒加载每批 60 项） -->
    <UiCardGrid id="monstersGridScroll" class="monsters-card-grid" data-image-fallback="custom" v-if="isDataReady">
      <UiItemCard
        v-for="mon in displayedMonsters"
        :key="mon.id"
        :img="getImageUrl(`/images/PicHandBookPanel_Atlas/${mon.icon}.png`)"
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
import { fetchMonsterData } from '../utils/monsterParser'
import { getImageUrl, handleImageFallback } from '../utils/env'
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
  UiFilterPanel, UiSearchInput
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const allMonsters = ref([])
const allLabels = ref([])
const isDataReady = ref(false)
const isModalVisible = ref(false)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedLabel = ref(null)
onMounted(async () => {
  try {
    const data = await fetchMonsterData()
    allMonsters.value = data

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

  let result = allMonsters.value.filter(m => !isBlacklisted(m))
  if (selectedLabel.value) {
    result = result.filter(m => m.label === selectedLabel.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(m => m.keywords.includes(q))
  }
  return result
})

const { displayedItems: displayedMonsters } = useLazyList(filteredMonsters, 60, '#monstersGridScroll')

const handleMonsterClick = (mon) => {
  isModalVisible.value = true
  const targetId = mon.forms?.[0]?.id || mon.summons?.[0]?.id || mon.id
  router.push({ query: { ...route.query, id: targetId } })
}

const handleImgError = (e, mon) => {
  const names = [mon.icon, mon.rawIcon].filter(Boolean)
    .flatMap(name => [name, name.replace('colect_mon_', 'colectr_mon_')])
  handleImageFallback(e, {
    source: getImageUrl(`/images/PicHandBookPanel_Atlas/${mon.icon}.png`),
    candidates: names.map(name => getImageUrl(`/images/PicHandBookPanel_Atlas/${name}.png`))
  })
}
</script>

<style scoped>
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
