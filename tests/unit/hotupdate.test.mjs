import test from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, createHotUpdateClient } from '../../src/utils/hotupdate.js'

const manifest = { version: '1.1.0', downloadUrl: 'https://updates.example.test/dist-1.1.0.zip', body: 'Release notes' }

function fixture(overrides = {}) {
  const events = []
  const saved = new Map([['local_web_version', '9.9.9']])
  let current = { bundle: { id: 'active', version: '1.0.1' }, native: '1.0.0' }
  const updater = {
    notifyAppReady: async () => { events.push('ready') },
    current: async () => current,
    addListener: async () => {
      events.push('listen')
      return { remove: async () => { events.push('remove') } }
    },
    download: async () => { events.push('download'); return { id: 'new-bundle', version: '1.1.0' } },
    set: async ({ id }) => { events.push(`set:${id}`) },
    ...overrides
  }
  const client = createHotUpdateClient({
    updater,
    native: true,
    app: { getInfo: async () => ({ version: '1.0.0' }) },
    readJson: async url => url.includes('gitee.com') ? { tag_name: '1.0.0', assets: [] } : manifest,
    storage: () => ({ setItem: (key, value) => { events.push(`save:${value}`); saved.set(key, value) } }),
    logger: { warn() {} }
  })
  return { client, events, saved, setCurrent: value => { current = value } }
}

test('hot update comparison uses the actual bundle, not a stale stored version', async () => {
  const { client, events, saved } = fixture()
  const update = await client.checkHotUpdate()
  assert.equal(update.version, '1.1.0')
  assert.equal(update._currentVer, '1.0.1')
  assert.equal(saved.get('local_web_version'), '1.0.1')
  assert.deepEqual(events, ['ready', 'save:1.0.1'])
})

test('builtin and rolled-back bundles remain eligible for the same update', async () => {
  const { client, setCurrent, saved } = fixture()
  setCurrent({ bundle: { id: 'active', version: '1.1.0' }, native: '1.0.0' })
  assert.equal(await client.checkHotUpdate(), null)
  setCurrent({ bundle: { id: 'builtin', version: 'builtin' }, native: '1.0.0' })
  assert.equal((await client.checkHotUpdate()).version, '1.1.0')
  assert.equal(await client.getCurrentWebVersion(), '1.0.0')
  assert.equal(saved.get('local_web_version'), '1.0.0')
})

test('update listener cleanup finishes before activation without precommitting version', async () => {
  const { client, events, saved } = fixture()
  await client.applyHotUpdate(manifest)
  assert.deepEqual(events, ['listen', 'download', 'remove', 'set:new-bundle'])
  assert.equal(saved.get('local_web_version'), '9.9.9')
})

test('a failed download still removes its awaited listener', async () => {
  const { client, events, saved } = fixture({ download: async () => { throw new Error('download unavailable') } })
  await assert.rejects(client.applyHotUpdate(manifest), /download unavailable/)
  assert.deepEqual(events, ['listen', 'remove'])
  assert.equal(saved.get('local_web_version'), '9.9.9')
})

test('activation failures do not record the failed version and can be checked again', async () => {
  const { client, events, saved } = fixture({ set: async () => { throw new Error('cannot activate') } })
  await assert.rejects(client.applyHotUpdate(manifest), /cannot activate/)
  assert.deepEqual(events, ['listen', 'download', 'remove'])
  assert.equal(saved.get('local_web_version'), '9.9.9')
  assert.equal((await client.checkHotUpdate()).version, '1.1.0')
  assert.equal(saved.get('local_web_version'), '1.0.1')
})

test('readiness failures do not update the compatibility version', async () => {
  const { client, saved } = fixture({ notifyAppReady: async () => { throw new Error('not ready') } })
  await assert.rejects(client.checkHotUpdate(), /not ready/)
  assert.equal(saved.get('local_web_version'), '9.9.9')
})

test('invalid manifests fail before adding download listeners', async () => {
  const { client, events } = fixture()
  await assert.rejects(client.applyHotUpdate({ version: 'newest', downloadUrl: manifest.downloadUrl }))
  await assert.rejects(client.applyHotUpdate({ version: '1.1.0' }))
  assert.deepEqual(events, [])
})

test('concurrent checks share a pending operation but later checks refresh actual state', async () => {
  const { client, events } = fixture()
  const first = client.checkHotUpdate()
  assert.equal(first, client.checkHotUpdate())
  await first
  await client.checkHotUpdate()
  assert.equal(events.filter(event => event === 'ready').length, 2)
})

test('an unavailable APK release service does not prevent hot update checks', async () => {
  const { client } = fixture()
  assert.equal((await client.checkHotUpdate())._needsApkUpdate, false)
  const updater = { notifyAppReady: async () => {}, current: async () => ({ bundle: { id: 'builtin' }, native: '1.0.0' }) }
  const fallbackClient = createHotUpdateClient({
    updater,
    native: true,
    app: { getInfo: async () => ({ version: '1.0.0' }) },
    storage: () => null,
    logger: { warn() {} },
    readJson: async url => {
      if (url.includes('gitee.com')) throw new Error('APK service down')
      return manifest
    }
  })
  assert.equal((await fallbackClient.checkHotUpdate()).version, '1.1.0')
})

test('network check failures remain errors, not an already-current result', async () => {
  const client = createHotUpdateClient({
    native: true,
    updater: { notifyAppReady: async () => {}, current: async () => ({ bundle: { id: 'builtin' }, native: '1.0.0' }) },
    app: { getInfo: async () => ({ version: '1.0.0' }) },
    readJson: async () => { throw new Error('offline') },
    storage: () => null,
    logger: { warn() {} }
  })
  await assert.rejects(client.checkHotUpdate(), /offline/)
  await assert.rejects(client.checkHotUpdate(), /offline/)
})

test('web does not invoke native update APIs', async () => {
  const client = createHotUpdateClient({ native: false, updater: {} })
  assert.equal(await client.checkHotUpdate(), null)
  await client.applyHotUpdate(manifest)
})

test('numeric version comparison supports existing three- and four-part versions', () => {
  assert.equal(compareVersions('v1.2.0', '1.1.9'), 1)
  assert.equal(compareVersions('1.0.0.1', '1.0.0'), 1)
  assert.equal(compareVersions('1.0.0', '1.0.0.0'), 0)
  assert.equal(compareVersions('1.0.9', '1.0.10'), -1)
})
