import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App } from '@capacitor/app'
import { isNative, CLOUD_URL } from './env.js'
import { fetchJsonWithTimeout } from './resourceClient.js'

const HOTUPDATE_MANIFEST_URL = `${CLOUD_URL}/update/hotupdate.json`
const GITEE_RELEASE_URL = 'https://gitee.com/api/v5/repos/ccyconner/myrzg/releases/latest'
const isVersion = value => typeof value === 'string' && /^v?\d+(?:\.\d+){1,3}$/.test(value)
const isDownloadUrl = value => {
  try { return new URL(value).protocol === 'https:' } catch (_) { return false }
}

export function compareVersions(v1, v2) {
  const parts = version => String(version || '').replace(/^v/, '').split('.').map(Number)
  const a = parts(v1), b = parts(v2)
  for (let index = 0; index < 4; index++) {
    if ((a[index] || 0) > (b[index] || 0)) return 1
    if ((a[index] || 0) < (b[index] || 0)) return -1
  }
  return 0
}

const validateManifest = manifest => {
  if (!isVersion(manifest?.version) || !isDownloadUrl(manifest?.downloadUrl)) {
    throw new Error('更新信息不完整，请稍后重试。')
  }
  return true
}

export function createHotUpdateClient({
  updater = CapacitorUpdater,
  app = App,
  native = isNative,
  readJson = fetchJsonWithTimeout,
  storage = () => globalThis.localStorage,
  logger = console
} = {}) {
  let checking = null

  async function getCurrentWebVersion() {
    if (!native) return '1.0.0'
    const current = await updater.current()
    const version = current.bundle?.id === 'builtin'
      ? current.native || (await app.getInfo()).version
      : current.bundle?.version
    if (!isVersion(version)) throw new Error('无法确认当前更新版本，请重启应用。')
    return version
  }

  async function check() {
    await updater.notifyAppReady()
    const currentWebVersion = await getCurrentWebVersion()
    // This compatibility key describes the running bundle, never a pending download.
    try { storage()?.setItem('local_web_version', currentWebVersion) } catch (error) { logger.warn('Version storage unavailable:', error) }

    try {
      const nativeVersion = (await app.getInfo()).version
      const release = await readJson(`${GITEE_RELEASE_URL}?t=${Date.now()}`, { timeoutMs: 6000, cache: 'no-store' })
      if (isVersion(release?.tag_name) && compareVersions(release.tag_name, nativeVersion) > 0) {
        const assets = Array.isArray(release.assets) ? release.assets : []
        const apk = assets.find(asset => isDownloadUrl(asset?.browser_download_url)
          && new URL(asset.browser_download_url).pathname.endsWith('.apk'))
        if (apk) return {
          version: release.tag_name,
          _needsApkUpdate: true,
          downloadUrl: apk.browser_download_url,
          body: release.body || '包含底层更新，建议更新。',
          _currentVer: nativeVersion
        }
      }
    } catch (error) {
      logger.warn('APK update check failed:', error)
    }

    const manifest = await readJson(`${HOTUPDATE_MANIFEST_URL}?t=${Date.now()}`, {
      timeoutMs: 8000,
      cache: 'no-store',
      validate: validateManifest
    })
    validateManifest(manifest)
    return compareVersions(manifest.version, currentWebVersion) > 0
      ? { ...manifest, _currentVer: currentWebVersion, _needsApkUpdate: false }
      : null
  }

  function checkHotUpdate() {
    if (!native) return Promise.resolve(null)
    if (!checking) checking = check().finally(() => { checking = null })
    return checking
  }

  async function applyHotUpdate(manifest, onProgress) {
    if (!native) return
    validateManifest(manifest)
    let listener
    let versionInfo
    try {
      listener = await updater.addListener('download', info => {
        const percent = Math.max(0, Math.min(100, Math.round(Number(info?.percent) || 0)))
        onProgress?.(percent)
      })
      versionInfo = await updater.download({ url: manifest.downloadUrl, version: manifest.version })
      if (!versionInfo?.id) throw new Error('更新包下载结果不完整，请重试。')
    } finally {
      // set() reloads the WebView, so cleanup must finish before activation begins.
      try { await listener?.remove() } catch (error) { logger.warn('Update listener cleanup failed:', error) }
    }
    await updater.set({ id: versionInfo.id })
  }

  return { checkHotUpdate, applyHotUpdate, getCurrentWebVersion }
}

const client = createHotUpdateClient()
export const checkHotUpdate = client.checkHotUpdate
export const applyHotUpdate = client.applyHotUpdate
export const getCurrentWebVersion = client.getCurrentWebVersion
