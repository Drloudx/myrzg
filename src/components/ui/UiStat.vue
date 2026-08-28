<template>
  <div class="ui-stat">
    <span v-if="label" class="ui-stat-label">{{ label }}</span>
    <span class="ui-stat-value"><slot>{{ value }}</slot></span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' }
})
</script>
