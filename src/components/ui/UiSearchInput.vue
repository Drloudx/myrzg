<template>
  <div class="ui-search" :class="{ 'is-focused': focused }">
    <svg class="ui-search__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
    </svg>
    <input
      type="text"
      class="ui-search__input"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      @input="onInput"
      @focus="onFocus"
      @blur="focused = false"
    />
    <button v-if="clearable && modelValue" class="ui-search__clear" @click="clear" title="清空" aria-label="清空">
      ✕
    </button>
  </div>
</template>

<script setup>
/**
 * UiSearchInput —— 羊皮纸搜索框（图标 + 输入 + 一键清空）
 */
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索...' },
  clearable: { type: Boolean, default: true },
  autocomplete: { type: String, default: 'off' }
})
const emit = defineEmits(['update:modelValue', 'focus', 'input'])

const focused = ref(false)

const onInput = (e) => {
  emit('update:modelValue', e.target.value)
  emit('input', e.target.value)
}
const onFocus = (e) => {
  focused.value = true
  emit('focus', e)
}
const clear = () => emit('update:modelValue', '')
</script>

<style scoped>
.ui-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}
.ui-search__icon {
  position: absolute;
  left: 12px;
  color: var(--border-color, #8f7351);
  pointer-events: none;
  opacity: 0.9;
}
.ui-search__input {
  width: 100%;
  height: 38px;
  padding: 6px 34px 6px 38px;
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  font-size: 14px;
  background: var(--input-bg, #f3ead5);
  color: var(--input-text, #3e2a14);
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: inset 0 2px 4px rgba(43, 31, 21, 0.12);
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
}
.ui-search__input::placeholder {
  color: var(--text-faint, #8a6d4d);
  font-style: italic;
}
.ui-search__input:focus {
  outline: none;
  border-color: var(--accent-bright, #7a9a99);
  background: #f8f1df;
  box-shadow: inset 0 2px 4px rgba(43, 31, 21, 0.12), 0 0 0 2px rgba(122, 154, 153, 0.25);
}
.dark-mode .ui-search__input:focus {
  background: #473a28;
}
.ui-search__clear {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--text-faint, #8a6d4d);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 3px;
  transition: all 0.15s ease;
}
.ui-search__clear:hover {
  color: var(--text-main, #3e2a14);
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}
</style>
