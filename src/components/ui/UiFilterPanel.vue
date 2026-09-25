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
import { provide, readonly, ref, toRef } from 'vue'
import { createFilterPanelId, filterPanelKey } from './filterPanelContext.js'

/**
 * `collapsible=false` 用于「面板里只有搜索框和页签、没有可折叠的筛选项」的页面：
 * 此时隐藏搜索框右侧的收起/展开按钮，内容恒为展开，避免出现收起不了任何东西的按钮。
 */
const props = defineProps({
  collapsible: { type: Boolean, default: true }
})

const expanded = ref(true)
const contentId = createFilterPanelId()
provide(filterPanelKey, {
  expanded: readonly(expanded),
  collapsible: toRef(props, 'collapsible'),
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
