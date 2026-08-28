<template>
  <div class="ui-filter-row" :class="{ 'has-right': $slots.right }">
    <span v-if="label" class="ui-filter-row__label">{{ label }}</span>
    <div class="ui-filter-row__options">
      <slot />
    </div>
    <div v-if="$slots.right" class="ui-filter-row__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup>
/**
 * UiFilterRow —— 筛选行（标签 + 选项容器 + 右侧附加区域）
 * 选项请放入 UiFilterPill，右侧可放置计数/操作按钮
 */
defineProps({
  label: { type: String, default: '' }
})
</script>

<style scoped>
.ui-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
  width: 100%;
}
.ui-filter-row__label {
  color: var(--text-muted, #6b5134);
  font-weight: 700;
  white-space: nowrap;
  width: 60px;
  min-width: 60px;
  flex-shrink: 0;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  letter-spacing: 0.5px;
  text-align: left;
}
.ui-filter-row__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.ui-filter-row__right {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  font-weight: 600;
  white-space: nowrap;
}

/* 窄屏下右侧计数/操作独占一行，避免挤压左侧标签和筛选项。 */
@media (max-width: 640px) {
  .ui-filter-row.has-right {
    align-items: flex-start;
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .ui-filter-row.has-right .ui-filter-row__options {
    flex: 1 1 calc(100% - 68px);
  }

  .ui-filter-row.has-right .ui-filter-row__right {
    flex: 0 0 calc(100% - 8px);
    justify-content: flex-end;
    margin-left: 0;
    padding-top: 1px;
    box-sizing: border-box;
  }
}
</style>
