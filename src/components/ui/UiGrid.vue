<template>
  <div class="ui-grid" :class="{ wide, compact }" :style="cols ? { gridTemplateColumns: `repeat(auto-fill, minmax(${cols}px, 1fr))` } : null">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  cols: { type: [Number, String], default: 0 },
  wide: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})
</script>
