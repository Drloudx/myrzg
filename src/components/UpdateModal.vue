<template>
  <div class="update-overlay" v-if="visible">
    <div class="update-modal">
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
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="progress-text">正在下载更新资源: {{ progress }}%</div>
        </div>

        <div class="error-text" v-if="errorMsg">
          更新失败: {{ errorMsg }}
        </div>
      </div>

      <div class="update-footer">
        <button class="btn btn-secondary" @click="close" :disabled="isDownloading">暂不更新</button>
        <button class="btn btn-primary" @click="startUpdate" :disabled="isDownloading">
          {{ isDownloading ? '更新中...' : (updateInfo?._needsApkUpdate ? '立即下载并安装' : '立即更新') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { checkHotUpdate, applyHotUpdate } from '@/utils/hotupdate';

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
/* 蒙层：使用 top/bottom/left/right 确保绝对居中，避免移动端高度塌陷 */
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* 弹窗主体 */
.update-modal {
  background: #ffffff;
  border-radius: 16px;
  width: 85%;
  max-width: 320px;
  padding: 28px 24px 24px 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 适配深色模式 */
@media (prefers-color-scheme: dark) {
  .update-modal {
    background: #1e1e1e;
    color: #fff;
  }
}

.update-header {
  margin-bottom: 16px;
  text-align: center; /* 标题居中 */
}

.update-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: bold;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .update-title {
    color: #f1f1f1;
  }
}

.update-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

/* 抽离出来的红色重要提示样式 */
.important-desc {
  color: #e11d48;
  font-weight: 500;
  text-align: left; /* 改为居左，防止多行折行时显得突兀 */
  font-size: 0.95rem;
}

/* 文本包裹样式，带有背景色并强制居左 */
.update-content-box {
  background-color: #f8f9fa; /* 浅灰色背景，类似图二的包裹感 */
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #666;
  line-height: 1.6;
  white-space: pre-wrap;
  text-align: left; /* 强制文本居左 */
}

@media (prefers-color-scheme: dark) {
  .important-desc {
    color: #f43f5e;
  }
  .update-content-box {
    background-color: #2a2a2a; /* 深色模式下的包裹背景 */
    color: #bbb;
  }
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .progress-bar-bg {
    background: #333;
  }
}

.progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.85rem;
  color: #888;
  text-align: right;
}

.error-text {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 4px;
  text-align: center;
}

/* 底部按钮区域 */
.update-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.btn {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .btn-secondary {
    color: #bbb;
  }
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}
</style>