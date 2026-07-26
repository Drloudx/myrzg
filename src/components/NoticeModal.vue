<template>
  <BaseModal
    :visible="modelValue"
    title="公告与反馈"
    @close="closeModal"
  >
    <div v-if="isLoading" class="loading-state">
      加载中...
    </div>
    <div v-else-if="error" class="error-state">
      加载失败: {{ error }}
    </div>
    <div v-else class="notice-list">
      <div v-for="(notice, index) in notices" :key="index" class="notice-item" :class="{ 'pinned-notice': notice.isPinned }">
        <h4 class="notice-item-title">
          <span v-if="notice.isPinned" class="pinned-tag">置顶</span>
          {{ notice.title }}
        </h4>
        <span class="notice-item-date">{{ notice.date }}</span>
        <p class="notice-item-content">{{ notice.content }}</p>
      </div>
    </div>
    <template #footer>
      <button class="modal-btn-confirm" @click="closeModal">确认</button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { fetchWithFallback } from '../utils/request.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const notices = ref([])
const isLoading = ref(true)
const error = ref(null)

const closeModal = () => {
  emit('update:modelValue', false)
}

const loadNotices = async () => {
  isLoading.value = true
  error.value = null
  try {
    const data = await fetchWithFallback('data/notice.json')
    notices.value = data.notices || []
    
    // Auto popup logic
    if (!props.modelValue) {
      const latestNormalNotice = notices.value.find(n => !n.isPinned)
      if (latestNormalNotice) {
        const savedDate = localStorage.getItem('lastNoticeDate')
        if (savedDate !== latestNormalNotice.date) {
          emit('update:modelValue', true)
          localStorage.setItem('lastNoticeDate', latestNormalNotice.date)
        }
      }
    }
  } catch (err) {
    error.value = err.message
    console.error('Failed to load notices:', err)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal && notices.value.length === 0) {
    loadNotices()
  }
})

onMounted(() => {
  loadNotices()
})
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
  max-height: 80vh;
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
  overflow-y: auto;
}
.loading-state, .error-state {
  text-align: center;
  padding: 20px;
  color: #666;
}
.dark-mode .loading-state, .dark-mode .error-state {
  color: #aaa;
}
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.notice-item {
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border: 1px solid var(--border-color, #eee);
}
.dark-mode .notice-item {
  background: rgba(255, 255, 255, 0.05);
  border-color: #444;
}
.notice-item-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #2196f3;
}
.notice-item-date {
  font-size: 12px;
  color: #999;
  display: block;
  margin-bottom: 8px;
}
.notice-item-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.pinned-tag {
  background-color: #ef4444;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
