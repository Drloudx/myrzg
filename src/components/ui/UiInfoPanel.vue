<template>
  <div class="ui-info-panel paper-panel corner-nails">
    <div v-if="title || $slots.title" class="ui-info-panel__title-bar">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="$slots.media" class="ui-info-panel__media">
      <slot name="media" />
    </div>
    <div class="ui-info-panel__body">
      <slot />
    </div>
  </div>
</template>

<script setup>
/**
 * UiInfoPanel —— 信息面板（模板 .infobox 形态：深色标题条 + 键值行）
 * 内部放 UiInfoRow；media 插槽放图片/图标区
 */
defineProps({
  title: { type: String, default: '' }
})
</script>

<style scoped>
.ui-info-panel {
  padding: 0;
  overflow: hidden;
  margin-bottom: 16px;
}
.ui-info-panel__title-bar {
  background: linear-gradient(180deg, var(--wood-soft, #463424), var(--wood, #2b1f15));
  color: var(--paper, #dfceb3);
  text-align: center;
  padding: 9px 14px;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1.5px;
  border-bottom: 2px solid var(--border-color, #8f7351);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.ui-info-panel__media {
  border-bottom: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  background: rgba(43, 31, 21, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
.ui-info-panel__body {
  padding: 12px 16px;
}
</style>
