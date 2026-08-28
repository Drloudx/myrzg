<template>
  <UiModal
    :visible="modelValue"
    title="切换菜单模式"
    max-width="420px"
    teleport-to="body"
    @update:visible="closeModal"
  >
    <p class="mode-desc">请选择您喜欢的菜单呼出方式：</p>
    <div class="mode-options">
      <label class="mode-option paper-panel-solid" :class="{ active: currentMode === 'side' }">
        <input type="radio" value="side" v-model="currentMode" />
        <span class="mode-label">侧边导航栏 <UiTag v-if="currentMode === 'side'" tone="accent">默认</UiTag></span>
        <span class="mode-tip">在屏幕右下角点击悬浮按钮后从屏幕右侧显示导航菜单</span>
      </label>
      <label class="mode-option paper-panel-solid" :class="{ active: currentMode === 'bottom' }">
        <input type="radio" value="bottom" v-model="currentMode" />
        <span class="mode-label">底部导航栏</span>
        <span class="mode-tip">在屏幕右下角点击悬浮按钮后从屏幕底部显示导航菜单</span>
      </label>
      <label class="mode-option paper-panel-solid" :class="{ active: currentMode === 'top' }">
        <input type="radio" value="top" v-model="currentMode" />
        <span class="mode-label">顶部导航栏</span>
        <span class="mode-tip">在屏幕右下角点击悬浮按钮后从屏幕顶部显示导航菜单</span>
      </label>
    </div>
    <template #footer>
      <UiButton variant="primary" @click="applyMode">确认应用</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { UiModal, UiButton, UiTag } from './ui/index.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'side'
  }
})

const emit = defineEmits(['update:modelValue', 'update:mode'])

const currentMode = ref(props.mode)

watch(() => props.mode, (newVal) => {
  currentMode.value = newVal
})

const closeModal = () => {
  emit('update:modelValue', false)
}

const applyMode = () => {
  localStorage.setItem('menuMode', currentMode.value)
  emit('update:mode', currentMode.value)
  closeModal()
}
</script>

<style scoped>
.mode-desc {
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--text-muted, #6b5134);
  font-style: italic;
}
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mode-option {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.18s;
}
.mode-option.active {
  border-color: var(--accent-bright, #7a9a99);
  box-shadow: 0 0 0 2px rgba(122, 154, 153, 0.3);
}
.mode-option input {
  display: none;
}
.mode-label {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 4px;
  color: var(--text-main, #3e2a14);
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-tip {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
  line-height: 1.5;
}
</style>
