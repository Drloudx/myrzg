<template>
  <div class="ui-segmented">
    <div
      v-for="opt in normalized"
      :key="String(opt.value)"
      class="ui-segmented-item"
      :class="{ active: modelValue === opt.value }"
      @click="$emit('update:modelValue', opt.value)"
    >{{ opt.label }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, default: () => [] }   // [{label, value}]
})
defineEmits(['update:modelValue'])

const normalized = computed(() =>
  props.options.map(o => (typeof o === 'object' ? o : { label: String(o), value: o }))
)
</script>
