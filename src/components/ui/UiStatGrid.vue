<template>
  <div class="ui-stat-grid" :class="{ 'is-single': !doubleCol }">
    <div v-for="(item, idx) in items" :key="idx" class="ui-stat-grid__cell">
      <span class="ui-stat-grid__name">{{ item.label }}</span>
      <span class="ui-stat-grid__val" :class="item.tone ? `quality-text-${item.tone}` : ''">{{ item.value }}</span>
    </div>
  </div>
</template>

<script setup>
/**
 * UiStatGrid —— 属性数值网格（装备属性/宠物属性等）
 * items: [{ label, value, tone? }]  tone 为 1~5 品质色
 * doubleCol: 双列（默认 true）
 */
defineProps({
  items: { type: Array, default: () => [] },
  doubleCol: { type: Boolean, default: true }
})
</script>

<style scoped>
.ui-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.ui-stat-grid.is-single {
  grid-template-columns: 1fr;
}
.ui-stat-grid__cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  background: rgba(43, 31, 21, 0.08);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 3px;
  padding: 7px 11px;
  font-size: 13px;
  min-width: 0;
  box-shadow: inset 0 1px 2px rgba(43, 31, 21, 0.1);
}
.dark-mode .ui-stat-grid__cell {
  background: rgba(0, 0, 0, 0.22);
}
.ui-stat-grid__name {
  color: var(--text-muted, #6b5134);
  font-weight: 600;
  white-space: nowrap;
}
.ui-stat-grid__val {
  color: var(--text-main, #3e2a14);
  font-weight: 700;
  text-align: right;
  word-break: break-all;
}
</style>
