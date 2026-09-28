import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * `utils/scrollTarget.js` 有两条路径，混用会造成每帧强制同步布局：
 *  - 热路径（滚动/指针等每帧处理器）：resolveScrollRootFromEvent / getScrollTop —— **绝不读几何属性**
 *  - 动作路径（点击、切页）：resolveScrollTarget / getScrollMetrics —— 读几何属性、会强制布局
 *
 * 下面用"读了就抛错的几何 getter"把这条约束钉死。注意断言一律用 assert.ok(值 === 期望)：
 * assert.equal 在失败时会 util.inspect 对象，反而会触发那个抛错的 getter，把真正的失败原因盖掉。
 */

// 注意：不能用对象展开 `{...guard}` —— 展开会**调用** getter（取的是值），桩会在构造时就抛。
const makeFakeElement = (name, scrollTop) => Object.defineProperties({ name, scrollTop }, {
  scrollHeight: { enumerable: true, get() { throw new Error(`${name} 读了 scrollHeight（会强制同步布局，热路径禁止）`) } },
  clientHeight: { enumerable: true, get() { throw new Error(`${name} 读了 clientHeight（会强制同步布局，热路径禁止）`) } },
  offsetParent: { enumerable: true, get() { throw new Error(`${name} 读了 offsetParent（会强制同步布局，热路径禁止）`) } }
})

const preferred = makeFakeElement('preferred', 320)
const appRoot = makeFakeElement('appRoot', 40)
const unrelated = makeFakeElement('unrelated', 999)

globalThis.HTMLElement = class HTMLElement {}
globalThis.window = { scrollY: 777 }
globalThis.document = {
  documentElement: {},
  body: {},
  querySelector: selector => (selector === '.app-container' ? appRoot : null)
}
globalThis.getComputedStyle = () => ({ overflowY: 'auto' })

const { resolveScrollRootFromEvent, getScrollTop, isScrollEventFromTarget, isScrollableElement, resolveScrollTarget } =
  await import('../../src/utils/scrollTarget.js')

test('热路径：命中本列表自己的滚动容器', () => {
  assert.ok(resolveScrollRootFromEvent({ target: preferred }, preferred) === preferred, '应返回 preferred')
})

test('热路径：桌面列表进入文档流后命中 .app-container', () => {
  assert.ok(resolveScrollRootFromEvent({ target: appRoot }, preferred) === appRoot, '应返回 appRoot')
})

test('热路径：文档级滚动命中 window', () => {
  for (const target of [document, document.documentElement, document.body, window]) {
    assert.ok(resolveScrollRootFromEvent({ target }, preferred) === window, '文档级滚动应返回 window')
  }
})

test('热路径：无关容器的滚动返回 null（弹窗正文、侧栏等不该触发本列表）', () => {
  assert.ok(resolveScrollRootFromEvent({ target: unrelated }, preferred) === null, 'preferred 不匹配时应为 null')
  assert.ok(resolveScrollRootFromEvent({ target: unrelated }, null) === null, '无 preferred 且无关时应为 null')
})

test('热路径：缺 preferred 或事件目标时返回 null（不误判成命中）', () => {
  assert.ok(resolveScrollRootFromEvent({}, null) === null, '无 target 应为 null')
  assert.ok(resolveScrollRootFromEvent({ target: undefined }, preferred) === null, 'target 为 undefined 应为 null')
  assert.ok(resolveScrollRootFromEvent(undefined, preferred) === null, '事件为 undefined 应为 null')
})

test('热路径：getScrollTop 只读滚动偏移，不碰几何属性', () => {
  assert.ok(getScrollTop(preferred) === 320, 'preferred.scrollTop')
  assert.ok(getScrollTop(window) === 777, 'window.scrollY')
  assert.ok(getScrollTop(null) === 0, 'null → 0')
  assert.ok(getScrollTop(undefined) === 0, 'undefined → 0')
})

test('动作路径：resolveScrollTarget / isScrollableElement 仍按几何判断（允许读 scrollHeight）', () => {
  assert.ok(typeof resolveScrollTarget === 'function')
  // isScrollableElement 首条判断是 instanceof HTMLElement，所以要用实例而不是字面量对象
  assert.ok(isScrollableElement(Object.assign(new HTMLElement(), { scrollHeight: 900, clientHeight: 300 })) === true, '可滚元素应为 true')
  assert.ok(isScrollableElement(Object.assign(new HTMLElement(), { scrollHeight: 300, clientHeight: 300 })) === false, '等高应为 false')
  assert.ok(isScrollableElement(null) === false, 'null 应为 false')
  assert.ok(isScrollableElement('not-an-element') === false, '非元素应为 false')
  // overflow 不在 auto/scroll/overlay 里 → 不可滚
  const original = globalThis.getComputedStyle
  globalThis.getComputedStyle = () => ({ overflowY: 'hidden' })
  try {
    assert.ok(isScrollableElement(Object.assign(new HTMLElement(), { scrollHeight: 900, clientHeight: 300 })) === false, 'overflowY=hidden 应为 false')
  } finally {
    globalThis.getComputedStyle = original
  }
})

test('isScrollEventFromTarget：window 目标要把 document/根元素都算上', () => {
  assert.ok(isScrollEventFromTarget({ target: document }, window) === true)
  assert.ok(isScrollEventFromTarget({ target: document.documentElement }, window) === true)
  assert.ok(isScrollEventFromTarget({ target: document.body }, window) === true)
  assert.ok(isScrollEventFromTarget({ target: unrelated }, window) === false)
  assert.ok(isScrollEventFromTarget({ target: preferred }, preferred) === true)
})
