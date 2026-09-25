<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索怪物名称、描述、弱点..." />
      </template>

      <!-- 地区筛选放在种类上面（用户要求） -->
      <UiFilterRow v-if="allPlaces.length > 0" label="地区：">
        <UiFilterPill :active="selectedPlace === null" @click="selectedPlace = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="place in allPlaces"
          :key="place"
          :active="selectedPlace === place"
          @click="selectedPlace = place"
        >{{ place }}</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow v-if="allLabels.length > 0" label="种类：">
        <UiFilterPill :active="selectedLabel === null" @click="selectedLabel = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="label in allLabels"
          :key="label"
          :active="selectedLabel === label"
          @click="selectedLabel = label"
        >{{ label }}</UiFilterPill>
      </UiFilterRow>

      <!-- 属性筛选（放最下面） -->
      <UiFilterRow label="属性：">
        <UiFilterPill :active="selectedElement === null" @click="selectedElement = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="(elementName, elementKey) in ELEMENT_NAMES"
          :key="elementKey"
          :active="selectedElement === Number(elementKey)"
          @click="selectedElement = Number(elementKey)"
        >{{ elementName }}</UiFilterPill>
      </UiFilterRow>
    </UiFilterPanel>

    <!-- 列表区（5列大幅面卡片展示，懒加载每批 60 项） -->
    <UiCardGrid id="monstersGridScroll" class="monsters-card-grid" data-image-fallback="custom" v-if="isDataReady">
      <UiItemCard
        v-for="mon in displayedMonsters"
        :key="mon.id"
        :img="getImageUrl(`/images/PicHandBookPanel_Atlas/${mon.icon}.webp`)"
        :name="mon.name"
        :quality="mon.quality"
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
import { MAP_NAMES, ELEMENT_NAMES } from '../utils/gameMappings'
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
const allPlaces = ref([])
const isDataReady = ref(false)
const isModalVisible = ref(false)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedLabel = ref(null)
const selectedPlace = ref(null)
const selectedElement = ref(null)
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

    // 地区清单按**游戏推进顺序**排（沿用 gameMappings 的 MAP_NAMES：c0 求生者草原 →
    // c1 秋日荒野 → c2 索利德山地 → c3 魔爪湖畔 → c4 黑森林 → c5 霜烬平原）。
    // 不用字典序（地理名按拼音排会很乱），也不用数据出现顺序（那只是图鉴编号顺序）。
    //
    // **必须过黑名单**：否则被隐藏的地区（如黑森林）仍会出现在筛选栏里，
    // 点进去还是空的（怪物列表本身是过滤的）——按钮与列表不一致。
    const places = new Set()
    data.forEach(m => {
      for (const place of m.place || []) {
        if (isBlacklisted(place)) continue
        places.add(place)
      }
    })
    const REGION_ORDER = Object.values(MAP_NAMES)
    allPlaces.value = Array.from(places).sort((a, b) => {
      const ia = REGION_ORDER.indexOf(a)
      const ib = REGION_ORDER.indexOf(b)
      // 不在表里的地区排到最后，且保持彼此原有相对顺序
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

    isDataReady.value = true
  } catch (err) {
    errorMessage.value = '加载失败: ' + err.message
    console.error(err)
  }
})

const filteredMonsters = computed(() => {
  if (!isDataReady.value) return []

  let result = allMonsters.value.filter(m => !isBlacklisted(m))
  if (selectedPlace.value) {
    // 一个怪物可出现在多个地区（如「角布林头领」= 求生者草原 + 秋日荒野），故用 includes 而非相等
    result = result.filter(m => (m.place || []).includes(selectedPlace.value))
  }
  if (selectedLabel.value) {
    result = result.filter(m => m.label === selectedLabel.value)
  }
  if (selectedElement.value !== null) {
    const targetElement = ELEMENT_NAMES[selectedElement.value]
    result = result.filter(m => (m.mark || []).some(k => k.includes(targetElement)))
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
    source: getImageUrl(`/images/PicHandBookPanel_Atlas/${mon.icon}.webp`),
    candidates: names.map(name => getImageUrl(`/images/PicHandBookPanel_Atlas/${name}.webp`))
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
