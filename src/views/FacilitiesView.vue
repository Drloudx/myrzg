<template>
  <div class="page-view-container facilities-page" :class="{ 'camp-panel': isCamp }">
    <CampFacilitiesPanel v-if="isDataReady && !errorMessage && isCamp && camp" :camp="camp" :mode="section">
      <template #section-tabs>
        <UiTabs :model-value="section" :options="sectionOptions" @update:model-value="setSection" />
      </template>
    </CampFacilitiesPanel>
    <UiFilterPanel v-else class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" :placeholder="isCamp ? (section === 'research' ? '搜索研究、效果或材料...' : '搜索建筑、效果或材料...') : '搜索产物或制作材料...'" />
      </template>
      <UiTabs :model-value="section" :options="sectionOptions" @update:model-value="setSection" />

      <template v-if="!isCamp">
        <UiFilterRow label="设施：">
          <UiFilterPill
            v-for="option in facilityOptions"
            :key="option.value"
            :active="selectedFacility === option.value"
            @click="selectedFacility = option.value"
          >{{ option.label }}</UiFilterPill>
        </UiFilterRow>

        <UiFilterRow v-if="modeOptions.length > 1" label="功能：">
          <UiFilterPill
            v-for="option in modeOptions"
            :key="option.value"
            :active="selectedMode === option.value"
            @click="selectedMode = option.value"
          >{{ option.label }}</UiFilterPill>
        </UiFilterRow>

        <UiFilterRow v-if="levelOptions.length" label="等级：">
          <UiFilterPill
            v-for="option in levelOptions"
            :key="option.value"
            :active="selectedLevel === option.value"
            @click="selectedLevel = option.value"
          >{{ option.label }}</UiFilterPill>
        </UiFilterRow>

        <div v-if="currentFacility" class="facility-intro">
          <div class="facility-intro__image quality-bg-2">
            <img :src="getImageUrl(currentFacility.icon)" :alt="currentFacility.name" />
          </div>
          <div class="facility-intro__content">
            <strong>{{ currentFacility.name }}</strong>
            <span>{{ currentFacility.description }}</span>
          </div>
        </div>

        <div class="facility-count">共 <strong>{{ filteredRecipes.length }}</strong> 项</div>
      </template>
    </UiFilterPanel>

    <UiEmptyState v-if="!isDataReady" type="loading" text="正在整理设施数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />

    <UiEmptyState v-else-if="isCamp && !camp" type="error" text="营地数据加载失败，请更新数据后重试" />
    <UiCardGrid v-else-if="!isCamp" id="facilitiesScroll" class="facilities-grid" wide>
      <article
        v-for="recipe in filteredRecipes"
        :key="recipe.id"
        class="facility-recipe paper-panel-solid"
        :class="{ 'is-target': targetItemId === recipe.output.typeId }"
      >
        <button type="button" class="facility-output" @click="openItem(recipe.output.typeId)">
          <strong class="facility-output__name">{{ recipe.output.name }}</strong>
          <span class="facility-output__icon" :class="recipe.mode === 'equipment' ? '' : `quality-bg-${recipe.output.quality}`">
            <img :src="getImageUrl(recipe.output.img)" :alt="recipe.output.name" loading="lazy" />
          </span>
        </button>

        <div class="facility-materials">
          <div class="facility-materials__head">
            <strong>制作材料</strong>
            <div v-if="recipe.isImproved || recipe.category || recipe.output.min || recipe.makeTime" class="facility-materials__meta">
              <span v-if="recipe.isImproved">改良配方</span>
              <span v-else-if="recipe.category">{{ recipe.category }}</span>
              <span v-if="recipe.output.min">产出 ×{{ formatAmount(recipe.output.min, recipe.output.max) }}</span>
              <span v-if="recipe.makeTime">{{ formatDuration(recipe.makeTime) }}</span>
            </div>
          </div>
          <div v-if="recipe.materials.length" class="facility-materials__grid">
            <UiRewardCard
              v-for="material in recipe.materials"
              :key="material.typeId"
              :rule="toRewardRule(material)"
              :clickable="!!material.typeId"
              @click="openItem(material.typeId)"
            />
          </div>
          <UiEmptyState v-else text="无需物品材料" />

          <div v-if="recipe.qualityChances?.length" class="quality-chances">
            <span>品质概率</span>
            <strong
              v-for="chance in recipe.qualityChances"
              :key="chance.quality"
              :class="`quality-text-${chance.quality}`"
            >{{ qualityName(chance.quality) }} {{ formatChance(chance.chance) }}</strong>
          </div>
        </div>
      </article>

      <UiEmptyState v-if="filteredRecipes.length === 0" text="这一等级没有匹配的制作项目" />
    </UiCardGrid>

    <UiBackToTop v-if="!isCamp" scroll-container="#facilitiesScroll" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'
