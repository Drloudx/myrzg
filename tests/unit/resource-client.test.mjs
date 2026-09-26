import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createCachedLoader, createResourceClient, fetchJsonWithTimeout } from '../../src/utils/resourceClient.js'
import { validateResource } from '../../src/utils/resourceSchemas.js'
import { CLOUD_URL, getImageUrl, getLocalResourceUrl, handleImageFallback, resetImageFallback } from '../../src/utils/env.js'
import { collectResourceManifests } from '../../vite.config.js'

const hash = text => createHash('sha256').update(text).digest('hex')
const jsonResponse = value => new Response(JSON.stringify(value), { status: 200 })

test('concurrent and successful resource loads share one request', async () => {
  let requests = 0
  const client = createResourceClient({ fetchImpl: async () => { requests++; return jsonResponse({ items: [] }) } })
  const first = client.fetchResource('data/test.json')
  const second = client.fetchResource('/data/test.json')
  assert.equal(first, second)
  assert.deepEqual(await first, { items: [] })
  await client.fetchResource('data/test.json')
  assert.equal(requests, 1)
})

test('failed and invalid resources are evicted and can be retried', async () => {
  let requests = 0
  const client = createResourceClient({ fetchImpl: async () => {
    requests++
    if (requests === 1) return new Response('', { status: 503 })
    return jsonResponse(requests === 2 ? {} : { items: [] })
  } })
  const options = { validate: data => Array.isArray(data.items) }
  await assert.rejects(client.fetchResource('data/test.json', options), /503/)
  await assert.rejects(client.fetchResource('data/test.json', options), /Invalid resource/)
  assert.deepEqual(await client.fetchResource('data/test.json', options), { items: [] })
  assert.equal(requests, 3)
})

test('a failed cached loader shares pending work but retries the next invocation', async () => {
  let attempts = 0
  const load = createCachedLoader(async () => {
    if (++attempts === 1) throw new Error('temporary failure')
    return { ready: true }
  })
  const first = load()
  assert.equal(first, load())
  await assert.rejects(first, /temporary failure/)
  const success = load()
  assert.equal(success, load())
  assert.deepEqual(await success, { ready: true })
  assert.equal(attempts, 2)
})

test('CDN timeout aborts its request and falls back to the bundled data', async () => {
  let remoteSignal
  const fallbackPaths = []
  const client = createResourceClient({
    timeoutMs: 10,
    getBaseUrl: () => CLOUD_URL,
    onFallback: path => fallbackPaths.push(path),
    fetchImpl: async (url, { signal }) => {
      if (url.startsWith(CLOUD_URL)) {
        remoteSignal = signal
        return new Promise(() => {})
      }
      return jsonResponse({ bundled: true })
    }
  })
  assert.deepEqual(await client.fetchResource('data/test.json'), { bundled: true })
  assert.equal(remoteSignal.aborted, true)
  assert.deepEqual(fallbackPaths, ['data/test.json'])
})

test('the timeout also covers a stalled response body', async () => {
  await assert.rejects(fetchJsonWithTimeout('data/test.json', {
    timeoutMs: 10,
    fetchImpl: async () => ({ ok: true, arrayBuffer: () => new Promise(() => {}) })
  }), /timed out/)
})

test('a newer CDN table cannot be mixed into an older bundle', async () => {
  const body = JSON.stringify({ version: 'old-bundle' })
  const path = 'data/parsed/test.json'
  const manifestBody = JSON.stringify({ [path]: hash(body) })
  const calls = []
  let localBroken = true
  const client = createResourceClient({
    getBaseUrl: () => CLOUD_URL,
    manifests: { 'data/parsed/': { file: 'assets/test-manifest.json', hash: hash(manifestBody) } },
    fetchImpl: async url => {
      calls.push(url)
      if (url === 'assets/test-manifest.json') return new Response(manifestBody)
      if (url.startsWith(CLOUD_URL) || localBroken) return jsonResponse({ version: 'wrong-version' })
      return new Response(body)
    }
  })
  await assert.rejects(client.fetchResource(path), /version mismatch/)
  localBroken = false
  assert.deepEqual(await client.fetchResource(path), { version: 'old-bundle' })
  assert.equal(calls.filter(url => url === 'assets/test-manifest.json').length, 1)
  assert.equal(calls.filter(url => url.startsWith(CLOUD_URL)).length, 2)
  assert.ok(calls.some(url => url === `${CLOUD_URL}/${path}?v=${hash(body)}`))
  await assert.rejects(client.fetchResource('data/unknown/file.json'), /missing from this build/)
})

