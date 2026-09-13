import assert from 'node:assert/strict'
import test from 'node:test'
import { createOverlayStack } from '../../src/utils/overlayStack.js'
import { createNativeBackHandler } from '../../src/utils/nativeBackHandler.js'

test('Back closes only the highest overlay and blocks non-closable updates', () => {
  const stack = createOverlayStack()
  const calls = []
  stack.register('page', { priority: 2000, close: () => calls.push('page') })
  const removeItem = stack.register('item', { priority: 5000, close: () => calls.push('item') })
  const removeUpdate = stack.register('update', { priority: 13000, canClose: () => false, close: () => calls.push('update') })
  assert.equal(stack.dismissTopOverlay(), true)
  assert.deepEqual(calls, [])
  removeUpdate()
  stack.dismissTopOverlay()
  assert.deepEqual(calls, ['item'])
  removeItem()
  stack.dismissTopOverlay()
  assert.deepEqual(calls, ['item', 'page'])
})

test('same-priority overlays dismiss newest first and report the empty stack', () => {
  const stack = createOverlayStack()
  const calls = []
  const first = stack.register('first', { close: () => calls.push('first') })
  const second = stack.register('second', { close: () => calls.push('second') })
  stack.dismissTopOverlay()
  assert.deepEqual(calls, ['second'])
  second()
  first()
  assert.equal(stack.hasActiveOverlay.value, false)
  assert.equal(stack.dismissTopOverlay(), false)
})

test('native listener exists only while needed, without custom history or exit calls', async () => {
  let callback
  const calls = []
  const handler = createNativeBackHandler({
    async addListener(name, listener) {
      calls.push(name)
      callback = listener
      return { async remove() { calls.push('remove') } }
    }
  }, () => calls.push('close'))
  await handler.setActive(false)
  assert.deepEqual(calls, [])
  await handler.setActive(true)
  await handler.setActive(true)
  callback({ canGoBack: true })
  await handler.setActive(false)
  callback({ canGoBack: false })
  await handler.dispose()
  assert.deepEqual(calls, ['backButton', 'close', 'remove'])
})

test('unmount during asynchronous registration removes the late listener exactly once', async () => {
  let resolveListener
  let removed = 0
  const handler = createNativeBackHandler({
    addListener() { return new Promise(resolve => { resolveListener = resolve }) }
  }, () => assert.fail('disposed handler must not dismiss'))
  const added = handler.setActive(true)
  await Promise.resolve()
  const disposed = handler.dispose()
  resolveListener({ async remove() { removed++ } })
  await added
  await disposed
  assert.equal(removed, 1)
})

test('registration failure is reported and the next overlay can retry', async () => {
  let attempts = 0
  const errors = []
  const handler = createNativeBackHandler({
    async addListener() {
      if (++attempts === 1) throw new Error('bridge unavailable')
      return { async remove() {} }
    }
  }, () => {}, error => errors.push(error.message))
  await handler.setActive(true)
  await handler.setActive(false)
  await handler.setActive(true)
  await handler.dispose()
  assert.equal(attempts, 2)
  assert.deepEqual(errors, ['bridge unavailable'])
})

test('failed native removal retains its handle for cleanup retry', async () => {
  let added = 0
  let removed = 0
  const errors = []
  const handler = createNativeBackHandler({
    async addListener() {
      added++
      return { async remove() { if (++removed === 1) throw new Error('transient bridge failure') } }
    }
  }, () => {}, error => errors.push(error.message))
  await handler.setActive(true)
  await handler.setActive(false)
  await handler.setActive(true)
  await handler.dispose()
  assert.equal(added, 1)
  assert.equal(removed, 2)
  assert.equal(errors.length, 1)
})
