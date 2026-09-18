import { Capacitor } from '@capacitor/core';

// 云端 CDN 域名
export const CLOUD_URL = 'https://myrzg.yxzmy.top';
export const RESOURCE_BUILD_ID = typeof __RESOURCE_BUILD_ID__ !== 'undefined' ? __RESOURCE_BUILD_ID__ : ''
export const DATA_RESOURCE_MANIFESTS = typeof __DATA_RESOURCE_MANIFESTS__ !== 'undefined' ? __DATA_RESOURCE_MANIFESTS__ : {}
/**
 * `/images/<相对路径>` → 该文件的**内容哈希**（构建时由 vite.config.js 的 `collectImageVersions` 注入）。
 * 取每个文件自己的哈希而非全局 build id，是为了让**未改动的图片跨部署复用缓存**；
 * 未收录的路径（如运行时拼出的路径）回退到 `RESOURCE_BUILD_ID`，保持原有行为。
 */
export const IMAGE_VERSIONS = typeof __IMAGE_VERSIONS__ !== 'undefined' ? __IMAGE_VERSIONS__ : {}

export function getLocalResourceUrl(path) {
  const cleanPath = String(path || '').replace(/^\/+/, '')
  if (typeof window === 'undefined') return cleanPath
  const base = new URL(window.location.href)
  base.hash = ''
  base.search = ''
  if (!base.pathname.endsWith('/') && !base.pathname.endsWith('.html')) base.pathname += '/'
  return new URL(cleanPath, base).href
}

// 识别是否为 Android 原生 APP 环境
// 注意：改为惰性安全求值，保证该模块能在 Node 构建脚本（scripts/parse/*.mjs）中安全 import
let _isNative = false
try {
  _isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
} catch (_) {
  _isNative = false
}
export const isNative = _isNative

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
  if (!path || typeof path !== 'string') return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
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
  const url = `${baseUrl}${imgPath}`;
  // 优先用该文件自己的内容哈希；未收录则回退全局 build id（保持旧行为，不会漏掉缓存刷新）。
  const version = IMAGE_VERSIONS[imgPath] || RESOURCE_BUILD_ID;
  return version ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : url;
}

const imageAttempts = new WeakMap()
const handledImageEvents = new WeakMap()

export function resetImageFallback(element) {
  if (element) imageAttempts.delete(element)
}

/** Each source gets at most one bundled retry and one local placeholder attempt. */
export function handleImageFallback(event, { source, candidates = [], fallback = '/ui/visibility-off.svg', onExhausted } = {}) {
  if (event && handledImageEvents.has(event)) return handledImageEvents.get(event)
  const element = event?.target || event?.currentTarget
  if (!element) return false
  const current = element.getAttribute?.('src') || element.src || ''
  let state = imageAttempts.get(element)
  const original = source || (state?.candidates.includes(current) ? state.source : current)
  const signature = JSON.stringify([original, candidates, fallback])
  if (!state || state.signature !== signature) {
    const queue = []
    for (const candidate of [original, ...candidates]) {
      if (!candidate || typeof candidate !== 'string') continue
      queue.push(candidate)
      try {
        const parsed = new URL(candidate, typeof window === 'undefined' ? 'https://localhost/' : window.location.href)
        if (parsed.origin === CLOUD_URL) queue.push(`${parsed.pathname}${parsed.search}`)
      } catch (_) { /* Invalid paths proceed to the next bounded candidate. */ }
    }
    if (fallback) queue.push(fallback)
    state = { source: original, signature, candidates: [...new Set(queue)], tried: new Set(), exhausted: false }
    imageAttempts.set(element, state)
  }
  state.tried.add(current)
  state.tried.add(state.source)
  const next = state.candidates.find(candidate => !state.tried.has(candidate))
  if (next) {
    state.tried.add(next)
    element.src = next
    handledImageEvents.set(event, true)
    return true
  }
  if (!state.exhausted) {
    state.exhausted = true
    onExhausted?.(element)
  }
  handledImageEvents.set(event, false)
  return false
}
