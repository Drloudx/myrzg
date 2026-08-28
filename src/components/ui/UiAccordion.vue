<template>
  <div class="ui-accordion">
    <button type="button" class="ui-accordion__head" @click="toggle">
      <span class="ui-accordion__title"><slot name="title">{{ title }}</slot></span>
      <svg
        class="ui-accordion__chevron"
        :class="{ 'is-open': isOpen }"
        viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    <div class="ui-accordion__body" :class="{ 'is-open': isOpen }">
      <div class="ui-accordion__inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * UiAccordion —— 手风琴折叠块（获取途径分组等）
 */
import { ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(props.modelValue)
watch(() => props.modelValue, (v) => { isOpen.value = v })

const toggle = () => {
  isOpen.value = !isOpen.value
  emit('update:modelValue', isOpen.value)
}
</script>

<style scoped>
.ui-accordion {
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  background: rgba(233, 220, 195, 0.6);
  overflow: hidden;
}
.dark-mode .ui-accordion {
  background: rgba(63, 48, 32, 0.5);
}
.ui-accordion__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}
.ui-accordion__head:hover {
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}
.ui-accordion__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  text-align: left;
}
.ui-accordion__chevron {
  color: var(--text-faint, #8a6d4d);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.ui-accordion__chevron.is-open {
  transform: rotate(180deg);
}
.ui-accordion__body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
  opacity: 0;
}
.ui-accordion__body.is-open {
  max-height: 30000px;
  opacity: 1;
}
.ui-accordion__inner {
  padding: 4px 12px 12px;
  border-top: 1px dashed var(--border-faint, rgba(143, 115, 81, 0.25));
}
</style>
