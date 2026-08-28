<template>
  <button
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'is-block': block, 'is-disabled': disabled }]"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
/**
 * UiButton —— 羊皮纸主题通用按钮
 * variant: primary(原木) | secondary(羊皮纸描边) | ghost(无底) | danger(深红) | link(文字链)
 * size: sm | md | lg
 */
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger | link
  size: { type: String, default: 'md' },         // sm | md | lg
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' }
})
const emit = defineEmits(['click'])
</script>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: all 0.18s ease;
  user-select: none;
  white-space: nowrap;
  box-sizing: border-box;
}
.ui-btn:active:not(.is-disabled) {
  transform: translateY(1px);
}
.ui-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-btn.is-block {
  width: 100%;
}

/* 尺寸 */
.ui-btn--sm { padding: 5px 12px; font-size: 12px; }
.ui-btn--md { padding: 9px 22px; font-size: 14px; }
.ui-btn--lg { padding: 12px 30px; font-size: 16px; }

/* 主按钮：深色原木 */
.ui-btn--primary {
  background: var(--wood, #2b1f15);
  color: var(--paper, #dfceb3);
  border: 1px solid #17100a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(223, 206, 179, 0.25);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.6);
}
.ui-btn--primary:hover:not(.is-disabled) {
  background: var(--wood-soft, #463424);
  border-color: var(--accent-bright, #7a9a99);
}

/* 次按钮：羊皮纸描边 */
.ui-btn--secondary {
  background: var(--paper-soft, #e9dcc3);
  color: var(--text-main, #3e2a14);
  border: 1px solid var(--border-color, #8f7351);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
}
.ui-btn--secondary:hover:not(.is-disabled) {
  border-color: var(--accent-bright, #7a9a99);
  color: var(--accent-ink, #557574);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
}

/* 幽灵按钮 */
.ui-btn--ghost {
  background: transparent;
  color: var(--text-muted, #6b5134);
  border: 1px solid transparent;
}
.ui-btn--ghost:hover:not(.is-disabled) {
  color: var(--text-main, #3e2a14);
  border-color: var(--border-faint, rgba(143, 115, 81, 0.25));
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}

/* 危险按钮 */
.ui-btn--danger {
  background: var(--danger, #8b0000);
  color: #fdf6e3;
  border: 1px solid #5c0000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}
.ui-btn--danger:hover:not(.is-disabled) {
  background: #a51212;
}

/* 文字链 */
.ui-btn--link {
  background: transparent;
  border: none;
  color: var(--accent-ink, #557574);
  padding: 4px 8px;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.ui-btn--link:hover:not(.is-disabled) {
  color: var(--accent-bright, #7a9a99);
}
</style>
