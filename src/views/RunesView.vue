<template>
  <div class="page-view-container runes-page">
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput :model-value="search" placeholder="搜索符石、效果或材料..." @update:model-value="setFilter('q', $event)" />
      </template>
      <UiTabs :model-value="tab" :options="tabs" @update:model-value="changeTab" />
      <template v-if="isCatalog || isSynthesis">
        <UiFilterRow label="等级：">
          <UiFilterPill :active="!level" @click="setFilter('level', '')">全部</UiFilterPill>
          <UiFilterPill v-for="value in filterLevels" :key="value" :active="level === String(value)" @click="setFilter('level', String(value))">{{ value }} 级</UiFilterPill>
        </UiFilterRow>
        <UiFilterRow label="部位：">
          <UiFilterPill :active="!position" @click="setFilter('position', '')">全部</UiFilterPill>
          <UiFilterPill v-for="value in positions" :key="value" :active="position === String(value)" @click="setFilter('position', String(value))">{{ runePositionName(value) }}</UiFilterPill>
        </UiFilterRow>
      </template>
      <div class="collection-counter">共 <span class="count-num">{{ isCatalog ? filteredCatalog.length : plans.length }}</span> {{ isCatalog ? '种' : '个方案' }}</div>
    </UiFilterPanel>

    <UiEmptyState v-if="loading" type="loading" text="正在加载符石图鉴..." />
    <div v-else-if="error" class="runes-error">
      <UiEmptyState type="error" :text="error" />
      <UiButton @click="loadData">重试</UiButton>
    </div>
    <UiCardGrid v-else id="runesScroll" class="runes-content paper-panel" :content-style="{ gridTemplateColumns: 'minmax(0, 1fr)' }">
      <template v-if="isCatalog">
        <div v-if="filteredCatalog.length" class="runes-grid">
          <article v-for="rune in displayedRunes" :key="rune.id" :data-rune="rune.id" class="rune-entry"
            :class="{ 'is-target': focus === rune.id }">
            <UiItemCard :name="rune.name" :img="getImageUrl(rune.icon)" :quality="rune.quality"
              @click="openItem(rune.id)" @img-error="handleImageFallback" />
            <div class="rune-entry__body">
              <h3 class="rune-entry__name">{{ rune.name }}</h3>
              <div class="rune-entry__meta"><UiTag :quality="rune.quality">{{ rune.effect.level }} 级</UiTag><span>{{ rune.effect.positionLabels.join(' · ') }}</span></div>
              <p class="rune-entry__effect" v-html="rune.effect.desHtml"></p>
            </div>
          </article>
        </div>
        <UiEmptyState v-else text="没有符合条件的符石" />
        <UiSection v-if="filteredCatalog.length && data.enchantCosts.length" title="镶嵌消耗">
          <div class="runes-costs"><UiRewardCard v-for="cost in data.enchantCosts" :key="cost.typeId"
            :rule="imageRule(cost)" :clickable="!!cost.target" @click="openItem(cost.typeId)" /></div>
        </UiSection>
      </template>

      <template v-else-if="isSynthesis && plans.length">
        <div class="runes-grid rune-syntheses">
          <article v-for="{ plan, acquisition } in synthesisCards" :key="plan.id" :data-synthesis="plan.id"
            class="rune-entry rune-synthesis-entry" :class="{ 'is-target': queryString('id') === plan.id }">
            <div class="rune-synthesis-heading">
              <UiItemCard :name="plan.output.name" :img="getImageUrl(plan.output.icon)" :quality="plan.output.quality"
                role="button" tabindex="0" :aria-label="plan.output.name"
                @click="openItem(plan.output.id)" @keydown.enter.prevent="openItem(plan.output.id)" @keydown.space.prevent="openItem(plan.output.id)" @img-error="handleImageFallback" />
              <div class="rune-entry__body">
                <h3 class="rune-entry__name">{{ plan.output.name }}<span class="rune-output-quantity">×{{ acquisition.groups[0].rules[0].min }}</span></h3>
                <div class="rune-entry__meta"><UiTag :quality="plan.output.quality">{{ plan.output.effect.level }} 级</UiTag><span>{{ plan.output.effect.positionLabels.join(' · ') }}</span></div>
              </div>
            </div>
            <div class="rune-synthesis-effects">
              <p class="rune-entry__effect"><span class="rune-effect-label">合成前</span><span v-html="plan.input.effect.desHtml"></span></p>
              <p class="rune-entry__effect"><span class="rune-effect-label">合成后</span><span v-html="plan.output.effect.desHtml"></span></p>
            </div>
            <div class="rune-synthesis-materials">
              <span class="rune-effect-label">合成消耗</span>
              <div class="rune-synthesis-costs">
                <UiRewardCard v-for="cost in acquisition.costs" :key="cost.typeId" :rule="imageRule(cost)"
                  :clickable="!!cost.target" @click="openItem(cost.typeId)" />
              </div>
            </div>
          </article>
        </div>
      </template>
      <template v-else-if="!isSynthesis && plans.length">
        <template v-if="selectedPlan">
          <div class="rune-plan-heading">
            <UiItemCard class="rune-plan-icon" :name="selectedPlan.name" :img="getImageUrl(selectedPlan.icon)" :quality="selectedPlan.quality"
              role="button" tabindex="0" :aria-label="selectedPlan.name"
              @click="openPlanItem" @keydown.enter.prevent="openPlanItem" @keydown.space.prevent="openPlanItem" @img-error="handleImageFallback" />
            <div class="rune-plan-title"><h2>{{ selectedPlan.name }}</h2>
              <p>消耗 {{ scaledAcquisition.sourceItemCount }} 个{{ selectedPlan.name }}</p>
            </div>
            <div v-if="tab === 'appraisal'" class="rune-appraisal-actions">
              <UiButton variant="secondary" size="sm" :aria-expanded="chooserOpen" aria-controls="runeAppraisalChoices"
                @click="chooserOpen = !chooserOpen">选择其他</UiButton>
              <RuneCountInput :model-value="count" @update:model-value="updateCount" />
              <UiButton class="rune-appraise-button" size="sm" @click="appraise">鉴定</UiButton>
            </div>
          </div>
          <div v-if="tab === 'appraisal' && chooserOpen" id="runeAppraisalChoices" class="rune-choices">
            <button v-for="plan in otherAppraisals" :key="plan.id" type="button" class="rune-choice" @click="selectPlan(plan.id)">
              <UiItemCard :name="plan.name" :img="getImageUrl(plan.icon)" :quality="plan.quality" @img-error="handleImageFallback" />
              <span>{{ plan.name }}</span>
            </button>
          </div>
          <p v-if="appraisalError" class="rune-appraisal-error" role="alert">{{ appraisalError }}</p>
          <UiSection v-if="tab === 'appraisal' && lastBatch" class="rune-draw-results" :title="`鉴定结果（${lastBatch.count} 次）`" aria-live="polite">
            <div class="rune-results-grid">
              <button v-for="result in lastBatch.results" :key="result.typeId" type="button" class="rune-choice" :data-quantity="result.count" @click="openItem(result.typeId)">
                <UiItemCard :name="result.name" :img="getImageUrl(result.icon)" :quality="result.quality" @img-error="handleImageFallback" />
                <span>{{ result.name }}<strong>×{{ result.count }}</strong></span>
              </button>
            </div>
          </UiSection>
          <AcquisitionRewards :acquisition="scaledAcquisition" title="鉴定概率"
            cost-title="鉴定费用" @item-click="openItem($event.typeId)" />
        </template>
      </template>
      <UiEmptyState v-else text="没有符合条件的方案" />
    </UiCardGrid>
    <UiBackToTop scroll-container="#runesScroll" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { runePositionName } from '../utils/runeData.js'
