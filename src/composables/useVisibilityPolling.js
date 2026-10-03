import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * 前台可见时才跑的轮询。
 *
 * 为什么抽成共享工具：讨论区（5 秒）与右栏最新讨论（15/30 秒）都要这套逻辑，
 * 而它有四个必须同时满足的边界，散在两处写迟早会漏：
 *
 *   1. **标签页在后台就完全停**：`visibilityState === 'hidden'` 直接跳过这一次。
 *      （讨论区原本是 30 秒定时 + 切回刷新；右栏更早就踩过"用户停在某页不动就一直旧内容"。）
 *   2. **切回前台立刻补一次**：用户回来的第一眼就该是最新的，
 *      不该等下一个周期。`visibilitychange` 里立即 tick。
 *   3. **预渲染阶段不跑**：`document.prerendering` 为真时页面还没被真正看到，
 *      批量导航预渲染会凭空产生请求（Network Error Logging 里能看到一堆 prerender 请求）。
 *   4. **进后台期间不累积补跑**：只补一次，不是"欠了多少次补多少次"。
 *
 * 另外**不在回调里捕获错误**：调用方的刷新函数各自决定失败语义
 * （右栏失败要保留旧内容，讨论区失败要保住已有列表），
 * 这里统一吞掉会掩盖它们的差别。
 *
 * @param {() => (void | Promise<void>)} task 每次轮询要做的事（自行处理失败）
 * @param {{ intervalMs: number | (() => number), immediate?: boolean, enabled?: () => boolean }} options
 *   - `intervalMs` 每轮间隔，传函数可让它随页面/可见性变化（自适应）
 *   - `enabled` 为假时暂停（例如当前页面不需要这条轮询）
 * @returns {{ stop: () => void, start: () => void, tickNow: () => void }}
 */
export function useVisibilityPolling(task, { intervalMs, immediate = false, enabled } = {}) {
  let timer = 0
  let running = false
  let stopped = false

  const resolveInterval = () =>
    Math.max(1000, typeof intervalMs === 'function' ? intervalMs() : intervalMs)

  const isAllowed = () =>
    !stopped &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    !document.prerendering &&
    (typeof enabled === 'function' ? enabled() !== false : true)

  function clear() {
    if (timer) {
      clearTimeout(timer)
      timer = 0
    }
  }

  /** 跑一次并把下一次排上；用 setTimeout 递归而不是 setInterval，
   *  这样请求慢时不会堆积（setInterval 会在上一轮还没回来时继续叠） */
  async function run() {
    clear()
    if (stopped) return
    if (!isAllowed()) {
      // 不允许时也把下一次排上：等用户切回前台由 visibilitychange 立即补一次
      schedule()
      return
    }
    running = true
    try {
      await task()
    } finally {
      running = false
    }
    schedule()
  }

  function schedule() {
    clear()
    if (stopped) return
    timer = setTimeout(run, resolveInterval())
  }

  /** 立刻跑一次（切回前台、用户明确操作后调用），会重置周期 */
  function tickNow() {
    if (running) return
    run()
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') tickNow()
  }

  function start() {
    stopped = false
    document.addEventListener('visibilitychange', onVisibility)
    if (immediate) tickNow()
    else schedule()
  }

  function stop() {
    stopped = true
    clear()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  onMounted(start)
  onBeforeUnmount(stop)

  // `enabled` 从假变真时立刻补一次（例如从别的路由切进讨论区）
  if (typeof enabled === 'function') {
    watch(enabled, (now) => {
      if (now) tickNow()
    })
  }

  return { stop, start, tickNow }
}