// 内联哈希（vite.config.js 的 INLINE_HASH_DIRECTORIES）存在的唯一目的就是**省掉
// 「先读 manifest 再读数据」这个串行 RTT**。所以这里断言的是「一次 manifest 请求都没发」，
// 而不只是「最终拿到了数据」——后者在退回 manifest 路径时也会通过，测不出这条优化。
test('inlined hashes skip the manifest round trip entirely', async () => {
  const path = 'data/parsed/test.json'
  const body = JSON.stringify({ ready: true })
  const calls = []
  const client = createResourceClient({
    manifests: { 'data/parsed/': { file: 'assets/test-manifest.json', hash: hash('{}') } },
    inlineHashes: { [path]: hash(body) },
    fetchImpl: async url => {
      calls.push(url)
      if (url.includes('test-manifest.json')) throw new Error('内联哈希命中时不应请求 manifest')
      return new Response(body)
    }
  })
  assert.deepEqual(await client.fetchResource(path), { ready: true })
  assert.equal(calls.length, 1, `只应有 1 个请求，实际 ${calls.join(', ')}`)
  assert.ok(calls[0].endsWith(`?v=${hash(body)}`), `数据 URL 应带内联哈希，实际 ${calls[0]}`)
})

test('a malformed inline hash falls back to the manifest', async () => {
  const path = 'data/parsed/test.json'
  const body = JSON.stringify({ ready: true })
  const manifestBody = JSON.stringify({ [path]: hash(body) })
  const calls = []
  const client = createResourceClient({
    manifests: { 'data/parsed/': { file: 'assets/test-manifest.json', hash: hash(manifestBody) } },
    inlineHashes: { [path]: 'not-a-sha256' },
    fetchImpl: async url => {
      calls.push(url)
      if (url === 'assets/test-manifest.json') return new Response(manifestBody)
      return new Response(body)
    }
  })
  assert.deepEqual(await client.fetchResource(path), { ready: true })
  assert.ok(calls.includes('assets/test-manifest.json'), '非法内联哈希必须退回 manifest 校验')
})

// 预热 manifest 的目的：把"点开详情才发起的 manifest 请求"提前到页面挂载时，
// 藏掉那个串行 RTT。所以断言的是「manifest 只被请求一次」，而不是「最终拿到了数据」。
test('prefetching a manifest makes the later detail fetch reuse it (one manifest request)', async () => {
  const path = 'data/parsed/dungeons/battle_1.json'
  const body = JSON.stringify({ rooms: [] })
  const manifestBody = JSON.stringify({ [path]: hash(body) })
  let manifestRequests = 0
  const calls = []
  const client = createResourceClient({
    manifests: { 'data/parsed/dungeons/': { file: 'assets/m-dungeons.json', hash: hash(manifestBody) } },
    fetchImpl: async url => {
      calls.push(url)
      if (url === 'assets/m-dungeons.json') { manifestRequests++; return new Response(manifestBody) }
      return new Response(body)
    }
  })
  client.prefetchManifest(path)
  await new Promise(resolve => setTimeout(resolve, 0)) // 让预热那轮微任务跑完
  assert.deepEqual(await client.fetchResource(path), { rooms: [] })
  assert.equal(manifestRequests, 1, '预热后真实请求不应再取一次 manifest')
  assert.ok(calls.some(url => url.endsWith(`?v=${hash(body)}`)), '数据请求仍要带 manifest 里的哈希')
})

