import { Capacitor } from '@capacitor/core';

// 云端 CDN 域名
export const CLOUD_URL = 'https://myrzg.yxzmy.top';

// 识别是否为 Android 原生 APP 环境
export const isNative = Capacitor.isNativePlatform();

/**
 * 获取静态/动态资源基准路径
 * @returns {string} 
 */
export function getResourceBaseUrl() {
  // Web 端：相对路径读取同域云端资源或本地 dev server
  // Android 端：如果有网则请求云端 CDN (触发 WebView 独立缓存)，如果断网则 fallback 到本地 assets
  if (isNative) {
    return navigator.onLine ? CLOUD_URL : ''; 
  }
  return '';
}

/**
 * 获取图片资源全路径
 * @param {string} path 图片相对路径 (如 /Common_ItemIcon/123.png)
 * @returns {string}
 */
export function getImageUrl(path) {
  if (!path) return '';
  // UI icons are small and bundled locally in the hot update. Do not hit CDN.
  if (path.startsWith('/ui/') || path.startsWith('ui/')) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // Other large assets were moved to /images by the user
  let imgPath = path.startsWith('/') ? path : `/${path}`;
  if (!imgPath.startsWith('/images/')) {
    imgPath = `/images${imgPath}`;
  }

  const baseUrl = getResourceBaseUrl();
  if (!baseUrl) return imgPath;
  
  return `${baseUrl}${imgPath}`;
}
