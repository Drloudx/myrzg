const DEFAULT_TIMEOUT_MS = 8000

export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Resource verification requires HTTPS')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function fetchJsonWithTimeout(url, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  expectedHash = '',
  validate,
  fetchImpl = (...args) => fetch(...args),
  digest = sha256,
  cache
} = {}) {
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`Resource request timed out: ${url}`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetchImpl(url, { signal: controller.signal, ...(cache ? { cache } : {}) })
      if (!response.ok) throw new Error(`Resource request failed (${response.status}): ${url}`)
      const bytes = await response.arrayBuffer()
      if (expectedHash && await digest(bytes) !== expectedHash) {
        throw new Error(`Resource version mismatch: ${url}`)
      }
      const data = JSON.parse(new TextDecoder().decode(bytes))
      if (validate && validate(data) === false) throw new Error(`Invalid resource data: ${url}`)
      return data
    })()])
  } finally {
    clearTimeout(timer)
  }
}

const withVersion = (url, version) => version
  ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
  : url

export function createResourceClient({
  getBaseUrl = () => '',
  resolveLocalUrl = path => path,
  manifests = {},
  isDev = false,
  fetchImpl,
  digest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onFallback = () => {}
} = {}) {
  const resources = new Map()
  const manifestRequests = new Map()
  const enforceManifest = Object.keys(manifests).length > 0
  const readJson = (url, options = {}) => fetchJsonWithTimeout(url, { fetchImpl, digest, timeoutMs, ...options })

  const expectedHashFor = async path => {
    const directory = path.slice(0, path.lastIndexOf('/') + 1)
    const descriptor = manifests[directory]
    if (!descriptor) {
      if (enforceManifest && path !== 'data/notice.json') throw new Error(`Resource is missing from this build: ${path}`)
      return ''
    }
    if (!manifestRequests.has(directory)) {
      const request = readJson(resolveLocalUrl(descriptor.file), { expectedHash: descriptor.hash })
        .catch(error => { manifestRequests.delete(directory); throw error })
      manifestRequests.set(directory, request)
    }
    const manifest = await manifestRequests.get(directory)
    const hash = manifest?.[decodeURI(path)]
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(`Resource is missing from this build: ${path}`)
    }
    return hash
  }

  function fetchResource(relativePath, { validate, cache = true } = {}) {
    const path = String(relativePath || '').replace(/^\/+/, '')
    if (!path || path.includes('://') || path.split('/').includes('..')) {
      return Promise.reject(new Error('Invalid resource path'))
    }
    const cacheable = cache && path !== 'data/notice.json'
    let request = cacheable ? resources.get(path) : null
    if (!request) {
      request = (async () => {
        const expectedHash = await expectedHashFor(path)
        const version = isDev ? String(Date.now()) : expectedHash
        const localUrl = withVersion(resolveLocalUrl(path), version)
        const baseUrl = getBaseUrl()
        const remoteUrl = baseUrl ? withVersion(`${baseUrl.replace(/\/$/, '')}/${path}`, version) : ''
        if (remoteUrl) {
          try {
            return await readJson(remoteUrl, { expectedHash, validate })
          } catch (error) {
            onFallback(path, error)
          }
        }
        return readJson(localUrl, { expectedHash, validate })
      })().catch(error => {
        if (resources.get(path) === request) resources.delete(path)
        throw error
      })
      if (cacheable) resources.set(path, request)
      return request
    }
    if (!validate) return request
    return request.then(data => {
      if (validate(data) === false) throw new Error(`Invalid resource data: ${path}`)
      return data
    }).catch(error => {
      if (resources.get(path) === request) resources.delete(path)
      throw error
    })
  }

  return { fetchResource }
}

export function createCachedLoader(load) {
  let pending = null
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(load).catch(error => {
        pending = null
        throw error
      })
    }
    return pending
  }
}
