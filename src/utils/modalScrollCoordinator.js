const activeOwners = new Set()

let scrollRoot = null
let restoreTop = 0
let operation = 0
let restoreFrame = 0

const cancelPendingRestore = () => {
  if (!restoreFrame) return
  cancelAnimationFrame(restoreFrame)
  restoreFrame = 0
}

const normalizeScrollTop = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : fallback
}

export const acquireModalScroll = (owner, root, requestedRestoreTop) => {
  if (!owner || !root) return false

  cancelPendingRestore()
  operation += 1

  if (activeOwners.has(owner)) return true

  if (activeOwners.size === 0 || scrollRoot !== root || !scrollRoot?.isConnected) {
    activeOwners.clear()
    scrollRoot = root
    restoreTop = normalizeScrollTop(requestedRestoreTop, root.scrollTop || 0)
  }

  activeOwners.add(owner)
  return true
}

export const scrollModalRootToTop = owner => {
  if (!activeOwners.has(owner) || !scrollRoot?.isConnected) return
  scrollRoot.scrollTo({ top: 0, behavior: 'auto' })
}

export const releaseModalScroll = (owner, options = {}) => {
  if (!activeOwners.delete(owner)) return false

  const currentOperation = ++operation
  if (activeOwners.size > 0) return false

  const root = scrollRoot
  const top = restoreTop
  scrollRoot = null
  restoreTop = 0

  if (options.restore === false || !root) return false

  const restore = () => {
    if (
      currentOperation !== operation ||
      activeOwners.size > 0 ||
      !root.isConnected ||
      options.canRestore?.() === false
    ) return

    root.scrollTo({ top, behavior: 'auto' })
  }

  restore()
  restoreFrame = requestAnimationFrame(() => {
    restoreFrame = 0
    restore()
  })
  return true
}

export const resetModalScrollCoordinator = () => {
  operation += 1
  cancelPendingRestore()
  activeOwners.clear()
  scrollRoot = null
  restoreTop = 0
}
