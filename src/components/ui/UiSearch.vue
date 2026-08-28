<template>
  <div class="search-bar ui-search" :class="containerClass">
    <img src="/ui/search.svg" class="search-icon" alt="搜索" />
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      class="search-input"
      @input="$emit('update:modelValue', $event.target.value)"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
    />
    <button v-if="clearable && modelValue" type="button" class="clear-btn" @click="handleClear">✕</button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索...' },
  clearable: { type: Boolean, default: true },
  containerClass: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'focus', 'blur'])
const handleClear = () => {
  emit('update:modelValue', '')
  emit('focus')
}
</script>