import { resolveScrollTarget } from '../utils/scrollTarget.js'
import CampFacilitiesPanel from '../components/facilities/CampFacilitiesPanel.vue'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiRewardCard,
  UiFilterPanel, UiSearchInput,
  UiTabs
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()
const facilities = ref([])
const isDataReady = ref(false)
const errorMessage = ref('')
const sectionOptions = [{ value: 'recipes', label: '设施配方' }, { value: 'building', label: '营地升级' }, { value: 'research', label: '属性研究' }]
const isCamp = computed(() => route.query.facility === 'camp')
const section = computed(() => isCamp.value ? (route.query.mode === 'research' ? 'research' : 'building') : 'recipes')
const camp = computed(() => facilities.value.find(facility => facility.key === 'camp'))
const recipeFacilities = computed(() => facilities.value.filter(facility => facility.key !== 'camp'))
const replaceQuery = patch => {
  const query = { ...route.query, ...patch }
  for (const key of Object.keys(query)) if (query[key] == null || query[key] === '') delete query[key]
  return router.replace({ query })
}
const setSection = value => {
  if (value === section.value) return
  replaceQuery({ facility: value === 'recipes' ? 'blacksmith' : 'camp', mode: value === 'recipes' ? 'equipment' : value,
    level: 'all', tier: undefined, q: undefined, item: undefined, itemId: undefined, building: undefined, research: undefined, group: undefined })
}
const selectedFacility = computed({
  get: () => recipeFacilities.value.some(entry => entry.key === route.query.facility) ? String(route.query.facility) : 'blacksmith',
  set: facility => replaceQuery({ facility, mode: recipeFacilities.value.find(entry => entry.key === facility)?.modes[0]?.key || 'crafting', level: 'all', tier: undefined, item: undefined })
})
const selectedMode = computed({
  get: () => currentFacility.value?.modes.some(entry => entry.key === route.query.mode) ? String(route.query.mode) : currentFacility.value?.modes[0]?.key || 'equipment',
  set: mode => replaceQuery({ mode, level: 'all', tier: undefined, item: undefined })
})
const selectedLevel = computed({
  get: () => currentMode.value?.levels?.includes(Number(route.query.level || route.query.tier)) ? Number(route.query.level || route.query.tier) : 'all',
  set: level => replaceQuery({ level, tier: undefined })
})
const searchQuery = computed({ get: () => String(route.query.q || ''), set: q => replaceQuery({ q }) })
const targetItemId = computed(() => String(route.query.item || ''))

const currentFacility = computed(() => recipeFacilities.value.find(facility => facility.key === selectedFacility.value) || recipeFacilities.value[0] || null)
const currentMode = computed(() => currentFacility.value?.modes.find(mode => mode.key === selectedMode.value) || currentFacility.value?.modes[0] || null)
const facilityOptions = computed(() => recipeFacilities.value.map(facility => ({ value: facility.key, label: facility.name })))
const modeOptions = computed(() => (currentFacility.value?.modes || []).map(mode => ({ value: mode.key, label: mode.name })))
const levelOptions = computed(() => [
  { value: 'all', label: '全部' },
  ...(currentMode.value?.levels || []).map(level => ({
    value: level,
    label: `${level}${currentMode.value?.key === 'equipment' ? '阶' : '级'}`
  }))
])
const filteredRecipes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return (currentMode.value?.recipes || []).filter(recipe => {
    if (selectedLevel.value !== 'all' && Number(recipe.level) !== Number(selectedLevel.value)) return false
    if (!query) return true
    return [recipe.output?.name, recipe.output?.typeId, ...(recipe.materials || []).flatMap(material => [material.name, material.typeId])]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
})

watch(section, async () => {
  // A recipe deep link has its own target alignment; ordinary tab changes start at the top.
  if (!isCamp.value && targetItemId.value) return
  await nextTick()
  resolveScrollTarget(isCamp.value ? '#campFacilitiesScroll' : '#facilitiesScroll').scrollTo({ top: 0, behavior: 'auto' })
})

