<!--
  奖励池列表（副本图鉴 / 关卡图鉴共用）。

  把构建期产物里扁平的奖励条目按 `groupIndex` 还原成奖励池，池内按品质排序，
  并复用 `UiRewardCard` 的概率文案。概率语义与卡片样式只在这里维护一份。
-->
<template>
  <div class="reward-pools">
    <div v-for="group in groups" :key="group.index" class="reward-pool">
      <div class="reward-pool__heading">
        <span class="reward-pool__heading-main">
          <strong>奖励池 {{ group.index + 1 }}</strong>
          <span v-if="sourceOf" class="reward-pool__source">来源：{{ sourceOf(group) }}</span>
        </span>
        <small>{{ rewardGroupLabel(group) }}</small>
      </div>
      <div class="reward-grid" :class="{ 'reward-grid--dense': dense }">
        <UiRewardCard
          v-for="(entry, index) in group.entries"
          :key="`${entry.typeId}-${index}`"
          :rule="rewardRule(entry)"
          :clickable="isRewardClickable(entry)"
          @click="emit('item-click', entry.typeId)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UiRewardCard } from './ui/index.js'
import { isRewardClickable, rewardGroupLabel, rewardGroups, rewardRule } from '../utils/roomDisplay.js'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  /** 可选：为每个奖励池补一行来源说明（副本预览掉落用）。 */
  sourceOf: { type: Function, default: null },
  /** 三列紧凑网格（房间内的采集/掉落池）；默认两列。 */
  dense: { type: Boolean, default: false }
})
const emit = defineEmits(['item-click'])
const groups = computed(() => rewardGroups(props.entries))
</script>

<style scoped>
.reward-pools { display: flex; flex-direction: column; gap: 9px; }
.reward-pool { min-width: 0; }
.reward-pool__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 0 5px; color: var(--text-main); font-size: 12px; }
.reward-pool__heading-main { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.reward-pool__source { color: var(--accent-ink); background: var(--hover-bg); border: 1px solid var(--border-soft); border-radius: 3px; padding: 1px 5px; font-size: 10px; font-weight: 700; }
.reward-pool__heading small { color: var(--text-muted); font-size: 11px; font-weight: 600; }
.reward-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.reward-grid--dense { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 6px; }
/* 窄屏：两列奖励卡改单列，房间内的三列池降到两列（沿用页面原有的移动端断点）。 */
@media (max-width: 440px) {
  .reward-grid { grid-template-columns: 1fr; }
  .reward-grid--dense { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
