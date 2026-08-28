<template>
  <UiModal
    :visible="modelValue"
    title="公告与反馈"
    max-width="440px"
    teleport-to="body"
    @update:visible="closeModal"
  >
    <UiEmptyState v-if="isLoading" type="loading" text="正在翻阅公告卷轴..." />
    <UiEmptyState v-else-if="error" type="error" :text="'加载失败: ' + error" />
    <div v-else class="notice-list">
      <div v-for="(notice, index) in notices" :key="index" class="notice-item paper-panel-solid">
        <h4 class="notice-item-title">
          <UiTag v-if="notice.isPinned" tone="danger">置顶</UiTag>
          {{ notice.title }}
        </h4>
        <span class="notice-item-date">{{ notice.date }}</span>
        <p class="notice-item-content">{{ notice.content }}</p>
      </div>
    </div>
    <template #footer>
      <UiButton variant="primary" @click="closeModal">确认</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { UiModal, UiButton, UiTag, UiEmptyState } from './ui/index.js'
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
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.notice-item {
  padding: 12px 14px;
}
.notice-item-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: var(--text-main, #3e2a14);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.notice-item-date {
  font-size: 12px;
  color: var(--text-faint, #8a6d4d);
  display: block;
  margin-bottom: 8px;
  font-style: italic;
}
.notice-item-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--text-main, #3e2a14);
}
</style>
