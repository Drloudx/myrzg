<template>
  <button
    type="button"
    class="ui-filter-pill"
    :class="[
      { 'is-active': active },
      quality ? `quality-text-${quality}` : '',
      { 'is-disabled': disabled }
    ]"
    :disabled="disabled"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>

<script setup>
/**
 * UiFilterPill —— 筛选胶囊按钮
 * quality: 1~5 时文字采用对应品质色，激活底色也随之变化
 */
defineProps({
  active: { type: Boolean, default: false },
  quality: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['click'])
</script>

<style scoped>
.ui-filter-pill {
  background: rgba(233, 220, 195, 0.6);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted, #6b5134);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.ui-filter-pill:hover:not(.is-disabled) {
  color: var(--text-main, #3e2a14);
  border-color: var(--border-soft, rgba(143, 115, 81, 0.45));
}
.ui-filter-pill.is-active {
  background: var(--wood, #2b1f15);
  color: var(--paper, #dfceb3);
  border-color: #17100a;
  font-weight: 700;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}
.dark-mode .ui-filter-pill {
  background: rgba(63, 48, 32, 0.6);
}
.dark-mode .ui-filter-pill.is-active {
  background: var(--wood-soft, #3a2c1d);
  color: var(--paper, #eaddc2);
}

/* 品质色激活态：对应品质色底 + 羊皮纸文字 */
.ui-filter-pill.quality-text-1.is-active { background: var(--q1); }
.ui-filter-pill.quality-text-2.is-active { background: var(--q2); }
.ui-filter-pill.quality-text-3.is-active { background: var(--q3); }
.ui-filter-pill.quality-text-4.is-active { background: var(--q4); }
.ui-filter-pill.quality-text-5.is-active { background: var(--q5); }
.ui-filter-pill.quality-text-1.is-active,
.ui-filter-pill.quality-text-2.is-active,
.ui-filter-pill.quality-text-3.is-active,
.ui-filter-pill.quality-text-4.is-active,
.ui-filter-pill.quality-text-5.is-active {
  color: #2b1f15 !important;
  border-color: rgba(0, 0, 0, 0.35);
}

.ui-filter-pill.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
