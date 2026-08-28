<template>
  <div class="ui-card" :class="{ 'ui-card--flat': flat, 'ui-card--active': active }" @click="handleClick">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false },
  flat: { type: Boolean, default: false }
})
const emit = defineEmits(['click'])
const handleClick = (e) => emit('click', e)
</script>

<style scoped>
.ui-card--flat { cursor: default; }
.ui-card--active { border-color: var(--accent-water); box-shadow: 0 0 0 2px rgba(122, 154, 153, 0.35); }
</style>
