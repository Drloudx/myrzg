import { getResourceBaseUrl, CLOUD_URL } from './env';

/**
 * 智能资源获取器
 * @param {string} relativePath 相对路径 (如 data/config.json)
 * @returns {Promise<any>}
 */
export async function fetchWithFallback(relativePath) {
  const baseUrl = getResourceBaseUrl();
  const targetUrl = baseUrl ? `${baseUrl}/${relativePath}` : relativePath;

  try {
    // 强制加入时间戳防止缓存（仅限 JSON 数据）
    const isData = relativePath.endsWith('.json');
    const urlWithQuery = isData ? `${targetUrl}?t=${Date.now()}` : targetUrl;
    
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
        // App 本地打包兜底路径，从根目录请求
        const fallbackUrl = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
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