import { scaleAcquisition } from '../utils/acquisitionRules.js'
import { appraiseRunes } from '../utils/runeAppraisal.js'
import { useLazyList } from '../composables/useLazyList.js'
import { resolveScrollTarget } from '../utils/scrollTarget.js'
import AcquisitionRewards from '../components/AcquisitionRewards.vue'
import RuneCountInput from '../components/runes/RuneCountInput.vue'
import { isBlacklisted } from '../config/blacklist.js'
import { UiTabs, UiFilterPanel, UiSearchInput, UiFilterRow, UiFilterPill, UiCardGrid, UiItemCard, UiTag,
  UiButton, UiEmptyState, UiBackToTop, UiSection, UiRewardCard } from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()
const tabs = [{ value: 'runes', label: '符石列表' },
  { value: 'appraisal', label: '鉴定' }, { value: 'synthesis', label: '合成' }]
const data = ref(null)
const loading = ref(true)
const error = ref('')
const tab = computed(() => tabs.some(entry => entry.value === route.query.tab) ? route.query.tab : 'runes')
const isCatalog = computed(() => tab.value === 'runes')
const isSynthesis = computed(() => tab.value === 'synthesis')
const queryString = key => typeof route.query[key] === 'string' ? route.query[key] : ''
const search = computed(() => queryString('q'))
const level = computed(() => queryString('level'))
const position = computed(() => queryString('position'))
const focus = computed(() => queryString('focus'))
const normalizeCount = value => Math.max(1, Math.min(999, Math.floor(Number(value)) || 1))
const count = ref(normalizeCount(queryString('count')))
watch(() => route.query.count, value => { count.value = normalizeCount(value) })
const chooserOpen = ref(false)
const lastBatch = ref(null)
const appraisalError = ref('')
const catalog = computed(() => data.value?.runes || [])
const levels = computed(() => [...new Set(catalog.value.map(entry => entry.effect.level))].sort((a, b) => a - b))
const filterLevels = computed(() => isSynthesis.value
  ? [...new Set((data.value?.syntheses || []).map(plan => plan.output.effect.level))].sort((a, b) => a - b)
  : levels.value)