test('prefetching an inlined directory issues no manifest request at all', () => {
  const path = 'data/parsed/items.json'
  const calls = []
  const client = createResourceClient({
    manifests: { 'data/parsed/': { file: 'assets/m-parsed.json', hash: hash('{}') } },
    inlineHashes: { [path]: hash('{}') },
    fetchImpl: async url => { calls.push(url); return new Response('{}') }
  })
  client.prefetchManifest(path)
  assert.deepEqual(calls, [], '已内联哈希的目录不需要预热 manifest')
})

test('a failed prefetch stays silent and the later fetch retries (no unhandled rejection)', async () => {
  const path = 'data/parsed/stages/stage_1.json'
  const body = JSON.stringify({ ok: true })
  const manifestBody = JSON.stringify({ [path]: hash(body) })
  let manifestRequests = 0
  const client = createResourceClient({
    manifests: { 'data/parsed/stages/': { file: 'assets/m-stages.json', hash: hash(manifestBody) } },
    // 首次 manifest 请求失败：预热必须吞掉它（否则这里会变成未处理的 rejection，
    // Node 默认会直接把测试进程打挂），且失败条目要从缓存移除以便真实请求重试。
    fetchImpl: async url => {
      if (url === 'assets/m-stages.json') {
        if (++manifestRequests === 1) throw new Error('network down')
        return new Response(manifestBody)
      }
      return new Response(body)
    }
  })
  client.prefetchManifest(path)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(await client.fetchResource(path), { ok: true })
  assert.equal(manifestRequests, 2, '预热失败后真实请求应重试 manifest')
})

test('prefetching an unknown directory is a harmless no-op', () => {
  const client = createResourceClient({ manifests: {}, fetchImpl: async () => new Response('{}') })
  assert.doesNotThrow(() => client.prefetchManifest('data/unknown/file.json'))
  assert.doesNotThrow(() => client.prefetchManifest(''))
  assert.doesNotThrow(() => client.prefetchManifest(null))
})

test('a corrupted manifest fails closed and is retryable', async () => {
  const path = 'data/parsed/test.json'
  const body = JSON.stringify({ ready: true })
  const manifestBody = JSON.stringify({ [path]: hash(body) })
  let manifestRequests = 0
  const client = createResourceClient({
    manifests: { 'data/parsed/': { file: 'assets/test-manifest.json', hash: hash(manifestBody) } },
    fetchImpl: async url => {
      if (url === 'assets/test-manifest.json') return new Response(++manifestRequests === 1 ? '{}' : manifestBody)
      return new Response(body)
    }
  })
  await assert.rejects(client.fetchResource(path), /version mismatch/)
  assert.deepEqual(await client.fetchResource(path), { ready: true })
  assert.equal(manifestRequests, 2)
})

test('notices remain refreshable instead of entering the immutable table cache', async () => {
  let requests = 0
  const client = createResourceClient({ fetchImpl: async () => jsonResponse({ revision: ++requests }) })
  assert.equal((await client.fetchResource('data/notice.json')).revision, 1)
  assert.equal((await client.fetchResource('data/notice.json')).revision, 2)
})

test('current parsed data satisfies schemas and missing required fields fail clearly', () => {
  for (const name of ['items', 'heroes', 'pets', 'monsters', 'tasks', 'recipes', 'monLevelStrength', 'item-sources']) {
    const path = `data/parsed/${name}.json`
    const data = JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8'))
    assert.equal(validateResource(path, data), true, name)
    assert.throws(() => validateResource(path, null), /数据格式不完整/)
    if (name !== 'item-sources') assert.throws(() => validateResource(path, {}), /数据格式不完整/)
  }
})

