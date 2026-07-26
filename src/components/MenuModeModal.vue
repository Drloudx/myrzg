<template>
  <BaseModal
    :visible="modelValue"
    title="切换菜单模式"
    @close="closeModal"
  >
    <p class="mode-desc">请选择您喜欢的菜单呼出方式：</p>
    <div class="mode-options">
      <label class="mode-option" :class="{ active: currentMode === 'side' }">
        <input type="radio" value="side" v-model="currentMode" />
        <span class="mode-label">底部导航栏 (默认)</span>
        <span class="mode-tip">在屏幕右下角点击悬浮按钮呼出侧边菜单</span>
      </label>
      <label class="mode-option" :class="{ active: currentMode === 'bottom' }">
        <input type="radio" value="bottom" v-model="currentMode" />
        <span class="mode-label">底部导航栏</span>
        <span class="mode-tip">在屏幕底部显示固定导航条</span>
      </label>
      <label class="mode-option" :class="{ active: currentMode === 'top' }">
        <input type="radio" value="top" v-model="currentMode" />
        <span class="mode-label">顶部导航栏</span>
        <span class="mode-tip">在屏幕顶部显示滑动导航条</span>
      </label>
    </div>
    <template #footer>
      <button class="modal-btn-confirm" @click="applyMode">确认应用</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'

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
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.custom-modal-content {
  background: var(--bg-color, #ffffff);
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dark-mode .custom-modal-content {
  background: #1e1e1e;
  color: #fff;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #eee);
}
.dark-mode .modal-header {
  border-bottom-color: #333;
}
.modal-title {
  margin: 0;
  font-size: 18px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}
.modal-body {
  padding: 16px;
}
.mode-desc {
  margin-bottom: 16px;
  font-size: 14px;
  color: #666;
}
.dark-mode .mode-desc {
  color: #aaa;
}
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mode-option {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.dark-mode .mode-option {
  border-color: #444;
}
.mode-option.active {
  border-color: #2196f3;
  background-color: rgba(33, 150, 243, 0.05);
}
.mode-option input {
  display: none;
}
.mode-label {
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 4px;
}
.mode-tip {
  font-size: 12px;
  color: #999;
}
.dark-mode .mode-tip {
  color: #777;
}
.modal-footer {
  padding: 16px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
}
.dark-mode .modal-footer {
  border-top-color: #333;
}
.confirm-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}
</style>