const positions = computed(() => [...new Set(catalog.value.flatMap(entry => entry.effect.positions))].sort((a, b) => a - b))
const matches = entry => {
  const text = [entry.id, entry.name, entry.effect?.description, entry.input?.name, entry.output?.name,
    entry.input?.effect.description, entry.output?.effect.description,
    ...(entry.acquisition?.costs || []).map(cost => cost.targetName)].filter(Boolean).join(' ').toLowerCase()
  return text.includes(search.value.trim().toLowerCase())
}
const filteredCatalog = computed(() => {
  const result = catalog.value.filter(entry => matches(entry)
    && !isBlacklisted({ id: entry.id, name: entry.name, desc: entry.desc })
    && (!level.value || entry.effect.level === Number(level.value))
    && (!position.value || entry.effect.positions.includes(Number(position.value))))
  // A source link remains visible in the first batch without losing its family ordering elsewhere.
  const target = result.find(entry => entry.id === focus.value)
  return target ? [target, ...result.filter(entry => entry !== target)] : result
})
const { displayedItems: displayedRunes } = useLazyList(filteredCatalog, 20, '#runesScroll')
const plans = computed(() => (tab.value === 'appraisal' ? data.value?.appraisals || [] : data.value?.syntheses || [])
  .filter(entry => matches(entry)
    && !isBlacklisted({ id: entry.id, name: entry.name, desc: entry.desc })
    && (!isSynthesis.value
      || ((!level.value || entry.output.effect.level === Number(level.value))
        && (!position.value || entry.output.effect.positions.includes(Number(position.value)))))))
