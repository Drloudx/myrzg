<template>
  <div class="update-overlay" v-if="visible">
    <div class="update-modal">
      <div class="update-header">
        <h3 class="update-title">发现新版本 {{ updateInfo?.version }}</h3>
      </div>
      
      <div class="update-body">
        <div class="update-desc" v-if="updateInfo?._needsApkUpdate" style="color: #ef4444; font-weight: bold; margin-bottom: 8px;">
          【重要】本次包含底层引擎大版本更新，需前往浏览器下载最新版安装包。
        </div>
        <div class="update-desc" v-if="updateInfo?.body">
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
        
        <button v-if="updateInfo?._needsApkUpdate" class="btn btn-primary" @click="openGiteeReleases">
          浏览器下载新版
        </button>
        <button v-else class="btn btn-primary" @click="startUpdate" :disabled="isDownloading">
          {{ isDownloading ? '更新中...' : '立即更新' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Browser } from '@capacitor/browser';
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
  
  try {
    await applyHotUpdate(updateInfo.value, (pct) => {
      progress.value = pct;
    });
    // 更新完成后 Capgo 会自动重载，这行可能不一定能执行到
    visible.value = false;
  } catch (err) {
    errorMsg.value = err.message || '下载解压时出错';
    isDownloading.value = false;
  }
};

const openGiteeReleases = async () => {
  try {
    await Browser.open({ url: 'https://gitee.com/ccyconner/myrzg/releases' });
  } catch (err) {
    console.warn('Browser plugin fail, fallback to window.open', err);
    window.open('https://gitee.com/ccyconner/myrzg/releases', '_system');
  }
};

const close = () => {
  if (!isDownloading.value) {
    visible.value = false;
  }
};
</script>

<style scoped>
.update-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.update-modal {
  background: #ffffff;
  border-radius: 16px;
  width: 85%;
  max-width: 320px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 适配深色模式，如果需要可以加入暗黑媒体查询 */
@media (prefers-color-scheme: dark) {
  .update-modal {
    background: #1e1e1e;
    color: #fff;
  }
}

.update-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: inherit;
}

.update-desc {
  font-size: 0.95rem;
  color: #666;
  line-height: 1.5;
  white-space: pre-wrap;
}

@media (prefers-color-scheme: dark) {
  .update-desc {
    color: #bbb;
  }
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: #eee;
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
  background: #4ade80;
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
  margin-top: 8px;
}

.update-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
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
