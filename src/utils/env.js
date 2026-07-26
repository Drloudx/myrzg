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
  // Android 端：路由全面劫持，强制跨域请求云端 (以便触发 WebView 独立缓存和 304 机制)
  // 当拦截器检测到断网时，也可以通过修改内部状态来返回本地 assets 目录路径
  return isNative ? CLOUD_URL : ''; 
}
