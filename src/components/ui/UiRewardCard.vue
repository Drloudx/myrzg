<template>
  <div
    class="ui-reward-card"
    :class="{ 'is-clickable': clickable }"
    :title="rule.targetName || ''"
    @click="clickable && emit('click', rule)"
  >
    <div
      class="ui-reward-card__icon"
      :class="rule.targetQuality ? `quality-bg-${rule.targetQuality}` : ''"
    >
      <img v-if="rule.targetImg" :src="rule.targetImg" :alt="rule.targetName" loading="lazy" @error="handleRewardImageError" />
      <span v-else class="ui-reward-card__placeholder">✦</span>
    </div>
    <div class="ui-reward-card__info">
      <span class="ui-reward-card__name">
        {{ rule.targetName }}
      </span>
      <span v-if="rule.min !== undefined && rule.max !== undefined" class="ui-reward-card__qty">
        ×{{ rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}` }}
      </span>
      <span v-if="formatRewardProbability(rule)" class="ui-reward-card__prob">{{ formatRewardProbability(rule) }}</span>
      <span v-if="rule.detail" class="ui-reward-card__detail">{{ rule.detail }}</span>
    </div>
  </div>
</template>

<script setup>
import { handleImageFallback } from '../../utils/env.js'
import { formatRewardProbability } from '../../utils/acquisitionRules.js'

/**
 * UiRewardCard —— 奖励/掉落卡片（横向卡片 + 图标品质底 + 名称 + 数量 + 概率）
 * rule: { targetName, targetImg, targetQuality, min, max, actualProb, typeId }
 */
defineProps({
  rule: { type: Object, default: () => ({}) },
  clickable: { type: Boolean, default: true }
})
const emit = defineEmits(['click'])
const handleRewardImageError = event => {
  event?.currentTarget?.classList.add('is-placeholder')
  handleImageFallback(event)
}
</script>

<style scoped>
.ui-reward-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  padding: 7px 8px;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.ui-reward-card.is-clickable {
  cursor: pointer;
}
.ui-reward-card.is-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
}
.ui-reward-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 0;
}
.ui-reward-card__icon img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}
.ui-reward-card__icon img.is-placeholder {
  width: 22px;
  height: 22px;
  opacity: 0.7;
  filter: none;
}
.ui-reward-card__placeholder {
  font-size: 16px;
  color: var(--text-faint, #8a6d4d);
}
.ui-reward-card__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.ui-reward-card__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-reward-card__qty {
  font-size: 12px;
  color: var(--text-main, #3e2a14);
  margin-top: 1px;
}
.ui-reward-card__prob {
  font-size: 11px;
  color: var(--text-faint, #8a6d4d);
  margin-top: 1px;
}
.ui-reward-card__detail {
  font-size: 10px;
  color: var(--text-muted, #6b5134);
  margin-top: 1px;
  line-height: 1.25;
}
</style>
