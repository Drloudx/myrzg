import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const hashBytes = value => createHash('sha256').update(value).digest('hex')

export function collectResourceManifests(publicDir) {
  const groups = new Map()
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) { walk(fullPath); continue }
      const relative = path.relative(publicDir, fullPath).replaceAll('\\', '/')
      if (!entry.name.endsWith('.json') || relative === 'data/notice.json') continue
      const group = relative.slice(0, relative.lastIndexOf('/') + 1)
      if (!groups.has(group)) groups.set(group, {})
      groups.get(group)[relative] = hashBytes(readFileSync(fullPath))
    }
  }
  walk(path.join(publicDir, 'data'))
  const descriptors = {}
  const assets = []
  const entries = {}
  for (const [directory, directoryEntries] of groups) {
    const source = JSON.stringify(directoryEntries)
    const hash = hashBytes(source)
    const file = `assets/data-manifests/${directory.replace(/[^a-zA-Z0-9]+/g, '-')}${hash.slice(0, 16)}.json`
    descriptors[directory] = { file, hash }
    entries[directory] = directoryEntries
    assets.push({ type: 'asset', fileName: file, source })
  }
  return { descriptors, assets, entries }
}

/**
 * **内联**逐文件 SHA-256 的目录白名单。
 *
 * 为什么需要：`resourceClient.expectedHashFor()` 要先读 `assets/data-manifests/<目录>-*.json`
 * 拿到该文件的 sha256，才能拼出 `?v=<sha256>` 去请求真正的数据文件——于是关键路径变成
 * `壳 → manifest（1 个 RTT）→ 数据（1 个 RTT）`。在跨国/跨网 RTT 200~400 ms 的环境下，
 * 等于白等一个来回才开始下载大文件。
 *
 * 只内联 `data/parsed/`（34 个文件，约 3.4 KB raw）：它是**首屏落地页**要的那组
 * （`/` 重定向 `/items` → `items.json`），冷启动必然要付这个 RTT，收益最高。
 * `data/parsed/dungeons/`、`data/parsed/stages/` 只在用户**点开某个详情**时才取，
 * 那一次点击多 1 个 RTT 基本无感，不值得让每个冷启动用户都多下它们的哈希表；
 * `data/dialogs/`（522 个）与 `data/taskDialogs/`（979 个）更重，同样留在 manifest。
 */
const INLINE_HASH_DIRECTORIES = ['data/parsed/']

export function collectInlineHashes(entries) {
  const inline = {}
  for (const directory of INLINE_HASH_DIRECTORIES) Object.assign(inline, entries[directory] || {})
  return inline
}

/**
 * 图片（`public/images/**`）的**逐文件内容哈希**，按目录分组，键为 `<目录>/<文件名>`。
 *
 * 为什么需要：原先 `getImageUrl` 用全局 `__RESOURCE_BUILD_ID__`（含 `Date.now()`）当版本号，
 * 于是**每次构建所有图片 URL 都会变**，哪怕图片一个字节都没改——部署一次，全体用户的
 * `/images` 缓存全部作废。改成逐文件哈希后：内容变了才变 URL，没变的图片可以跨部署复用缓存。
 *
 * 为什么按目录分组：这张表会**内联进首屏 `ui-*.js`**（每个页面都 modulepreload 它）。
 * 扁平写法 `"/images/<目录>/<文件>": "<hash>"` 把目录前缀重复了 3052 次；
 * 按目录分组后 raw 179.4 KB → 155.6 KB。实测该表在首屏 chunk 里占 **29.0 KB brotli**
 * （该 chunk 共 45.6 KB，即 64%），所以这里省的每一字节都直接落在关键路径上。
 *
 * 哈希取 `IMAGE_VERSION_LENGTH` 位十六进制：只做缓存键区分，不需要密码学强度
 * （数据完整性另由 `data-manifests` 里的完整 SHA-256 校验）。
 * 截断会带来理论碰撞（32 bit / 3052 个文件约 0.1%），但**只有「短哈希相同而内容不同」
 * 才是真碰撞**；「短哈希相同且内容逐字节相同」是仓库里真实存在的重复素材
 * （如 `plants/lanlucao_1.webp` 与 `plants/shuiluguo_1.webp` 完全同图），共享版本串无害，
 * 因为缓存键还带各自路径。因此下面用**完整 SHA-256** 判定，只对真碰撞报错。
 */
export const IMAGE_VERSION_LENGTH = 8

/**
 * 参与版本化的静态资源根目录（相对 `public/`）。
 *
 * 为什么 `/ui` 也要进来：`getImageUrl` 对 `/ui/*` 原先直接返回裸路径，理由是"UI 图标随热更包
 * 内置、走本地文件、最先可用"。那对**原生端**成立，但网页端也走了同一条分支——于是网页端的
 * `/ui/` 资源**没有任何缓存失效手段**：换一张 `/ui/` 素材后，浏览器与 CDN 会继续发旧图。
 * 2026-09-27 就为此在 EdgeOne 手动刷过一次缓存（压缩后的底图迟迟不生效）。
 * 现在网页端补上 `?v=`，原生端行为不变（见 `env.js` 的 `getImageUrl`）。
 */
const VERSIONED_ASSET_ROOTS = ['images', 'ui']

