<template>
  <Transition name="update-fade">
    <div class="update-overlay" v-if="visible">
      <div class="update-modal paper-panel corner-nails">
        <div class="update-header">
          <h3 class="update-title">发现新版本 {{ updateInfo?.version }}</h3>
        </div>
        
        <div class="update-body">
          <div class="update-desc important-desc" v-if="updateInfo?._needsApkUpdate">
            【重要】本次包含底层更新，请选择更新。
          </div>

          <!-- 更新内容的包裹层 -->
          <div class="update-content-box" v-if="updateInfo?.body">
            {{ updateInfo.body }}
          </div>

          <div class="progress-section" v-if="isDownloading">
            <UiProgressBar :value="progress" :label="`正在下载更新资源: ${progress}%`" />
          </div>

          <div class="error-text" v-if="errorMsg">
            更新失败: {{ errorMsg }}
          </div>
        </div>

        <div class="update-footer">
          <UiButton variant="ghost" :disabled="isDownloading" @click="close">暂不更新</UiButton>
          <UiButton variant="primary" :disabled="isDownloading" @click="startUpdate">
            {{ isDownloading ? '更新中...' : (updateInfo?._needsApkUpdate ? '立即下载并安装' : '立即更新') }}
          </UiButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { checkHotUpdate, applyHotUpdate } from '@/utils/hotupdate';
import { UiButton, UiProgressBar } from './ui/index.js';

const visible = ref(false);
const updateInfo = ref(null);
const isDownloading = ref(false);
const progress = ref(0);
const errorMsg = ref('');

onMounted(async () => {
  try {
    const manifest = await checkHotUpdate();
    if (manifest) {
      updateInfo.value = manifest;
      visible.value = true;
    }
  } catch (err) {
    console.error('检查更新失败', err);
  }
});

const startUpdate = async () => {
  if (!updateInfo.value) return;

  isDownloading.value = true;
  errorMsg.value = '';

  if (updateInfo.value._needsApkUpdate) {
    // 1. APK 大版本更新：下载并唤起安装
    try {
      const downloadUrl = updateInfo.value.downloadUrl;
      if (!downloadUrl) throw new Error('未找到下载链接');

      const fileName = `update-${updateInfo.value.version}.apk`;

      const listener = await Filesystem.addListener('progress', (event) => {
        if (event.contentLength > 0) {
          progress.value = Math.round((event.bytes / event.contentLength) * 100);
        }
      });

      console.log('[UpdateModal] 开始下载 APK:', downloadUrl);
      const result = await Filesystem.downloadFile({
        url: downloadUrl,
        path: fileName,
        directory: Directory.Cache, // 使用 Cache 目录，FileOpener 会通过 FileProvider 共享给安装器
        progress: true,
      });

      listener.remove();
      console.log('[UpdateModal] 下载完成:', result.path);

      await FileOpener.openFile({
        path: result.path,
        mimeType: 'application/vnd.android.package-archive'
      });
      isDownloading.value = false;
    } catch (err) {
      console.error(err);
      errorMsg.value = err.message || '下载或安装APK失败';
      isDownloading.value = false;
    }
  } else {
    // 2. 小版本热更新：直接应用热更包
    try {
      await applyHotUpdate(updateInfo.value, (pct) => {
        progress.value = pct;
      });
      visible.value = false;
    } catch (err) {
      errorMsg.value = err.message || '下载解压时出错';
      isDownloading.value = false;
    }
  }
};

const close = () => {
  if (!isDownloading.value) {
    visible.value = false;
  }
};
const startUpdateWithInfo = (info) => {
  updateInfo.value = info;
  visible.value = true;
  startUpdate();
};

defineExpose({ startUpdateWithInfo });
</script>

<style scoped>
.update-fade-enter-active, .update-fade-leave-active {
  transition: opacity 0.22s ease;
}
.update-fade-enter-from, .update-fade-leave-to {
  opacity: 0;
}

/* 蒙层：使用 top/bottom/left/right 确保绝对居中，避免移动端高度塌陷 */
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-overlay, rgba(24, 14, 6, 0.55));
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* 弹窗主体 */
.update-modal {
  width: 86%;
  max-width: 330px;
  padding: 22px 22px 20px 22px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.update-header {
  margin-bottom: 14px;
  text-align: center;
}

.update-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  letter-spacing: 1px;
  border-bottom: 2px double var(--border-color, #8f7351);
  padding-bottom: 8px;
}

.update-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}

/* 抽离出来的红色重要提示样式 */
.important-desc {
  color: var(--danger, #8b0000);
  font-weight: 700;
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
}
.dark-mode .important-desc {
  color: #e06a6a;
}

/* 文本包裹样式，带有背景色并强制居左 */
.update-content-box {
  background-color: var(--paper-solid, #d9c6a6);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  padding: 12px 14px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-main, #3e2a14);
  line-height: 1.7;
  white-space: pre-wrap;
  text-align: left;
  box-shadow: inset 0 2px 5px rgba(43, 31, 21, 0.15);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.error-text {
  color: var(--danger, #8b0000);
  font-size: 13px;
  margin-top: 2px;
  text-align: center;
  font-weight: 600;
}
.dark-mode .error-text {
  color: #e06a6a;
}

/* 底部按钮区域 */
.update-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
</style>
