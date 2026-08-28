<template>
  <header class="ui-page-header">
    <h1 class="ui-page-header__title">
      <span class="ui-page-header__rule" aria-hidden="true"></span>
      <slot>{{ title }}</slot>
      <span class="ui-page-header__rule" aria-hidden="true"></span>
    </h1>
    <p v-if="subtitle || $slots.subtitle" class="ui-page-header__subtitle">
      <slot name="subtitle">{{ subtitle }}</slot>
    </p>
  </header>
</template>

<script setup>
/**
 * UiPageHeader —— 页面主标题（羊皮纸手稿式：两侧装饰线 + 副标题）
 */
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' }
})
</script>

<style scoped>
.ui-page-header {
  padding: 14px 16px 4px;
  flex-shrink: 0;
}
.ui-page-header__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  letter-spacing: 2px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}
.dark-mode .ui-page-header__title {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.ui-page-header__rule {
  flex: 0 1 70px;
  height: 0;
  border-top: 2px solid var(--border-color, #8f7351);
  border-bottom: 1px solid rgba(223, 206, 179, 0.6);
}
.ui-page-header__subtitle {
  margin: 6px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  font-style: italic;
}
</style>
