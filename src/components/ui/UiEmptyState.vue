<template>
  <div class="ui-empty-state" :class="`ui-empty-state--${type}`">
    <span v-if="type === 'loading'" class="ui-empty-state__spinner" aria-hidden="true"></span>
    <span v-else class="ui-empty-state__ornament" aria-hidden="true">
      {{ type === 'error' ? '✠' : '✦' }}
    </span>
    <p class="ui-empty-state__text">{{ text }}</p>
    <div v-if="$slots.action" class="ui-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup>
/**
 * UiEmptyState —— 空/加载/错误状态（网格内占满一行）
 * type: empty | loading | error
 */
defineProps({
  text: { type: String, default: '暂无数据' },
  type: { type: String, default: 'empty' }
})
</script>

<style scoped>
.ui-empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  gap: 10px;
  color: var(--text-faint, #8a6d4d);
  text-align: center;
}
.ui-empty-state__ornament {
  font-size: 26px;
  color: var(--border-color, #8f7351);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.ui-empty-state__text {
  margin: 0;
  font-size: 14px;
  font-style: italic;
  letter-spacing: 0.5px;
}
.ui-empty-state__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(85, 117, 116, 0.25);
  border-top-color: var(--accent, #557574);
  border-radius: 50%;
  animation: ui-empty-spin 0.9s linear infinite;
}
@keyframes ui-empty-spin {
  to { transform: rotate(360deg); }
}
.ui-empty-state--error .ui-empty-state__text {
  color: var(--danger, #8b0000);
}
.dark-mode .ui-empty-state--error .ui-empty-state__text {
  color: #e06a6a;
}
</style>
