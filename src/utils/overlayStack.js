import { computed, shallowRef } from 'vue'

export function createOverlayStack() {
  const entries = shallowRef([])
  const hasActiveOverlay = computed(() => entries.value.length > 0)
  const topOverlay = computed(() => entries.value.reduce((top, entry) => (
    !top || entry.priority >= top.priority ? entry : top
  ), null))

  const remove = owner => {
    entries.value = entries.value.filter(entry => entry.owner !== owner)
  }
  const register = (owner, { priority = 0, close, canClose = () => true }) => {
    remove(owner)
    entries.value = [...entries.value, { owner, priority, close, canClose }]
    return () => remove(owner)
  }
  const dismissTopOverlay = () => {
    const entry = topOverlay.value
    if (!entry) return false
    // A non-closable update still consumes Back; the page underneath must not navigate.
    if (entry.canClose()) entry.close()
    return true
  }

  return { hasActiveOverlay, topOverlay, register, dismissTopOverlay }
}

export const overlayStack = createOverlayStack()
