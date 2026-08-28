<template>
  <UiModal
    :visible="modelValue"
    title="版本检查"
    max-width="420px"
    teleport-to="body"
    @update:visible="closeModal"
  >
    <div class="version-info">
      <img src="/ui/logo.png" alt="Logo" class="version-logo" />
      <h2 class="app-name">深渊之歌助手</h2>
      <p class="current-version">当前版本: {{ currentVersion }}</p>
    </div>

    <!-- 状态盒子 -->
    <div class="status-box paper-panel-solid">
      <UiEmptyState v-if="isChecking" type="loading" text="正在检查更新..." />
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

    <template #footer>
      <UiButton
        v-if="updateInfo"
        variant="primary"
        @click="handleUpdate"
      >
        立即更新
      </UiButton>
      <UiButton
        v-else
        variant="secondary"
        :disabled="isChecking"
        @click="performCheck"
      >
        {{ isChecking ? '检查中...' : '重新检查' }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { UiModal, UiButton, UiEmptyState } from './ui/index.js'
import { checkHotUpdate } from '../utils/hotupdate'
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

  // 有 webVer 直接显示（无论 3 位还是 4 位），否则用 nativeVer + .0
  if (webVer) {
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
.version-info {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.version-logo {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  margin-bottom: 10px;
  object-fit: contain;
  border: 2px solid var(--border-color, #8f7351);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
.app-name {
  margin: 0 0 4px 0;
  font-size: 17px;
  color: var(--text-main, #3e2a14);
  font-weight: 700;
  letter-spacing: 2px;
}
.current-version {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  font-style: italic;
}

.status-box {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76px;
}

.up-to-date {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main, #3e2a14);
  font-size: 15px;
  font-weight: 600;
}
.check-icon {
  width: 22px;
  height: 22px;
  background: var(--q2, #2b7a2b);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  font-size: 13px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.update-available {
  display: flex;
  align-items: flex-start;
  text-align: left;
  width: 100%;
}
.update-icon {
  width: 24px;
  height: 24px;
  background: var(--q5, #b0610c);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.update-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.update-title {
  color: var(--q5, #b0610c);
  font-weight: 700;
}
.dark-mode .update-title {
  color: var(--q5, #d99a45);
}
.update-desc {
  font-size: 12px;
  color: var(--danger, #8b0000);
  line-height: 1.5;
}
.dark-mode .update-desc {
  color: #e06a6a;
}
</style>
