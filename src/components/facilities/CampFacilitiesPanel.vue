<template>
    <div class="filter-panel paper-panel camp-filter-panel">
      <UiSearchInput :model-value="search" :placeholder="isResearch ? '搜索研究、效果或材料...' : '搜索建筑、效果或材料...'" @update:model-value="setSearch" />
      <slot name="section-tabs" />
      <UiFilterRow v-if="isResearch" label="分类：">
        <UiFilterPill :active="!team" @click="setTeam('')">全部</UiFilterPill>
        <UiFilterPill v-for="option in teams" :key="option.id" :active="team === option.id" @click="setTeam(option.id)">{{ option.name }}</UiFilterPill>
      </UiFilterRow>
      <div class="camp-count">共 <span class="count-num">{{ matches.length }}</span> 项</div>
    </div>

    <UiCardGrid id="campFacilitiesScroll" class="camp-grid paper-panel" :class="{ 'camp-grid--research-detail': isResearch && researchDetail }" wide>
      <UiEmptyState v-if="!selected" text="没有匹配的营地项目" />
      <div v-else-if="isResearch && !researchDetail" class="camp-content">
        <CampResearchTree :entries="camp.research" :matches="matches" @select="selectResearch" />
      </div>
      <div v-else class="camp-content" :class="{ 'camp-research-detail': isResearch }">
        <div v-if="!isResearch" class="camp-building-picker">
          <button v-for="entry in matches" :key="entry.id" type="button" class="camp-building-choice" :class="{ 'is-active': selected.id === entry.id }"
            :aria-label="entry.name" :aria-pressed="selected.id === entry.id" @click="selectEntry(entry.id)">
            <img :src="getImageUrl(entry.icon)" :alt="entry.name" @error="handleImageError" />
            <strong>{{ entry.name }}</strong><span>最高 {{ entry.levels.at(-1)?.level }} 级</span>
          </button>
        </div>
        <div class="camp-heading">
          <div class="camp-heading-portrait" :class="{ 'is-research': isResearch }" :style="isResearch ? { backgroundImage: `url('${getImageUrl('/images/CampCenterPanel/build_tree_iconbotm.png')}')` } : {}">
            <img :src="getImageUrl(selected.icon)" :alt="selected.name" @error="handleImageError" />
          </div>
          <div>
            <h2>{{ selected.name }}</h2>
            <p v-if="isResearch">{{ selected.description }}</p>
            <p v-else-if="selected.unlockCondition">开放条件：{{ selected.unlockCondition }}</p>
          </div>
          <UiButton v-if="isResearch" class="camp-overview-button" variant="secondary" size="sm" @click="showResearchTree">返回研究树</UiButton>
        </div>
        <UiFilterRow class="camp-level-selector" :label="isResearch ? '等级：' : '当前：'">
          <UiFilterPill :active="level === 'all'" @click="setLevel('all')">全部</UiFilterPill>
          <UiFilterPill v-for="entry in selected.levels" :key="entry.level" :active="level === entry.level" @click="setLevel(entry.level)">{{ entry.level }}级</UiFilterPill>
        </UiFilterRow>
        <UiInfoRow v-if="isResearch" label="前置研究">
          <UiButton v-if="selected.prerequisite" variant="link" size="sm" @click="goPrerequisite">{{ selected.prerequisite.name }} 1级</UiButton>
          <span v-else>无</span>
        </UiInfoRow>

        <div class="camp-level-grid" :class="{ 'is-single': visibleLevels.length === 1 }">
        <UiSection v-for="entry in visibleLevels" :key="`${selected.id}:${entry.level}`" class="camp-level" :data-level="entry.level" :title="levelTitle(entry)">
          <template v-if="isResearch">
            <div class="camp-research-effect"><span>研究效果</span><strong>{{ selected.description }} {{ previousEffect(entry.level) }} → {{ entry.effect }}</strong></div>
            <UiInfoRow label="研究条件">
              <span v-if="entry.playerLevel">玩家等级 {{ entry.playerLevel }}级</span>
              <UiButton v-if="canLocateBuilding(entry)" variant="link" size="sm" @click="goBuilding(entry)">{{ entry.buildingName }} {{ entry.buildingLevel }}级</UiButton>
              <span v-else-if="entry.buildingName"> · {{ entry.buildingName }} {{ entry.buildingLevel }}级</span>
            </UiInfoRow>
            <UiInfoRow label="研究时间" :value="formatCampDuration(entry.timeSeconds)" />
            <div class="camp-materials">
              <h4>研究消耗</h4>
              <div class="camp-rewards">
                <UiRewardCard v-for="(cost, index) in entry.costs" :key="index" :rule="toRule(cost)" clickable @click="openItem(cost.typeId)" />
              </div>
              <p v-if="!entry.costs.length">无需消耗</p>
            </div>
            <div v-if="entry.recipes.length" class="camp-links">
              <span>解锁改良配方</span>
              <UiButton v-for="recipe in entry.recipes" :key="recipe.id" variant="link" size="sm" @click="goRecipe(recipe)">{{ recipe.name }}</UiButton>
            </div>
          </template>

          <template v-else>
            <div class="camp-upgrade-comparison" :class="{ 'is-max': !entry.upgrade }">
              <div class="camp-upgrade-stage">
                <img :src="getImageUrl(entry.icon)" :alt="`${selected.name}${entry.level}级`" @error="handleImageError" />
                <h4>当前 {{ entry.level }}级{{ !entry.upgrade ? '（满级）' : '' }}</h4>
                <p v-if="entry.description" class="camp-description">{{ entry.description }}</p>
                <UiInfoRow v-for="stat in entry.stats" :key="stat.key" :label="stat.label" :value="stat.value" />
                <div v-if="entry.recipes.length" class="camp-links">
                  <span>本级开放配方</span>
                  <UiButton v-for="recipe in entry.recipes" :key="recipe.id" variant="link" size="sm" @click="goRecipe(recipe)"><img v-if="recipe.img" class="camp-recipe-icon" :src="getImageUrl(recipe.img)" alt="" @error="handleImageError" /><span>{{ recipe.name }}</span></UiButton>
                </div>
              </div>
              <div v-if="entry.upgrade" class="camp-upgrade-stage is-next">
                <img :src="getImageUrl(nextLevel(entry).icon)" :alt="`${selected.name}${entry.upgrade.toLevel}级`" @error="handleImageError" />
                <h4>升级后 {{ entry.upgrade.toLevel }}级</h4>
                <p v-if="nextLevel(entry)?.description" class="camp-description">{{ nextLevel(entry).description }}</p>
                <UiInfoRow v-for="stat in nextLevel(entry)?.stats || []" :key="stat.key" :label="stat.label" :value="stat.value" />
                <div v-if="nextLevel(entry)?.recipes.length" class="camp-links">
                  <span>升级后开放配方</span>
                  <UiButton v-for="recipe in nextLevel(entry).recipes" :key="recipe.id" variant="link" size="sm" @click="goRecipe(recipe)"><img v-if="recipe.img" class="camp-recipe-icon" :src="getImageUrl(recipe.img)" alt="" @error="handleImageError" /><span>{{ recipe.name }}</span></UiButton>
                </div>
              </div>
            </div>
            <template v-if="entry.upgrade">
              <UiInfoRow label="升级条件">
                <span v-if="entry.upgrade.playerLevel">玩家等级 {{ entry.upgrade.playerLevel }}级</span>
                <UiButton v-if="entry.upgrade.centerLevel" variant="link" size="sm" @click="goBuilding({ building: 'center', buildingLevel: entry.upgrade.centerLevel })">营地中心 {{ entry.upgrade.centerLevel }}级</UiButton>
              </UiInfoRow>
              <div v-if="nextLevel(entry)?.appearance" class="camp-links">
                <span>建筑外观</span>
                <UiButton variant="link" size="sm" @click="goFurniture(nextLevel(entry).appearance.id)">{{ nextLevel(entry).appearance.name }}</UiButton>
              </div>
              <div class="camp-materials">
                <h4>升级消耗</h4>
                <div class="camp-rewards">
                  <UiRewardCard v-for="(cost, index) in entry.upgrade.costs" :key="index" :rule="toRule(cost)" clickable @click="openItem(cost.typeId)" />
                </div>
                <p v-if="!entry.upgrade.costs.length">无需消耗</p>
              </div>
              <div v-if="entry.upgrade.rewards.length" class="camp-materials">
                <h4>升级奖励</h4>
                <div class="camp-rewards">
                  <UiRewardCard v-for="(reward, index) in entry.upgrade.rewards" :key="index" :rule="toRule(reward)" clickable @click="openItem(reward.typeId)" />
                </div>
              </div>
            </template>
          </template>
        </UiSection>
        </div>
      </div>
    </UiCardGrid>
    <UiBackToTop scroll-container="#campFacilitiesScroll" />
