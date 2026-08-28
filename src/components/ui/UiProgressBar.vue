<template>
  <div class="ui-progress">
    <div class="ui-progress__track">
      <div class="ui-progress__fill" :style="{ width: pct + '%' }"></div>
    </div>
    <span v-if="label" class="ui-progress__label">{{ label }}</span>
  </div>
</template>

<script setup>
/**
 * UiProgressBar —— 木轨进度条（更新下载等）
 */
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 }, // 0~100
  label: { type: String, default: '' }
})

const pct = computed(() => Math.min(100, Math.max(0, props.value)))
</script>

<style scoped>
.ui-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.ui-progress__track {
  width: 100%;
  height: 10px;
  background: var(--wood, #2b1f15);
  border: 1px solid #17100a;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.45);
}
.ui-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent, #557574), var(--accent-bright, #7a9a99));
  border-radius: 4px;
  transition: width 0.3s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ui-progress__label {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
  text-align: right;
}
</style>
