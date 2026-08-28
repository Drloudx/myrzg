<template>
  <div class="ui-info-row">
    <span class="ui-info-row__label"><slot name="label">{{ label }}</slot></span>
    <span class="ui-info-row__value"><slot>{{ value }}</slot></span>
  </div>
</template>

<script setup>
/**
 * UiInfoRow —— 键值信息行（模板 .info-row：左标签右值 + 虚线下划线）
 */
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' }
})
</script>

<style scoped>
.ui-info-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 2px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  font-size: 14px;
  line-height: 1.5;
  min-width: 0;
}
.ui-info-row:last-child {
  border-bottom: none;
}
.ui-info-row__label {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  white-space: nowrap;
}
.ui-info-row__value {
  flex: 1;
  text-align: right;
  color: var(--text-main, #3e2a14);
  min-width: 0;
  word-break: break-all;
}
</style>
