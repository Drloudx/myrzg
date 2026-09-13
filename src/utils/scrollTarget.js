const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

export const isScrollableElement = element => (
  element instanceof HTMLElement &&
  element.scrollHeight > element.clientHeight + 1 &&
  SCROLLABLE_OVERFLOW.has(getComputedStyle(element).overflowY)
)

export const resolveScrollTarget = preferred => {
  const preferredElement = typeof preferred === 'string'
    ? document.querySelector(preferred)
    : preferred
  if (isScrollableElement(preferredElement)) return preferredElement

  const appRoot = document.querySelector('.app-container')
  if (isScrollableElement(appRoot)) return appRoot

  return window
}

export const isScrollEventFromTarget = (event, target) => {
  const eventTarget = event?.target
  if (target === window) {
    return eventTarget === document ||
      eventTarget === document.documentElement ||
      eventTarget === document.body ||
      eventTarget === window
  }
  return eventTarget === target
}

export const getScrollMetrics = target => {
  if (target === window) {
    const root = document.scrollingElement || document.documentElement
    return {
      scrollTop: window.scrollY || root.scrollTop || 0,
      scrollHeight: root.scrollHeight,
      clientHeight: window.innerHeight
    }
  }

  return {
    scrollTop: target?.scrollTop || 0,
    scrollHeight: target?.scrollHeight || 0,
    clientHeight: target?.clientHeight || 0
  }
}

// Center a target in the actual page scroll root. On desktop the app shell,
// rather than the list wrapper, owns page-level scrolling.
export const alignElementInScrollTarget = (element, preferred) => {
  if (!element) return false
  const scrollTarget = resolveScrollTarget(preferred)
  if (scrollTarget === window) {
    const top = window.scrollY + element.getBoundingClientRect().top -
      (window.innerHeight - element.offsetHeight) / 2
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    return true
  }

  const targetRect = element.getBoundingClientRect()
  const rootRect = scrollTarget.getBoundingClientRect()
  const top = scrollTarget.scrollTop + targetRect.top - rootRect.top -
    (scrollTarget.clientHeight - targetRect.height) / 2
  scrollTarget.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
  return true
}
