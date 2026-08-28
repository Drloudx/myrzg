<template>
  <section class="ui-section">
    <h3 v-if="title" class="ui-section__title" :class="{ 'ui-section__title--collapsible': collapsible }">
      <button
        v-if="collapsible"
        type="button"
        class="ui-section__toggle"
        :aria-expanded="open"
        @click="emit('update:open', !open)"
      >
        <span class="ui-section__title-main">
          <span class="ui-section__diamond" aria-hidden="true"></span>
          {{ title }}
        </span>
        <span class="ui-section__title-end">
          <slot name="title-end" />
          <svg class="ui-section__chevron" :class="{ 'is-open': open }" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>
      <template v-else>
        <span class="ui-section__diamond" aria-hidden="true"></span>
        {{ title }}
      </template>
    </h3>
    <div v-show="!collapsible || open" class="ui-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
/**
 * UiSection —— 内容章节（模板 .content h2 风格：菱形标记 + 标题）
 */
defineProps({
  title: { type: String, default: '' },
  collapsible: { type: Boolean, default: false },
  open: { type: Boolean, default: true }
})
const emit = defineEmits(['update:open'])
</script>

<style scoped>
.ui-section {
  margin-bottom: 18px;
  min-width: 0;
}
.ui-section__title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  border-bottom: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  padding-bottom: 7px;
  letter-spacing: 1px;
}
.ui-section__diamond {
  display: inline-block;
  width: 11px;
  height: 11px;
  background: var(--accent-bright, #7a9a99);
  transform: rotate(45deg);
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.ui-section__title--collapsible {
  display: block;
  padding-bottom: 0;
}
.ui-section__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 0 7px;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  cursor: pointer;
}
.ui-section__title-main,
.ui-section__title-end {
  display: inline-flex;
  align-items: center;
}
.ui-section__title-main { gap: 10px; min-width: 0; }
.ui-section__title-end { gap: 8px; flex-shrink: 0; }
.ui-section__chevron {
  color: var(--text-faint, #8a6d4d);
  transition: transform 0.2s ease;
}
.ui-section__chevron.is-open { transform: rotate(180deg); }
.ui-section__toggle:hover .ui-section__title-main { color: var(--accent-ink, #2f4a49); }
.ui-section__body {
  min-width: 0;
}
</style>
