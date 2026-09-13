<template>
  <button
    type="button"
    class="ui-collection-toggle"
    :class="{ 'is-active': active }"
    :title="active ? '已收集 (点击取消)' : '未收集 (点击标记)'"
    :aria-label="active ? '取消已收集标记' : '标记为已收集'"
    :aria-pressed="active"
    @click.stop="emit('toggle')"
  >
    <span class="ui-collection-toggle__track">
      <span class="ui-collection-toggle__icon ui-collection-toggle__icon--checked">✓</span>
      <span class="ui-collection-toggle__handle"></span>
      <span class="ui-collection-toggle__icon ui-collection-toggle__icon--empty">✕</span>
    </span>
  </button>
</template>

<script setup>
defineProps({
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])
</script>

<style scoped>
.ui-collection-toggle {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.ui-collection-toggle__track {
  position: relative;
  width: 54px;
  height: 28px;
  border-radius: 14px;
  background: rgba(110, 95, 80, 0.38);
  border: 1.5px solid var(--border-soft, #8f7351);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  box-sizing: border-box;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}

.ui-collection-toggle.is-active .ui-collection-toggle__track {
  background: #745234;
  border-color: #543922;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

:global(.dark-mode) .ui-collection-toggle.is-active .ui-collection-toggle__track {
  background: #876241;
  border-color: #4a3522;
}

.ui-collection-toggle__handle {
  position: absolute;
  top: 2.5px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.ui-collection-toggle.is-active .ui-collection-toggle__handle {
  transform: translateX(25px);
}

.ui-collection-toggle__icon {
  font-size: 11px;
  font-weight: 800;
  user-select: none;
  line-height: 1;
  transition: opacity 0.2s ease;
}

.ui-collection-toggle__icon--checked {
  color: #ffffff;
  opacity: 0;
}

.ui-collection-toggle__icon--empty {
  color: rgba(255, 255, 255, 0.85);
  opacity: 1;
}

.ui-collection-toggle.is-active .ui-collection-toggle__icon--checked {
  opacity: 1;
}

.ui-collection-toggle.is-active .ui-collection-toggle__icon--empty {
  opacity: 0;
}
</style>