test('build manifests are grouped, content addressed and exclude live notices', () => {
  const publicDir = new URL('../../public/', import.meta.url)
  const { descriptors, assets } = collectResourceManifests(fileURLToPath(publicDir))
  // 期望值由**实际目录结构**推导，不写死清单：以前这里硬编码了目录名，
  // 后来新增 data/parsed/stages/ 没人同步，断言就一直失败却没人发现。
  // 只扫 public/data/（清单只覆盖它），不含 fonts/images/ui/update 下的其它 JSON。
  const expectedDirectories = (function collect(directory, prefix) {
    const found = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = `${prefix}${entry.name}`
      if (entry.isDirectory()) found.push(...collect(new URL(`${entry.name}/`, directory), `${child}/`))
      else if (entry.name.endsWith('.json') && child !== 'data/notice.json') found.push(`${child.slice(0, child.lastIndexOf('/') + 1)}`)
    }
    return found
  })(new URL('../../public/data/', import.meta.url), 'data/')
  assert.deepEqual(Object.keys(descriptors).sort(), [...new Set(expectedDirectories)].sort())
  for (const [directory, descriptor] of Object.entries(descriptors)) {
    const asset = assets.find(entry => entry.fileName === descriptor.file)
    assert.equal(hash(asset.source), descriptor.hash)
    const files = JSON.parse(asset.source)
    assert.equal(files['data/notice.json'], undefined)
    for (const [path, expected] of Object.entries(files)) {
      assert.ok(path.startsWith(directory))
      assert.equal(hash(readFileSync(new URL(path, publicDir))), expected)
    }
  }
  assert.ok(assets.find(asset => asset.fileName.includes('data-parsed-')).source.length < 5000)
})

function imageElement(source) {
  return { src: source, getAttribute() { return this.src } }
}

test('image fallbacks are finite, deduplicate events, and reset for a new source', () => {
  const source = `${CLOUD_URL}/images/test.png?v=build-one`
  const img = imageElement(source)
  let exhausted = 0
  const options = { source, onExhausted: () => { exhausted++ } }
  const firstEvent = { target: img, currentTarget: {} }
  assert.equal(handleImageFallback(firstEvent, options), true)
  assert.equal(img.src, '/images/test.png?v=build-one')
  assert.equal(handleImageFallback(firstEvent, options), true)
  assert.equal(img.src, '/images/test.png?v=build-one')
  assert.equal(handleImageFallback({ target: img }, options), true)
  assert.equal(img.src, '/ui/visibility-off.svg')
  for (let index = 0; index < 4; index++) assert.equal(handleImageFallback({ target: img }, options), false)
  assert.equal(exhausted, 1)
  const next = `${CLOUD_URL}/images/next.webp`
  img.src = next
  assert.equal(handleImageFallback({ target: img }, { source: next }), true)
  assert.equal(img.src, '/images/next.webp')
  resetImageFallback(img)
})

test('special portrait candidates preserve CDN then local order without cycles', () => {
  const source = `${CLOUD_URL}/images/portrait.webp`
  const candidate = `${CLOUD_URL}/images/portrait_alt.webp`
  const img = imageElement(source)
  const options = { source, candidates: [source, candidate, candidate] }
  const sequence = []
  for (let index = 0; index < 8; index++) {
    if (handleImageFallback({ target: img }, options)) sequence.push(img.src)
  }
  assert.deepEqual(sequence, ['/images/portrait.webp', candidate, '/images/portrait_alt.webp', '/ui/visibility-off.svg'])
})

test('image and local resource helpers preserve existing API paths', () => {
  assert.equal(getImageUrl('/ui/search.svg'), '/ui/search.svg')
  assert.equal(getImageUrl('Common_ItemIcon/item.webp'), '/images/Common_ItemIcon/item.webp')
  assert.equal(getImageUrl(`${CLOUD_URL}/images/item.webp`), `${CLOUD_URL}/images/item.webp`)
  assert.equal(getImageUrl({}), '')
  assert.equal(getLocalResourceUrl('/data/parsed/items.json'), 'data/parsed/items.json')
})