export function collectImageVersions(publicDir) {
  const versions = {}
  const hashOwners = new Map()
  const collisions = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) { walk(fullPath); continue }
      if (!entry.isFile()) continue
      // 键用「相对 public 的完整目录路径」（如 `/images/Common_Atlas`、`/ui`）：
      // 这样两个根能共用一张表，且 `/ui` 是平铺目录（没有子目录）也能正确分组。
      const relative = path.relative(publicDir, fullPath).replaceAll('\\', '/')
      const cut = relative.lastIndexOf('/')
      const bucket = `/${relative.slice(0, cut)}`
      const file = relative.slice(cut + 1)
      const full = hashBytes(readFileSync(fullPath))
      const short = full.slice(0, IMAGE_VERSION_LENGTH)
      const owner = `${bucket}/${file}`
      const previous = hashOwners.get(short)
      if (previous && previous.full !== full) {
        collisions.push(`${short} → ${previous.owner} / ${owner}`)
      }
      hashOwners.set(short, { owner, full })
      if (!versions[bucket]) versions[bucket] = {}
      versions[bucket][file] = short
    }
  }
  for (const root of VERSIONED_ASSET_ROOTS) {
    const directory = path.join(publicDir, root)
    if (existsSync(directory)) walk(directory)
  }
  if (collisions.length) {
    throw new Error(`图片版本哈希真碰撞（${IMAGE_VERSION_LENGTH} 位十六进制，内容不同却同短哈希，共 ${collisions.length} 组）：${collisions.slice(0, 5).join('; ')}。请调大 vite.config.js 的 IMAGE_VERSION_LENGTH。`)
  }
  return versions
}

/**
 * 给 CSS 里 `/fonts/*.woff2` 的引用补上内容哈希版本参数。
 *
 * 为什么需要：字体文件名是固定的（`HarmonyOS_Sans_SC_Regular.subset.woff2`），而 `/fonts/*`
 * 有长缓存。内容增长后重新子集化 → **文件名不变** → 浏览器与 CDN 继续发旧字形，最长 7 天
 * （2026-09-27 实测过这个模式：`/ui/map_w1_bg.webp` 换了内容但 URL 没变，边缘缓存发了 23 小时旧图）。
 * 补上 `?v=<该文件内容哈希>` 后 URL 随内容变，重新子集化部署即生效、不需要刷缓存。
 *
 * 为什么必须用插件改 CSS、而不是走 `getImageUrl`：`@font-face` 的 `src` 是 CSS 里的字符串，
 * 读不到 `define`（`__IMAGE_VERSIONS__` 那套只覆盖 JS 拼出来的 URL）。构建期替换是唯一
 * 既不引入"字体延迟加载"（JS 设字体会有 FOUT/闪帧）、又能让 URL 随内容变的做法。
 *
 * 覆盖 `/fonts/` 下所有 woff2（含作兜底的全字集），不只是子集——这样任一个文件换了内容都
 * 会换 URL。文件不存在时保持原样（不因为缺文件把构建搞坏）。
 */
function fontUrlVersionPlugin() {
  const fontDir = path.join(repoRoot, 'public/fonts')
  const cache = new Map()
  const versionOf = name => {
    if (!cache.has(name)) {
      const file = path.join(fontDir, name)
      cache.set(name, existsSync(file) ? hashBytes(readFileSync(file)).slice(0, IMAGE_VERSION_LENGTH) : '')
    }
    return cache.get(name)
  }
  return {
    name: 'font-url-version',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css') || !code.includes('/fonts/')) return null
      const next = code.replace(/url\((['"]?)(\/fonts\/[^'")?]+\.woff2)\1\)/g, (whole, quote, url) => {
        const version = versionOf(url.slice('/fonts/'.length))
        return version ? `url(${quote}${url}?v=${version}${quote})` : whole
      })
      return next === code ? null : next
    }
  }
}

function resourceManifestPlugin() {
  let assets = []
  return {
    name: 'bundled-resource-manifests',
    apply: 'build',
    config() {
      const manifest = collectResourceManifests(path.join(repoRoot, 'public'))
      const imageVersions = collectImageVersions(path.join(repoRoot, 'public'))
      const inlineHashes = collectInlineHashes(manifest.entries)
      const imageCount = Object.values(imageVersions).reduce((total, bucket) => total + Object.keys(bucket).length, 0)
      const imageBytes = JSON.stringify(imageVersions).length
      const inlineBytes = JSON.stringify(inlineHashes).length
      console.log(`[resource-manifests] 数据清单 ${Object.keys(manifest.descriptors).length} 组；图片版本 ${imageCount} 条 / ${Object.keys(imageVersions).length} 个目录（注入 ${(imageBytes / 1024).toFixed(0)} KB）；内联数据哈希 ${Object.keys(inlineHashes).length} 条（注入 ${(inlineBytes / 1024).toFixed(1)} KB）`)
      assets = manifest.assets
      return { define: {
        __DATA_RESOURCE_MANIFESTS__: JSON.stringify(manifest.descriptors),
        __DATA_RESOURCE_HASHES__: JSON.stringify(inlineHashes),
        __IMAGE_VERSIONS__: JSON.stringify(imageVersions),
        __RESOURCE_BUILD_ID__: JSON.stringify(`${Date.now().toString(36)}-${hashBytes(JSON.stringify(manifest.descriptors)).slice(0, 12)}`)
      } }
    },
    buildStart() {
      for (const asset of assets) this.emitFile(asset)
    }
  }
}

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [
    vue(),
    fontUrlVersionPlugin(),
    resourceManifestPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve('src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: 'all' // 关键配置，关闭host校验
  },
  build: {
    rollupOptions: {
      output: {
        // Rolldown 支持函数式 manualChunks：把 Capacitor 原生壳依赖与 Vue 运行时从主包拆出，降低首屏主包体积与长缓存命中率
        manualChunks(id) {
          if (id.includes('node_modules/@capacitor') || id.includes('node_modules/@capgo') || id.includes('node_modules/@capawesome')) return 'capacitor'
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) return 'vue-vendor'
        }
      }
    }
  }
})