const sortedSyntheses = computed(() => {
  if (!isSynthesis.value) return []
  const target = plans.value.find(plan => plan.id === queryString('id'))
  return target ? [target, ...plans.value.filter(plan => plan !== target)] : plans.value
})
const { displayedItems: displayedSyntheses } = useLazyList(sortedSyntheses, 20, '#runesScroll')
const synthesisCards = computed(() => displayedSyntheses.value.map(plan => ({ plan, acquisition: plan.acquisition })))
const selectedPlan = computed(() => plans.value.find(plan => plan.id === queryString('id')) || plans.value[0] || null)
const otherAppraisals = computed(() => (data.value?.appraisals || []).filter(plan => plan.id !== selectedPlan.value?.id))
const scaledAcquisition = computed(() => scaleAcquisition(selectedPlan.value?.acquisition, count.value))
const imageRule = rule => ({ ...rule, targetImg: rule.targetImg ? getImageUrl(rule.targetImg) : '' })

async function loadData() {
  loading.value = true
  error.value = ''
  try { data.value = await fetchWithFallback('data/parsed/runes.json') }
  catch (cause) {
    error.value = '符石图鉴加载失败，请重试。'
    console.error('Failed to load rune catalog:', cause)
  } finally { loading.value = false }
}
function changeTab(value) { router.push({ path: '/runes', query: { tab: value } }) }
function setFilter(key, value) {
  const query = { ...route.query, tab: tab.value }
  delete query.focus
  delete query.id
  if (value) query[key] = value
  else delete query[key]
  router.replace({ query })
}
function selectPlan(id) {
  chooserOpen.value = false
  const query = { ...route.query, id }
  if (tab.value === 'appraisal') delete query.q
  router.push({ query })
}
function updateCount(value) {
  count.value = normalizeCount(value)
  router.replace({ query: { ...route.query, count: String(count.value) } })
}
function openPlanItem() {
  openItem(selectedPlan.value.id)
}
function appraise() {
  appraisalError.value = ''
  try { lastBatch.value = appraiseRunes(selectedPlan.value.acquisition, count.value) }
  catch (cause) {
    lastBatch.value = null
    appraisalError.value = '鉴定失败，请重新选择符石后重试。'
    console.error('Rune appraisal failed:', cause)
  }
}
function openItem(itemId) {
  if (itemId) router.push({ query: { ...route.query, itemId } })
}
watch([tab, focus, () => isSynthesis.value ? queryString('id') : ''], async () => {
  await nextTick()
  resolveScrollTarget('#runesScroll').scrollTo({ top: 0, behavior: 'auto' })
})
watch([tab, () => selectedPlan.value?.id], () => {
  chooserOpen.value = false
  lastBatch.value = null
  appraisalError.value = ''
})
onMounted(loadData)
</script>

