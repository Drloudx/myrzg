<template>
  <div class="ui-empty">
    <slot>{{ text }}</slot>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '暂无数据' }
})
</script>
