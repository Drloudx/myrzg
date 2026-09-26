import { DATA_RESOURCE_HASHES, DATA_RESOURCE_MANIFESTS, getLocalResourceUrl, getResourceBaseUrl } from './env.js'
import { createResourceClient } from './resourceClient.js'
import { validateResource } from './resourceSchemas.js'

const client = createResourceClient({
  getBaseUrl: getResourceBaseUrl,
  resolveLocalUrl: getLocalResourceUrl,
  manifests: DATA_RESOURCE_MANIFESTS,
  inlineHashes: DATA_RESOURCE_HASHES,
  isDev: !!import.meta.env?.DEV,
  onFallback(path, error) {
    console.warn('Using bundled resource:', path, error)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('network-fallback', { detail: path }))
    }
  }
})

/** Shared pending/success cache; a failed or invalid response can always be retried. */
export function fetchWithFallback(relativePath, options = {}) {
  const path = String(relativePath || '').replace(/^\/+/, '')
  return client.fetchResource(path, {
    ...options,
    validate(data) {
      validateResource(path, data)
      return options.validate ? options.validate(data) : true
    }
  })
}

/**
 * 预热某目录的 manifest（不返回内容、失败静默）。
 *
 * 用于「详情按需加载」的页面：页面挂载时先预热 manifest，等用户点开详情时
 * 就能直接发数据请求，不必再串行等一个 manifest 往返。
 * 传任意该目录下的路径即可（如 `data/taskDialogs/x.json`）。
 * 已内联哈希的目录（当前只有 `data/parsed/`）无需预热，会直接返回。
 */
export function prefetchResourceManifest(relativePath) {
  return client.prefetchManifest(relativePath)
}
