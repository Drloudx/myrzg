<template>
  <UiModal
    :visible="visible"
    :title="'发现新版本 ' + (updateInfo?.version || '')"
    :closable="!isDownloading"
    max-width="420px"
    scroll-id="updateModalScroll"
    :z-index="13000"
    teleport-to="body"
    @update:visible="close"
  >
    <div class="update-body">
      <div v-if="updateInfo?._needsApkUpdate" class="important-desc">
        本次包含底层更新，需要下载并安装新版应用。
      </div>
      <div v-if="updateInfo?.body" class="update-content">{{ updateInfo.body }}</div>
      <UiProgressBar v-if="isDownloading" :value="progress" :label="'正在下载更新资源: ' + progress + '%'" />
      <div v-if="errorMsg" class="error-text" role="alert">更新失败: {{ errorMsg }}</div>
    </div>
    <template #footer>
      <UiButton variant="ghost" :disabled="isDownloading" @click="close">暂不更新</UiButton>
      <UiButton variant="primary" :disabled="isDownloading" @click="startUpdate">
        {{ isDownloading ? '更新中...' : (updateInfo?._needsApkUpdate ? '立即下载并安装' : '立即更新') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capawesome-team/capacitor-file-opener'
import { checkHotUpdate, applyHotUpdate } from '@/utils/hotupdate'
import { UiButton, UiModal, UiProgressBar } from './ui/index.js'

const visible = ref(false)
const updateInfo = ref(null)
const isDownloading = ref(false)
const progress = ref(0)
const errorMsg = ref('')
let unmounted = false
let progressListener = null

const removeProgressListener = async () => {
  const listener = progressListener
  progressListener = null
  try { await listener?.remove() } catch (error) { console.warn('APK progress cleanup failed:', error) }
}

onMounted(async () => {
  try {
    const manifest = await checkHotUpdate()
    if (manifest && !unmounted && !visible.value && !isDownloading.value) {
      updateInfo.value = manifest
      progress.value = 0
      errorMsg.value = ''
      visible.value = true
    }
  } catch (error) {
    console.error('检查更新失败', error)
  }
})

const startUpdate = async () => {
  if (!updateInfo.value || isDownloading.value || unmounted) return
  const info = updateInfo.value
  isDownloading.value = true
  progress.value = 0
  errorMsg.value = ''
  const reportProgress = value => {
    if (!unmounted) progress.value = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  }

  try {
    if (info._needsApkUpdate) {
      if (!info.downloadUrl) throw new Error('未找到下载链接')
      progressListener = await Filesystem.addListener('progress', event => {
        if (event.contentLength > 0) reportProgress(event.bytes / event.contentLength * 100)
      })
      if (unmounted) return
      const result = await Filesystem.downloadFile({
        url: info.downloadUrl,
        path: 'update-' + String(info.version).replace(/[^a-zA-Z0-9._-]/g, '_') + '.apk',
        directory: Directory.Cache,
        progress: true
      })
      if (!result.path) throw new Error('下载完成但未返回安装包路径')
      if (unmounted) return
      await FileOpener.openFile({ path: result.path, mimeType: 'application/vnd.android.package-archive' })
    } else {
      await applyHotUpdate(info, reportProgress)
      visible.value = false
    }
  } catch (error) {
    if (!unmounted) errorMsg.value = error.message || '下载或应用更新失败'
  } finally {
    await removeProgressListener()
    isDownloading.value = false
  }
}

const close = () => {
  if (!isDownloading.value) visible.value = false
}
const startUpdateWithInfo = info => {
  if (isDownloading.value || unmounted) return
  updateInfo.value = info
  errorMsg.value = ''
  progress.value = 0
  visible.value = true
  return startUpdate()
}
onBeforeUnmount(() => {
  unmounted = true
  removeProgressListener()
})
defineExpose({ startUpdateWithInfo })
</script>

<style scoped>
.update-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.important-desc, .error-text {
  color: var(--danger);
  font-weight: 600;
  font-size: 13px;
}
.update-content {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
