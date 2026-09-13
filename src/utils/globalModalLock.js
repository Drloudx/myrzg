const owners = new Set()
let snapshots = []

export function acquireGlobalModalLock(owner) {
  if (owners.has(owner)) return
  if (!owners.size) {
    snapshots = [document.documentElement, document.body, document.querySelector('.app-container')]
      .filter(Boolean)
      .map(element => {
        const snapshot = {
          element,
          overflow: element.style.getPropertyValue('overflow'),
          priority: element.style.getPropertyPriority('overflow'),
          inert: element.inert
        }
        element.style.setProperty('overflow', 'hidden', 'important')
        if (element.matches('.app-container')) element.inert = true
        return snapshot
      })
  }
  owners.add(owner)
}

export function releaseGlobalModalLock(owner) {
  if (!owners.delete(owner) || owners.size) return
  for (const { element, overflow, priority, inert } of snapshots) {
    if (overflow) element.style.setProperty('overflow', overflow, priority)
    else element.style.removeProperty('overflow')
    element.inert = inert
  }
  snapshots = []
}
