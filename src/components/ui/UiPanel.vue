<template>
  <section class="ui-panel" :class="[{ 'ui-panel--flat': flat, 'ui-panel--unpadded': !padded }, $attrs.class]">
    <header v-if="title || $slots.actions" class="ui-panel__header">
      <h2 v-if="title" class="panel-title ui-panel__title">{{ title }}</h2>
      <div class="ui-panel__actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineProps({
  title: { type: String, default: '' },
  padded: { type: Boolean, default: true },
  flat: { type: Boolean, default: false }
})
</script>

<style scoped>
.ui-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ui-panel__title {
  margin: 0 0 14px;
  text-align: left;
  font-size: 18px;
}

.ui-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ui-panel--unpadded { padding: 0; }
.ui-panel--unpadded > :not(.ui-panel__header) { padding: 20px; }
.ui-panel--flat { box-shadow: none; }
</style>
