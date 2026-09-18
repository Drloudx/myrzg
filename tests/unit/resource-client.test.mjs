import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
  assert.deepEqual(Object.keys(descriptors).sort(), ['data/dialogs/', 'data/parsed/', 'data/parsed/dungeons/', 'data/taskDialogs/'])
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
