<template>
  <div class="filter-panel paper-panel" :class="{ 'is-filter-collapsed': !expanded }">
    <slot name="search" />
    <div :id="contentId" v-show="expanded" class="ui-filter-content">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup>
import { provide, readonly, ref } from 'vue'
import { createFilterPanelId, filterPanelKey } from './filterPanelContext.js'

const expanded = ref(true)
const contentId = createFilterPanelId()
provide(filterPanelKey, {
  expanded: readonly(expanded),
  contentId,
  toggle: () => { expanded.value = !expanded.value }
})
</script>

<style scoped>
.ui-filter-content {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: inherit;
  min-width: 0;
}
</style>
