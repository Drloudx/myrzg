import { DATA_RESOURCE_MANIFESTS, getLocalResourceUrl, getResourceBaseUrl } from './env.js'
import { createResourceClient } from './resourceClient.js'
import { validateResource } from './resourceSchemas.js'

const client = createResourceClient({
  getBaseUrl: getResourceBaseUrl,
  resolveLocalUrl: getLocalResourceUrl,
  manifests: DATA_RESOURCE_MANIFESTS,
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
