/**
 * 抽卡演出渲染的**后端无关**共享工具。
 *
 * 抽出来单独成模块，是为了让 WebGL 后端（`gachaSpinePlayer`）与 Canvas2D 后端
 * （`gachaSpineCanvas2D`）共用同一份尺寸/环境判断，同时**避免两者互相 import
 * 形成循环依赖**（player 要 import canvas2d 做分流，canvas2d 又要用 player 的尺寸函数）。
 */

/** 单个渲染缓冲的像素预算上限（约 207 万像素 ≈ 1920×1080）。 */
const MAX_BUFFER_PIXELS = 1920 * 1080

/**
 * 是否微信内置浏览器（X5 内核）。
 *
 * 用 UA 判断即可——判断失误最坏结果是多走一条渲染路径，无功能风险。
 */
export function isWeChatWebView() {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent || '')
}

/**
 * 当前使用的渲染后端。
 *
 * **现状：一律走 `'webgl'`（原路径）。**
 * 微信 X5 内核下曾改用 Canvas2D 后端（`gachaSpineCanvas2D.js`），实机对比后
 * 效果不及 WebGL，故切回。Canvas2D 后端代码**保留备用**，需要时把下面的返回值
 * 改成 `isWeChatWebView() ? 'canvas2d' : 'webgl'` 即可恢复。
 *
 * 保留的背景记录：微信内置浏览器里抽卡演出曾出现画面渲染不全（图片呈竖条/矩形块、
 * 有硬直边），已逐一排除「文件没下载完」「画布过大（DPR 2→1 无效）」
 * 「WebGL 上下文丢失」三种成因。
 *
 * 抽卡页创建场景与画布缓冲尺寸都以此为准，保证「后端与 DPR 一起变」。
 */
export function activeBackend() {
  return 'webgl'
}

/**
 * 画布渲染缓冲尺寸。
 *
 * 为什么要压：手机竖屏时抽卡页会被 `GachaViewport` **旋转 90°**，于是卡片舞台画布的
 * CSS 尺寸是「屏幕高 × 屏幕宽」的横置版本（Pixel 5 上约 1623×750）。再乘 DPR 2
 * 就得到 3246×1500 ≈ **487 万像素**的渲染缓冲——比游戏原设计分辨率 1534×750
 * （115 万像素）大 4.2 倍。
 *
 * 加预算后：超出时按等比降低有效 DPR（不是直接砍分辨率），画质仍高于 1× 屏幕。
 */
export function getCanvasBufferSize(canvas) {
  const cssWidth = Math.max(1, canvas.clientWidth)
  const cssHeight = Math.max(1, canvas.clientHeight)
  // Canvas2D 后端（微信 X5）：DPR 封顶 1，不做 2× 超采样（CPU 绘制，越少越稳）
  let dpr = activeBackend() === 'canvas2d' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  // 像素预算：若 dpr 下的缓冲超出预算，等比降到刚好不超（下限 1，避免糊）
  const budgetDpr = Math.sqrt(MAX_BUFFER_PIXELS / (cssWidth * cssHeight))
  if (budgetDpr < dpr) dpr = Math.max(1, budgetDpr)
  // client 尺寸为局部设计坐标，忽略外层缩放、相机动画和手机 90° 横置。
  // 尤其小人画布 440×520 不等于其 380×380 宿主，不能按宿主的屏幕包围盒取景。
  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr))
  }
}

/** 由 URL 推断图片 MIME 类型（两条渲染路径共用）。 */
export function imageMimeFromUrl(url) {
  const clean = String(url).split('?')[0].toLowerCase()
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}
