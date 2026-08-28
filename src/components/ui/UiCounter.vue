<template>
  <div class="ui-counter">
    <slot>
      <template v-if="label">{{ label }}：</template><b>{{ current }}</b><template v-if="total != null"> / {{ total }}</template>
    </slot>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '数量' },
  current: { type: [String, Number], default: 0 },
  total: { type: [String, Number], default: null }
})
</script>
