<template>
  <div class="ui-loading">
    <div class="ui-spinner"></div>
    <span><slot>{{ text }}</slot></span>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '数据加载中...' }
})
</script>
