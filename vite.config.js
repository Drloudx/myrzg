import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
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
  for (const [directory, entries] of groups) {
    const source = JSON.stringify(entries)
    const hash = hashBytes(source)
    const file = `assets/data-manifests/${directory.replace(/[^a-zA-Z0-9]+/g, '-')}${hash.slice(0, 16)}.json`
    descriptors[directory] = { file, hash }
    assets.push({ type: 'asset', fileName: file, source })
  }
  return { descriptors, assets }
}

function resourceManifestPlugin() {
  let assets = []
  return {
    name: 'bundled-resource-manifests',
    apply: 'build',
    config() {
      const manifest = collectResourceManifests(path.join(repoRoot, 'public'))
      assets = manifest.assets
      return { define: {
        __DATA_RESOURCE_MANIFESTS__: JSON.stringify(manifest.descriptors),
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