watch([isDataReady, () => route.query.facility, () => route.query.mode, targetItemId], async () => {
  if (!isDataReady.value || isCamp.value || !targetItemId.value) return
  await nextTick()
  document.querySelector('.facility-recipe.is-target')?.scrollIntoView({ block: 'center' })
})

onMounted(async () => {
  try {
    facilities.value = await fetchWithFallback('data/parsed/facilities.json')
    if (!Array.isArray(facilities.value)) throw new Error('设施数据格式不正确')
  } catch (error) {
    console.error('加载设施功能失败:', error)
    errorMessage.value = `加载失败：${error?.message || error}`
  } finally {
    isDataReady.value = true
  }
})

const toRewardRule = material => ({
  typeId: material.typeId,
  targetName: material.name,
  targetImg: getImageUrl(material.img),
  targetQuality: material.quality,
  min: material.num,
  max: material.num
})
const openItem = typeId => typeId && router.push({ query: { ...route.query, itemId: typeId } })
const formatAmount = (min, max) => Number(min) === Number(max) ? min : `${min}~${max}`
const formatChance = chance => `${Number((Number(chance || 0) * 100).toFixed(1))}%`
const qualityName = quality => ({ 3: '蓝', 4: '紫', 5: '橙' }[quality] || `品质${quality}`)
const formatDuration = seconds => {
  const value = Number(seconds) || 0
  if (value < 60) return `制作 ${value} 秒`
  const minutes = Math.floor(value / 60)
  const remain = value % 60
  return `制作 ${minutes} 分${remain ? `${remain} 秒` : ''}`
}
</script>

<style scoped>
.facility-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.facility-intro__image {
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.facility-intro__image img {
  width: 68px;
  height: 68px;
  object-fit: contain;
}
.facility-intro__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.facility-intro__content strong { font-size: 16px; color: var(--text-main); }
.facility-intro__content span { font-size: 13px; line-height: 1.6; color: var(--text-muted); }
.facility-count { font-size: 13px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.facility-count strong { color: var(--accent-ink); }
.facilities-grid :deep(.ui-card-grid) { grid-template-columns: minmax(0, 1fr); }
.facility-recipe {
  display: grid;
  grid-template-columns: minmax(120px, 0.22fr) minmax(0, 1fr);
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  min-width: 0;
}
.facility-recipe.is-target { border-color: var(--accent-bright); box-shadow: 0 0 0 2px rgba(122, 154, 153, 0.25); }
.facility-output {
  appearance: none;
  border: 0;
  border-right: 1px solid var(--border-faint);
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 2px 12px 2px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  min-width: 0;
}
.facility-output__name {
  width: 100%;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-main);
  text-align: center;
  word-break: break-word;
}
.facility-output__icon {
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.facility-output__icon img { width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
.facility-materials { display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; min-width: 0; }
.facility-materials__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.facility-materials__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px 10px; margin-left: auto; }
.facility-materials__head strong { font-size: 13px; color: var(--text-main); }
.facility-materials__head span { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.facility-materials__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 136px));
  justify-content: start;
  gap: 7px;
}
.facility-materials__grid :deep(.ui-reward-card) {
  width: 100%;
  max-width: 136px;
  justify-self: start;
  box-sizing: border-box;
}
.quality-chances { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.quality-chances > span { color: var(--text-muted); }

@media (max-width: 640px) {
  .facility-intro__image { width: 64px; height: 64px; flex-basis: 64px; }
  .facility-intro__image img { width: 58px; height: 58px; }
  .facility-recipe { grid-template-columns: 86px minmax(0, 1fr); gap: 8px; padding: 9px; }
  .facility-output { gap: 5px; padding-right: 8px; }
  .facility-output__name { font-size: 13px; }
  .facility-output__icon { width: 58px; height: 58px; }
  .facility-output__icon img { width: 52px; height: 52px; }
  .facility-materials__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .facility-materials__grid :deep(.ui-reward-card) { gap: 5px; padding: 6px; max-width: 142px; }
  .facility-materials__grid :deep(.ui-reward-card__icon) { width: 38px; height: 38px; }
  .facility-materials__grid :deep(.ui-reward-card__icon img) { width: 32px; height: 32px; }
  .facility-materials__grid :deep(.ui-reward-card__name) { font-size: 12px; }
}
</style>
