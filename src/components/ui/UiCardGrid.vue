<template>
  <div class="ui-card-grid-scroll" :id="id">
    <div class="ui-card-grid" :class="{ 'is-wide': wide, 'is-small': small }">
      <slot />
    </div>
  </div>
</template>

<script setup>
/**
 * UiCardGrid —— 数据网格滚动容器（替代旧 .data-grid-scroll / .items-grid）
 * id 传给滚动容器，供 UiBackToTop 定位
 * wide: 宽卡片（220px 起）；small: 小图标卡（88px 起）
 */
defineProps({
  id: { type: String, default: '' },
  wide: { type: Boolean, default: false },
  small: { type: Boolean, default: false }
})
</script>

<style scoped>
.ui-card-grid-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0 calc(14px + var(--safe-bottom, 0px));
  box-sizing: border-box;
  min-height: 0;
}
.ui-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  gap: 14px;
}
.ui-card-grid.is-wide {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.ui-card-grid.is-small {
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 10px;
}
@media (min-width: 768px) {
  .ui-card-grid.is-small {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
}
</style>
