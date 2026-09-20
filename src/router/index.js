import { createRouter, createWebHashHistory } from 'vue-router'
import { closeItemDetail } from '../utils/itemModalState'

const routes = [
  {
    path: '/runes',
    name: 'runes',
    component: () => import('../views/RunesView.vue')
  },
  {
    // 首页 = 物品图鉴（用户指定）。导航顺序里「物品图鉴」也是第一项，保持一致。
    path: '/',
    redirect: '/items'
  },
  {
    path: '/petseggs',
    name: 'PetsEggsView',
    component: () => import('../views/PetsEggsView.vue')
  },
  {
    path: '/achievement',
    name: 'AchievementView',
    component: () => import('../views/AchievementView.vue')
  },
  {
    path: '/recipes',
    name: 'RecipesView',
    component: () => import('../views/RecipesView.vue')
  },
  {
    path: '/items',
    name: 'items',
    component: () => import('../views/ItemsView.vue')
  },
  {
    path: '/furniture',
    name: 'furniture',
    component: () => import('../views/FurnitureView.vue')
  },
  {
    path: '/facilities',
    name: 'facilities',
    component: () => import('../views/FacilitiesView.vue')
  },
  {
    path: '/monsters',
    name: 'monsters',
    component: () => import('../views/MonstersView.vue')
  },
  {
    path: '/pets',
    name: 'pets',
    component: () => import('../views/PetsView.vue')
  },
  {
    path: '/equip',
    name: 'equip',
    component: () => import('../views/EquipsView.vue')
  },
  {
    path: '/rewards',
    name: 'RewardsView',
    component: () => import('../views/RewardsView.vue')
  },
  {
    path: '/heroes',
    name: 'heroes',
    component: () => import('../views/HeroesView.vue')
  },
  {
    path: '/partner-mails',
    name: 'partner-mails',
    component: () => import('../views/PartnerMailsView.vue')
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('../views/TasksView.vue')
  },
  {
    path: '/events',
    name: 'events',
    component: () => import('../views/EventsView.vue')
  },
  {
    path: '/exchange',
    name: 'exchange',
    component: () => import('../views/ExchangeView.vue')
  },
  {
    path: '/dungeons',
    name: 'dungeons',
    component: () => import('../views/DungeonsView.vue')
  },
  {
    path: '/chapters',
    name: 'chapters',
    component: () => import('../views/ChaptersView.vue')
  },
  {
    path: '/gacha',
    name: 'gacha',
    component: () => import('../views/GachaView.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  closeItemDetail()
  next()
})

/**
 * 路由分包预取。
 *
 * 为什么需要：`router-view` 对懒加载路由会**等异步组件 chunk 下载完再挂载**，
 * 这段等待里旧页面一直挂在屏幕上不动，真机走网络时就是用户感知的「先卡一下再切过去」。
 * 本机 localhost 实测切换仅 25~120ms（无感），但 chunk 走网络后这个延迟会被放大。
 *
 * 策略分两级，避免与首屏的数据加载抢带宽：
 *   1. `prefetchRouteChunks()` —— 首屏就绪后的空闲时间预取 17 个小 chunk（约 282 KB 未压缩）；
 *   2. `prefetchDeferredRouteChunks()` —— 用户在导航面板上表达跳转意图时，再补最重的
 *      `/gacha`（单个 244 KB，占总视图 chunk 近一半），不放进首屏空闲预取。
 * 预取只是 `import()`，会命中原有的模块缓存，不会重复下载、不执行页面组件。
 */
const ROUTE_LOADERS = routes
  .filter(route => typeof route.component === 'function')
  .map(route => ({ path: route.path, load: route.component }))

/** 首屏空闲预取时跳过的重包，交给导航意图触发。 */
const DEFERRED_PREFETCH_PATHS = new Set(['/gacha'])

/** 两次预取之间的间隔：既让首屏资源先落稳，也避免主线程被连续解析占满。 */
const PREFETCH_STEP_MS = 220

const prefetchPaths = paths => {
  // 串行 + 间隔下发：一次性并发 import 会在首屏图片/数据还没落稳时抢带宽，
  // 导致「检查全部图片已解码」的用例与弱网首屏偶发失败。逐个让出主线程更温和。
  const pending = ROUTE_LOADERS.filter(route => paths.has(route.path))
  const step = index => {
    if (index >= pending.length) return
    // 失败不重试也不上报：预取是纯优化，真正的导航仍会正常加载并自行处理错误。
    Promise.resolve().then(pending[index].load).catch(() => {})
    setTimeout(() => step(index + 1), PREFETCH_STEP_MS)
  }
  step(0)
}

const idlePrefetchPaths = new Set(
  ROUTE_LOADERS.map(route => route.path).filter(path => !DEFERRED_PREFETCH_PATHS.has(path))
)

/** 首屏空闲预取：跳过重包，逐个让出主线程，避免与首屏数据请求竞争。 */
export function prefetchRouteChunks() {
  const run = () => prefetchPaths(idlePrefetchPaths)
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1200)
}

/** 导航意图预取：补齐被首屏跳过的重包（在 `NavigationMenu` 打开时调用）。 */
let deferredPrefetched = false
export function prefetchDeferredRouteChunks() {
  if (deferredPrefetched) return
  deferredPrefetched = true
  prefetchPaths(DEFERRED_PREFETCH_PATHS)
}

export default router
