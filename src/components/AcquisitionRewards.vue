<template>
  <UiSection v-if="acquisition?.groups?.length || acquisition?.costs?.length" :title="title">
    <div v-if="acquisition.costs.length" class="acquisition-costs">
      <h4>{{ costTitle }}</h4>
      <div class="acquisition-grid">
        <UiRewardCard v-for="(cost, index) in acquisition.costs" :key="index"
          :rule="imageRule(cost)" :clickable="!!cost.target" @click="emit('item-click', cost)" />
      </div>
    </div>
    <div v-for="(group, index) in acquisition.groups" :key="index" class="acquisition-group">
      <div class="acquisition-heading">
        <UiTag tone="gold">{{ formatRewardGroupLabel(group) }}</UiTag>
        <span v-if="group.num > 1 && !group.isSelect">(获得 {{ group.num }} 次)</span>
      </div>
      <div class="acquisition-grid">
        <div v-for="(rule, ruleIndex) in group.rules" :key="ruleIndex" class="acquisition-entry">
          <UiRewardCard :rule="imageRule(rule)" :clickable="!!rule.target" @click="emit('item-click', rule)" />
          <details v-if="rule.candidates?.length" class="acquisition-candidates">
            <summary>可能出现的装备</summary>
            <UiRewardCard v-for="(candidate, candidateIndex) in rule.candidates" :key="candidateIndex"
              :rule="imageRule(candidate)" :clickable="!!candidate.target" @click="emit('item-click', candidate)" />
          </details>
        </div>
      </div>
    </div>
  </UiSection>
</template>

<script setup>
import { UiSection, UiTag, UiRewardCard } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import { formatRewardGroupLabel } from '../utils/acquisitionRules.js'

defineProps({
  acquisition: { type: Object, default: null },
  title: { type: String, default: '开启奖励' },
  costTitle: { type: String, default: '额外消耗' }
})
const emit = defineEmits(['item-click'])
const imageRule = rule => ({ ...rule, targetImg: rule.targetImg ? getImageUrl(rule.targetImg) : '' })
</script>

<style scoped>
.acquisition-costs, .acquisition-group { margin-bottom: 12px; }
.acquisition-group:last-child { margin-bottom: 0; }
.acquisition-costs h4 { margin: 0 0 8px; font-size: 13px; }
.acquisition-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; }
.acquisition-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 8px; }
@media (max-width: 640px) {
  .acquisition-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}
.acquisition-entry { min-width: 0; }
.acquisition-candidates { margin-top: 8px; font-size: 13px; }
.acquisition-candidates summary { cursor: pointer; margin-bottom: 8px; }
.acquisition-candidates :deep(.ui-reward-card) { margin-bottom: 6px; }
</style>
