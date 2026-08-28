<template>
  <div class="ui-filter-options">
    <button
      v-if="showAll"
      type="button"
      class="ui-chip"
      :class="{ active: modelValue === null || modelValue === undefined }"
      @click="$emit('update:modelValue', null)"
    >全部</button>
    <button
      v-for="opt in normalized"
      :key="String(opt.value)"
      type="button"
      class="ui-chip"
      :class="[opt.cls, { active: modelValue === opt.value }]"
      @click="$emit('update:modelValue', opt.value)"
    >{{ opt.label }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, default: () => [] },   // [{label, value, cls?}] 或字符串数组
  showAll: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])

const normalized = computed(() =>
  props.options.map(o => (typeof o === 'object' ? o : { label: String(o), value: o }))
)
</script>
