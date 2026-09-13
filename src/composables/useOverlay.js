import { onBeforeUnmount, watch } from 'vue'
import { overlayStack } from '../utils/overlayStack.js'

export function useOverlay(visible, options) {
  const owner = Symbol('overlay')
  let unregister = null
  const stop = watch(visible, active => {
    unregister?.()
    unregister = active ? overlayStack.register(owner, options) : null
  }, { immediate: true, flush: 'sync' })

  onBeforeUnmount(() => {
    stop()
    unregister?.()
  })

  return { isTopOverlay: () => overlayStack.topOverlay.value?.owner === owner }
}
