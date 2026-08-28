import { getResourceBaseUrl, CLOUD_URL } from './env.js';

/**
 * 智能资源获取器
 * @param {string} relativePath 相对路径 (如 data/config.json)
 * @returns {Promise<any>}
 */
export async function fetchWithFallback(relativePath) {
  const baseUrl = getResourceBaseUrl();
  const targetUrl = baseUrl ? `${baseUrl}/${relativePath}` : relativePath;

  try {
    // 生产环境不再加时间戳：静态数据走 CDN/浏览器 HTTP 缓存，重复访问不重复下载；
    // 仅本地 dev 保留时间戳，避免开发时缓存旧数据。
    const isData = relativePath.endsWith('.json');
    const isDev = typeof import.meta !== 'undefined' && !!import.meta.env && !!import.meta.env.DEV;
    const urlWithQuery = isData && isDev ? `${targetUrl}?t=${Date.now()}` : targetUrl;
    
    const response = await fetch(urlWithQuery);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed, attempting fallback to local assets...', error);
    
    // 如果配置了云端并且获取失败，说明断网或云端异常，降级到本地离线资源
    if (baseUrl === CLOUD_URL) {
      // 触发断网事件，以便在 UI 给出 Toast 提示
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('network-fallback', { detail: relativePath }));
      }
      
      try {
        // 动态计算基于当前 index.html 的绝对相对路径，防止 Capacitor 深层路由丢失
        let base = window.location.href.split('#')[0].split('?')[0];
        if (base.endsWith('.html')) {
          base = base.substring(0, base.lastIndexOf('/'));
        }
        if (!base.endsWith('/')) {
          base += '/';
        }
        const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        const fallbackUrl = base + cleanPath;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) {
          throw new Error('Fallback read failed');
        }
        return await fallbackResponse.json();
      } catch (fallbackError) {
        console.error('Fallback totally failed', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}
