import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { isNative, CLOUD_URL } from './env';

// 游戏前端内核的热更 manifest (以 JSON 形式托管在云端)
const HOTUPDATE_MANIFEST_URL = `${CLOUD_URL}/update/hotupdate.json`;

/**
 * 比较两个版本号，v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0
 */
const compareVersions = (v1, v2) => {
  const p = (v) => (v || '').replace('v', '').split('.').map(Number);
  const a = p(v1), b = p(v2);
  for (let i = 0; i < 4; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
};

/**
 * 检查是否有热更新可用
 */
export const checkHotUpdate = async () => {
  if (!isNative) {
    console.log('[HotUpdate] 非 Android 原生环境，跳过热更检查');
    return null;
  }

  try {
    // 强制每次冷启动时先通知插件加载完成，防止插件在后台被杀死后无法重置状态
    await CapacitorUpdater.notifyAppReady();
    
    // 1. 先检查 Gitee API 是否有底包 (APK) 大更新
    try {
      const appInfo = await App.getInfo();
      const nativeVersion = appInfo.version || '1.0.0';
      console.log('[HotUpdate] 本地原生 APK 版本:', nativeVersion);

      const giteeUrl = 'https://gitee.com/api/v5/repos/ccyconner/myrzg/releases/latest';
      const giteeResp = await fetch(`${giteeUrl}?t=${Date.now()}`);
      
      if (giteeResp.ok) {
        const giteeData = await giteeResp.json();
        const giteeVersion = giteeData.tag_name || '';
        
        if (giteeVersion && compareVersions(giteeVersion, nativeVersion) > 0) {
          const apkAsset = giteeData.assets?.find(a => a.browser_download_url?.endsWith('.apk'));
          if (apkAsset) {
            console.log('[HotUpdate] 发现新版 APK:', giteeVersion);
            return {
              version: giteeVersion,
              _needsApkUpdate: true,
              downloadUrl: apkAsset.browser_download_url,
              body: giteeData.body || '包含底层的更新，建议立即更新。',
              _currentVer: nativeVersion
            };
          }
        }
      }
    } catch (giteeErr) {
      console.warn('[HotUpdate] Gitee 检查失败:', giteeErr);
    }

    // 2. 如果没有底包更新，检查云端 hotupdate.json 看是否有热更新小包
    const currentWebVer = localStorage.getItem('local_web_version') || '1.0.0';
    console.log('[HotUpdate] 本地生效的 Web 版本:', currentWebVer);

    const resp = await fetch(`${HOTUPDATE_MANIFEST_URL}?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    const manifest = await resp.json();
    
    console.log('[HotUpdate] 远程最新热更版本:', manifest.version);

    if (compareVersions(manifest.version, currentWebVer) > 0) {
      console.log('[HotUpdate] 发现热更新:', manifest.version);
      manifest._currentVer = currentWebVer;
      manifest._needsApkUpdate = false;
      return manifest;
    }
    
    console.log('[HotUpdate] 已经是最新版本');
    return null;
  } catch (e) {
    console.warn('[HotUpdate] check failed:', e);
    return null;
  }
};

/**
 * 执行热更新下载并应用
 */
export const applyHotUpdate = async (manifest, onProgress) => {
  if (!isNative) return;

  try {
    // 监听下载进度
    const listener = CapacitorUpdater.addListener('download', (info) => {
      onProgress && onProgress(Math.round(info.percent));
    });

    console.log('[HotUpdate] 开始下载热更包...');
    
    // 1. 下载 Zip 压缩包（插件自动在底层解压到沙盒私有目录）
    const versionInfo = await CapacitorUpdater.download({
      url: manifest.downloadUrl,
      version: manifest.version,
    });

    console.log('[HotUpdate] 下载解压完成', versionInfo);
    
    // 移除监听
    listener.remove();

    // 2. 记录版本号
    localStorage.setItem('local_web_version', manifest.version);

    // 3. 应用热更并重新加载 (插件会自动处理挂载路由到原生私有目录)
    await CapacitorUpdater.set({ id: versionInfo.id });

  } catch (e) {
    console.error('[HotUpdate] 升级失败:', e);
    throw e;
  }
};
