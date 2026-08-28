<template>
  <div class="ui-error">
    <slot>{{ text }}</slot>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '加载失败' }
})
</script>
