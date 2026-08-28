<template>
  <div class="ui-segmented" role="tablist">
    <button
      v-for="opt in options"
      :key="getOptionValue(opt)"
      type="button"
      role="tab"
      class="ui-segmented__item"
      :class="{ 'is-active': modelValue === getOptionValue(opt) }"
      @click="emit('update:modelValue', getOptionValue(opt))"
    >
      {{ opt.label ?? opt.name ?? opt.title ?? getOptionValue(opt) }}
    </button>
  </div>
</template>

<script setup>
/**
 * UiSegmentedTabs —— 木刻分段切换（图鉴大分类/状态页签）
 * options: [{ value, label }]
 */
defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const getOptionValue = (opt) => {
  if (typeof opt === 'string' || typeof opt === 'number') return opt
  if (!opt) return ''
  return opt.value !== undefined ? opt.value : (opt.key !== undefined ? opt.key : opt.id)
}
</script>

<style scoped>
.ui-segmented {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  background: var(--wood, #2b1f15);
  border: 1px solid #17100a;
  border-radius: 6px;
  box-sizing: border-box;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.45);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.ui-segmented::-webkit-scrollbar { display: none; }
.ui-segmented__item {
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: rgba(223, 206, 179, 0.65);
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  white-space: nowrap;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}
.ui-segmented__item:hover {
  color: var(--paper, #dfceb3);
}
.ui-segmented__item.is-active {
  background: linear-gradient(180deg, #f0e3c6, #dcc8a4);
  color: var(--text-main, #3e2a14);
  font-weight: 700;
  text-shadow: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.dark-mode .ui-segmented__item.is-active {
  background: linear-gradient(180deg, #5a4a33, #473a28);
  color: #f2e6cc;
}
</style>