</template>

<script setup>
import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getImageUrl } from '../../utils/env.js'
import { formatCampDuration } from '../../utils/campFacilityData.js'
import { resolveScrollTarget } from '../../utils/scrollTarget.js'
import CampResearchTree from './CampResearchTree.vue'
import { UiBackToTop, UiButton, UiCardGrid, UiEmptyState, UiFilterPill, UiFilterRow, UiInfoRow, UiRewardCard, UiSearchInput, UiSection } from '../ui/index.js'

const props = defineProps({ camp: { type: Object, required: true }, mode: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const isResearch = computed(() => props.mode === 'research')
const search = computed(() => String(route.query.q || ''))
const team = computed(() => String(route.query.group || ''))
const entries = computed(() => isResearch.value ? props.camp.research : props.camp.buildings)
const teams = computed(() => [...new Map(props.camp.research.map(entry => [entry.team, { id: entry.team, name: entry.teamName }])).values()])
const matches = computed(() => {
  const query = search.value.trim().toLowerCase()
  return entries.value.filter(entry => (!isResearch.value || !team.value || entry.team === team.value)
    && (!query || [entry.name, entry.description, ...entry.levels.flatMap(level => [level.description, level.effect,
      ...(level.costs || level.upgrade?.costs || []).map(cost => cost.name),
      ...(level.upgrade?.rewards || []).map(reward => reward.name)])].some(value => String(value || '').toLowerCase().includes(query))))
})
const selected = computed(() => matches.value.find(entry => entry.id === route.query[isResearch.value ? 'research' : 'building']) || matches.value[0])
const researchDetail = computed(() => isResearch.value && !!route.query.research && selected.value?.id === route.query.research)
const level = computed(() => selected.value?.levels.some(entry => entry.level === Number(route.query.level)) ? Number(route.query.level)
  : route.query.level === 'all' ? 'all' : selected.value?.levels[0]?.level || 'all')
const visibleLevels = computed(() => (selected.value?.levels || []).filter(entry => level.value === 'all' || entry.level === level.value))
const updateQuery = patch => {
  const query = { ...route.query, ...patch }
  for (const key of Object.keys(query)) if (query[key] === '' || query[key] == null) delete query[key]
  return router.replace({ query })
}
const setSearch = q => updateQuery({ q, level: 'all' })
const setTeam = group => updateQuery({ group, research: undefined, level: 'all' })
const selectEntry = id => updateQuery({ [isResearch.value ? 'research' : 'building']: id, level: 'all' })
const selectResearch = id => updateQuery({ research: id, q: undefined, level: 1 })
const showResearchTree = () => updateQuery({ research: undefined, level: undefined })
const setLevel = value => updateQuery({ [isResearch.value ? 'research' : 'building']: selected.value?.id, level: value })
const goPrerequisite = () => updateQuery({ research: selected.value.prerequisite.id, group: undefined, q: undefined, level: 1 })
const canLocateBuilding = entry => props.camp.buildings.some(building => building.id === entry.building && building.levels.some(level => level.level === entry.buildingLevel))
const goBuilding = entry => router.push({ path: '/facilities', query: { facility: 'camp', mode: 'building', building: entry.building, level: entry.buildingLevel } })
const goRecipe = recipe => router.push({ path: '/facilities', query: { facility: recipe.facility, mode: 'crafting', level: recipe.level, item: recipe.itemId } })
const goFurniture = id => router.push({ path: '/furniture', query: { id } })
const openItem = itemId => router.push({ query: { ...route.query, itemId } })
const nextLevel = entry => selected.value.levels.find(candidate => candidate.level === entry.upgrade?.toLevel)
const previousEffect = value => selected.value.levels.find(entry => entry.level === value - 1)?.effect || '未研究'
const levelTitle = entry => isResearch.value ? `${entry.level}级研究` : entry.upgrade ? `${entry.level}级 → ${entry.upgrade.toLevel}级` : `${entry.level}级 · 满级`
const toRule = item => ({ typeId: item.typeId, targetName: item.name, targetImg: getImageUrl(item.img), targetQuality: item.quality, min: item.num, max: item.num })
const handleImageError = event => { event.target.onerror = null; event.target.src = getImageUrl('/ui/visibility-off.svg') }
watch([() => props.mode, () => selected.value?.id, researchDetail], async () => {
  await nextTick()
  resolveScrollTarget('#campFacilitiesScroll').scrollTo({ top: 0, behavior: 'auto' })
})
</script>

<style scoped>
/* The shared active pill uses a background token as text; keep camp controls readable in both themes. */
.camp-filter-panel :deep(.ui-filter-pill.is-active), .camp-level-selector :deep(.ui-filter-pill.is-active) { color: var(--on-wood-text) !important; }
.camp-count { font-size: 13px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
/* The page shell clips this surface below the sticky filters on desktop. */
.camp-grid { background: var(--paper); }
.camp-grid--research-detail { min-height: calc(100dvh - 307px); box-sizing: border-box; }
.camp-grid :deep(.ui-card-grid) { grid-template-columns: minmax(0, 1fr); }
.camp-content { min-width: 0; padding: 12px 14px 24px; }
.camp-heading { display: flex; gap: 14px; align-items: center; margin: 16px 0; }
.camp-heading-portrait { width: 80px; height: 80px; flex: 0 0 80px; display: grid; place-items: center; background-size: contain; background-repeat: no-repeat; background-position: center; }
.camp-heading img { width: 72px; height: 72px; object-fit: contain; }
.camp-heading-portrait.is-research img { width: 48px; height: 48px; }
.camp-heading > div { min-width: 0; }
.camp-heading h2 { font-size: 18px; margin: 0; line-height: 1.6; letter-spacing: 0; }
.camp-heading p, .camp-description, .camp-materials p { margin: 6px 0; font-size: 13px; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; color: var(--text-main); }
.camp-level-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; align-items: start; }
.camp-level-grid.is-single { grid-template-columns: minmax(0, 1fr); }
.camp-level { margin: 0; padding: 14px; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-soft); }
.camp-level-selector { padding-block: 10px; border-block: 1px solid var(--border-soft); }
.camp-building-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; }
.camp-building-choice { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-soft); color: var(--text-main); cursor: pointer; font: inherit; font-size: 12px; }
.camp-building-choice.is-active { outline: 2px solid var(--accent-ink); outline-offset: -2px; background: var(--highlight-bg, var(--paper-soft)); }
.camp-building-choice img { width: 52px; height: 52px; object-fit: contain; }
.camp-building-choice > span { color: var(--text-muted); font-size: 11px; }
.camp-upgrade-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 12px; }
.camp-upgrade-comparison.is-max { grid-template-columns: minmax(0, 1fr); }
.camp-upgrade-stage { min-width: 0; padding: 4px 10px 8px 0; }
.camp-upgrade-stage.is-next { border-left: 1px solid var(--border-soft); padding-inline: 10px 0; }
.camp-upgrade-stage > img { display: block; width: 76px; height: 76px; object-fit: contain; margin: 0 auto 6px; }
.camp-upgrade-stage > h4 { text-align: center; margin: 0 0 10px; font-size: 13px; }
.camp-upgrade-stage.is-next > h4 { color: var(--accent-ink); }
.camp-research-effect { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-left: 3px solid var(--accent-ink); background: var(--paper); margin-bottom: 12px; font-size: 13px; line-height: 1.7; }
.camp-research-effect > span { color: var(--text-muted); font-size: 12px; }
.camp-research-effect > strong { font-weight: 600; }
.camp-heading .camp-overview-button { margin-left: auto; flex: 0 0 auto; align-self: flex-start; }
.camp-overview-button { background: var(--input-bg); color: var(--input-text); }
.camp-level :deep(.ui-section__title) { letter-spacing: 0; }
.camp-level :deep(.ui-info-row) { line-height: 1.6; }
.camp-materials h4 { font-size: 13px; line-height: 1.6; margin: 10px 0 6px; }
.camp-rewards { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.camp-rewards :deep(.ui-reward-card__name) { white-space: normal; overflow-wrap: anywhere; line-height: 1.6; }
.camp-links :deep(.ui-btn) { white-space: normal; overflow-wrap: anywhere; letter-spacing: 0; }
.camp-links { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 10px; font-size: 13px; line-height: 1.6; }
.camp-links > span { color: var(--text-muted); }
.camp-recipe-icon { width: 22px; height: 22px; flex: 0 0 22px; object-fit: contain; }
@media (max-width: 640px) {
  .camp-content { padding: 10px 12px 20px; }
  .camp-grid--research-detail { min-height: 0; }
  .camp-building-picker { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .camp-building-choice { padding: 8px 2px; }
  .camp-building-choice img { width: 42px; height: 42px; }
  .camp-level-grid { grid-template-columns: minmax(0, 1fr); }
  .camp-level { padding: 10px; }
  .camp-heading-portrait { width: 64px; height: 64px; flex-basis: 64px; }
  .camp-heading img { width: 56px; height: 56px; }
  .camp-heading .camp-overview-button { align-self: center; }
  .camp-upgrade-stage :deep(.ui-info-row) { flex-wrap: wrap; gap: 2px; }
  .camp-rewards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
