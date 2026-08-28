<template>
  <div
    class="ui-list-row"
    :id="id"
    :class="{ 'is-clickable': clickable }"
    @click="clickable && emit('click')"
  >
    <div class="ui-list-row__main">
      <slot />
    </div>
    <div v-if="$slots.right" class="ui-list-row__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup>
/**
 * UiListRow —— 通栏列表行（奖励列表/兑换列表等）
 * id: 供页面内锚点跳转（如 #tier-xxx）
 */
defineProps({
  id: { type: String, default: '' },
  clickable: { type: Boolean, default: false }
})
const emit = defineEmits(['click'])
</script>

<style scoped>
.ui-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background-color: rgba(223, 206, 179, 0.9);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-bottom-color: var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  padding: 10px 14px;
  color: var(--text-main, #3e2a14);
  font-size: 13px;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}
.dark-mode .ui-list-row {
  background-color: rgba(63, 48, 32, 0.82);
}
.ui-list-row.is-clickable {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.ui-list-row.is-clickable:hover {
  transform: translateY(-1px);
  border-color: var(--accent-bright, #7a9a99);
  box-shadow: 0 3px 9px rgba(0, 0, 0, 0.25);
}
.ui-list-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ui-list-row__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
