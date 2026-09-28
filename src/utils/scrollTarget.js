const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay'])

/**
 * ⚠️ 这个函数是**动作路径**专用（点"回到顶部"、把某个元素滚到中间之类，一次用户操作调一次）。
 * 它为判断"哪个元素真的能滚"要读 `scrollHeight`，**会强制同步布局**——2026-09-27 实测在
 * 393×852 + CPU×4 下**单次 12~14ms、最高 46ms**。
 *
 * **绝对不要在热路径（滚动 / 指针 / resize 等每帧都会跑的处理器）里调用它。**
 * 热路径请改用 `resolveScrollRootFromEvent(event, preferred)`：滚动事件的 `target`
 * 本身就是滚动元素，比较一下即可，零布局开销。
 *
 * 这条护栏在开发期生效：1 秒内被调用超过 30 次就告警，指回这里。
 */
let devCallTimestamps = []
const warnIfCalledFromHotPath = () => {
  if (!import.meta.env?.DEV || typeof performance === 'undefined') return
  const now = performance.now()
  devCallTimestamps = devCallTimestamps.filter(timestamp => now - timestamp < 1000)
  devCallTimestamps.push(now)
  if (devCallTimestamps.length === 30) {
    console.warn(
      '[scrollTarget] resolveScrollTarget 在 1 秒内被调用了 30 次，像是被放进热路径了。\n' +
      '它读 scrollHeight 会强制同步布局（实测单次 12~14ms）。\n' +
      '热路径请改用 resolveScrollRootFromEvent(event, preferred) 或 getScrollTop(target)。'
    )
  }
}

export const isScrollableElement = element => (
  element instanceof HTMLElement &&
  element.scrollHeight > element.clientHeight + 1 &&
  SCROLLABLE_OVERFLOW.has(getComputedStyle(element).overflowY)
)

export const resolveScrollTarget = preferred => {
  warnIfCalledFromHotPath()
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

/**
 * **热路径**用：从滚动事件本身判断"这次滚动是不是发生在本列表的滚动根上"，是则返回该滚动根。
 *
 * 为什么不用 `resolveScrollTarget`：后者要读 `scrollHeight` 判断"哪个元素真的能滚"（强制同步布局，
 * 单次 12~14ms），而滚动事件每帧都触发——2026-09-27 实测它在 `/items` 每次滚动造成 **2 次**
 * 强制布局、占主线程 **13%**（长任务 40%）。而**滚动事件的 `target` 就是滚动元素**，
 * 直接比较即可，零布局开销。
 *
 * 语义与 `resolveScrollTarget` 保持一致：列表自己的滚动容器（移动端）→ 命中；
 * 桌面列表进入文档流、由 `.app-container` 滚动 → 命中；文档级滚动 → 命中；
 * 其它容器（弹窗正文、侧栏等无关滚动）→ 返回 null，调用方直接忽略。
 */
export const resolveScrollRootFromEvent = (event, preferred) => {
  const eventTarget = event?.target
  if (!eventTarget) return null
  if (preferred && eventTarget === preferred) return preferred

  const appRoot = document.querySelector('.app-container')
  if (appRoot && eventTarget === appRoot) return appRoot

  return isScrollEventFromTarget(event, window) ? window : null
}

/**
 * **热路径**用：只读滚动位置。`scrollTop` / `window.scrollY` 是**已算好的滚动偏移**，
 * 不会触发重排；而 `getScrollMetrics` 会连 `scrollHeight` 一起读（强制同步布局），
 * 只要滚动位置时不要用它。
 */
export const getScrollTop = target => {
  if (target === window) {
    return window.scrollY || document.scrollingElement?.scrollTop || 0
  }
  return target?.scrollTop || 0
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