<style scoped>
.collection-counter { font-size: 13px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.filter-panel :deep(.ui-filter-pill.is-active) { color: var(--on-wood-text); }
/* Keep the paper inside the shared clipped content, not behind the sticky header gap. */
.runes-content { background: var(--paper); padding: 12px 14px calc(88px + var(--safe-bottom, 0px)); }
.runes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.rune-entry { display: flex; align-items: flex-start; gap: 12px; padding: 12px; min-width: 0; background: var(--paper-soft); border: 1px solid var(--border-soft); border-radius: 6px; }
.rune-entry.is-target { outline: 2px solid var(--accent-ink); outline-offset: -2px; }
.rune-entry :deep(.ui-item-card) { flex: 0 0 70px; margin: 0; }
.rune-entry :deep(.ui-item-card__name) { display: none; }
.rune-entry__body { flex: 1; min-width: 0; }
.rune-entry__name { margin: 0 0 6px; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.rune-entry__meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--text-muted); font-size: 13px; }
.rune-entry__effect { margin: 8px 0 4px; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.runes-costs { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 240px)); gap: 8px; }
.rune-synthesis-entry { flex-direction: column; gap: 10px; }
.rune-synthesis-heading { display: flex; align-items: center; gap: 12px; width: 100%; }
.rune-output-quantity { margin-left: 8px; color: var(--accent-ink); white-space: nowrap; }
.rune-synthesis-effects { width: 100%; }
.rune-synthesis-effects .rune-entry__effect { display: flex; gap: 10px; margin: 0; }
.rune-synthesis-effects .rune-entry__effect + .rune-entry__effect { margin-top: 4px; }
.rune-effect-label { flex-shrink: 0; font-size: 12px; color: var(--text-muted); line-height: 1.75; }
.rune-synthesis-materials { width: 100%; border-top: 1px solid var(--border-soft); padding-top: 8px; margin-top: auto; }
.rune-synthesis-costs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 5px; }
.rune-synthesis-costs :deep(.ui-reward-card) { padding: 5px; gap: 5px; box-shadow: none; }
.rune-synthesis-costs :deep(.ui-reward-card__icon) { width: 30px; height: 30px; }
.rune-synthesis-costs :deep(.ui-reward-card__icon img) { width: 26px; height: 26px; }
.rune-synthesis-costs :deep(.ui-reward-card__name) { white-space: normal; overflow-wrap: anywhere; font-size: 12px; }
.rune-plan-heading { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 10px 0; }
.rune-plan-icon { flex: 0 0 64px; margin: 0; }
.rune-plan-icon :deep(.ui-item-card__name), .rune-choice :deep(.ui-item-card__name) { display: none; }
.rune-plan-title { flex: 1 1 180px; min-width: 0; }
.rune-appraisal-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.rune-appraisal-actions :deep(.ui-btn) { letter-spacing: 0; }
.rune-appraisal-actions :deep(.ui-btn--secondary) { background: var(--input-bg); color: var(--input-text); }
.rune-appraise-button { color: var(--on-wood-text); }
.rune-choices, .rune-results-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 8px; }
.rune-choices { padding: 10px 0; border-block: 1px solid var(--border-soft); }
.rune-choice { display: flex; align-items: center; gap: 8px; padding: 4px; min-width: 0; border: 0; background: transparent; color: var(--text-main); font: inherit; font-size: 13px; text-align: left; cursor: pointer; border-radius: 4px; }
.rune-choice:hover { background: var(--paper-soft); }
.rune-choice :deep(.ui-item-card) { flex: 0 0 54px; margin: 0; }
.rune-choice > span { overflow-wrap: anywhere; line-height: 1.5; }
.rune-choice strong { display: block; color: var(--accent-ink); }
.rune-appraisal-error { color: var(--text-main); font-size: 13px; }
.rune-plan-heading h2 { font-size: 17px; margin: 0 0 5px; overflow-wrap: anywhere; }
.rune-plan-heading p { font-size: 13px; line-height: 1.6; margin: 0 0 3px; }
.runes-error { text-align: center; padding: 20px; }
@media (max-width: 640px) {
  .runes-content { padding-inline: 10px; }
  .runes-grid { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .rune-entry { padding: 10px; }
  .rune-appraisal-actions { margin-left: 0; flex-basis: 100%; justify-content: flex-start; }
  .rune-choices, .rune-results-grid, .runes-content :deep(.acquisition-group .acquisition-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rune-choice { gap: 6px; padding: 2px; }
  .rune-choice :deep(.ui-item-card) { flex-basis: 44px; }
  .runes-content :deep(.acquisition-group .ui-reward-card) { gap: 6px; padding: 6px; }
  .runes-content :deep(.acquisition-group .ui-reward-card__icon) { width: 32px; height: 32px; }
  .runes-content :deep(.acquisition-group .ui-reward-card__icon img) { width: 28px; height: 28px; }
  .runes-content :deep(.acquisition-group .ui-reward-card__name) { white-space: normal; overflow-wrap: anywhere; }
}
</style>
