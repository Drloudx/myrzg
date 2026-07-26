<template>
  <BaseModal
    :visible="modelValue"
    title="版本检查"
    @close="closeModal"
  >
    <div class="modal-body">
      <!-- 顶部信息：已改为居中对齐 -->
      <div class="version-info">
        <img src="/ui/logo.png" alt="Logo" class="version-logo" />
        <h2 class="app-name">深渊之歌助手</h2>
        <p class="current-version">当前版本: {{ currentVersion }}</p>
      </div>

      <!-- 状态盒子：居中对齐 -->
      <div class="status-box">
        <div v-if="isChecking" class="checking-state">
          正在检查更新...
        </div>
        <div v-else-if="updateInfo" class="update-available">
          <div class="update-icon">!</div>
          <div class="update-text">
            <span class="update-title">发现新版本: {{ updateInfo.version }}</span>
            <span class="update-desc" v-if="updateInfo._needsApkUpdate">
              本次包含底层的更新，建议立即更新
            </span>
            <span class="update-desc" v-else>
              {{ updateInfo.body || '有新的功能更新或问题修复。' }}
            </span>
          </div>
        </div>
        <div v-else class="up-to-date">
          <div class="check-icon">✓</div>
          <span>当前已是最新版本</span>
        </div>
      </div>
    </div>

    <!-- 底部按钮：居中对齐 -->
    <template #footer>
      <div class="modal-footer-wrapper">
        <button
          v-if="updateInfo"
          class="confirm-btn"
          @click="handleUpdate"
        >
          立即更新
        </button>
        <button
          v-else
          class="confirm-btn"
          @click="performCheck"
          :disabled="isChecking"
        >
          {{ isChecking ? '检查中...' : '重新检查' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { checkHotUpdate, applyHotUpdate } from '../utils/hotupdate'
import { App as CapApp } from '@capacitor/app'
import { isNative } from '../utils/env'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'request-update'])

const currentVersion = ref('1.0.0.0')
const isChecking = ref(false)
const updateInfo = ref(null)

const closeModal = () => {
  emit('update:modelValue', false)
}

const getLocalVersion = async () => {
  let nativeVer = '1.0.0'
  if (isNative) {
    try {
      const info = await CapApp.getInfo()
      nativeVer = info.version || '1.0.0'
    } catch (e) {
      console.warn(e)
    }
  }
  const webVer = localStorage.getItem('local_web_version')

  // 如果 webVer 存在，且是 4 位的（例如 1.0.0.1），则直接显示 webVer。
  // 如果没有 webVer，就用 nativeVer + .0
  if (webVer && webVer.split('.').length === 4) {
    currentVersion.value = webVer
  } else if (webVer) {
    currentVersion.value = webVer
  } else {
    currentVersion.value = `${nativeVer}.0`
  }
}

const performCheck = async () => {
  isChecking.value = true
  updateInfo.value = null

  await getLocalVersion()

  try {
    const info = await checkHotUpdate()
    if (info) {
      updateInfo.value = info
    }
  } catch (err) {
    console.error('Check update failed:', err)
  } finally {
    isChecking.value = false
  }
}

const handleUpdate = () => {
  if (updateInfo.value) {
    // 触发 App.vue 中的全局更新流程
    emit('request-update', updateInfo.value)
    closeModal()
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    performCheck()
  }
})

onMounted(() => {
  if (props.modelValue) {
    performCheck()
  }
})
</script>

<style scoped>
/* 覆盖容器或基础设定 */
.modal-body {
  padding: 16px 24px;
}

/* 顶部信息区域：居中对齐 */
.version-info {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center; /* 改为 center 居中对齐 */
  text-align: center;  /* 改为 center 居中文本 */
}
.version-logo {
  width: 70%;
  height: 70%;
  border-radius: 12px;
  margin-bottom: 12px;
  object-fit: cover;
}
.app-name {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #333;
  font-weight: bold;
}
.dark-mode .app-name {
  color: #fff;
}
.current-version {
  margin: 0;
  font-size: 14px;
  color: #999;
}

/* 状态盒子区域：容器内居中 */
.status-box {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dark-mode .status-box {
  background: rgba(255, 255, 255, 0.05);
}
.checking-state {
  color: #666;
}
.dark-mode .checking-state {
  color: #aaa;
}

/* 已是最新版本区域：内容居中 */
.up-to-date {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 15px;
}
.dark-mode .up-to-date {
  color: #eee;
}
.check-icon {
  width: 22px;
  height: 22px;
  background: #4caf50;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  font-size: 14px;
  font-weight: bold;
}

/* 更新提示区域 */
.update-available {
  display: flex;
  align-items: flex-start;
  text-align: left;
  width: 100%;
}
.update-icon {
  width: 24px;
  height: 24px;
  background: #ff9800;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
  font-weight: bold;
}
.update-text {
  display: flex;
  flex-direction: column;
}
.update-title {
  color: #ff9800;
  font-weight: bold;
  margin-bottom: 4px;
}
.update-desc {
  font-size: 12px;
  color: #ef4444;
}

/* 底部按钮区域：居中 */
.modal-footer-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
.confirm-btn {
  background: #4285f4;
  color: white;
  border: none;
  padding: 10px 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  min-width: 120px;
  transition: opacity 0.2s;
}
.confirm-btn:hover {
  opacity: 0.9;
}
.confirm-btn:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}
</style>