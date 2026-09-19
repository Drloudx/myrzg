/**
 * 抽卡 Spine 演出的 **Canvas2D 渲染后端**。
 *
 * ── 为什么存在 ──
 * 抽卡演出在微信内置浏览器（X5 内核）里曾出现画面渲染不全（图片以竖条/矩形块出现、
 * 有硬直边）。已排除的成因：
 *   - 不是文件没下载完（请求全部 200、content-type 正确）
 *   - 不是画布过大（微信端 DPR 从 2 降到 1、缓冲 487万→122万像素，无效）
 *   - 不是 WebGL 上下文丢失（未触发 lost）
 * 据此曾在本模块实现一套 Canvas2D 后端作为替代路径。**实机对比后效果不及 WebGL，
 * 现已切回 WebGL（见 `gachaRenderShared.activeBackend()`），本模块保留备用。**
 *
 * ── 与 WebGL 路径的关系 ──
 * **只新增分支，不改动 WebGL 路径**：非微信端继续走 gachaSpinePlayer 的 WebGL 实现，
 * 微信端走本模块。两者共用同一份相机数学与图层参数（见 buildCamera 回调），
 * 保证取景一致。
 *
 * ── 相机 → Canvas2D 变换的推导 ──
 * WebGL 侧 `OrthoCamera.update()` 是
 *   projection.ortho(-vw/2, vw/2, -vh/2, vh/2, ...) 然后 view.lookAt(position, ...)
 * 顶点经 MVP 后落到 NDC，再映射到屏幕：
 *   screenX = ndcX * canvas.width / 2 + canvas.width / 2
 *   screenY = canvas.height / 2 - ndcY * canvas.height / 2
 * 其中 ndcX = (worldX - camX) * 2 / vw、ndcY = (worldY - camY) * 2 / vh。
 * 合并即：
 *   screenX = (worldX - camX) * canvas.width / vw + canvas.width / 2
 *   screenY = canvas.height / 2 - (worldY - camY) * canvas.height / vh
 * 也就是一次 `setTransform(scaleX, 0, 0, -scaleY, offsetX, offsetY)`。
 * spine-canvas 的 SkeletonRenderer 直接按世界坐标绘制，正好接受这个变换。
 */
import {
  TextureAtlas, AtlasAttachmentLoader, SkeletonJson, SkeletonBinary,
  Skeleton, AnimationState, AnimationStateData, CanvasTexture, SkeletonRenderer
} from '@esotericsoftware/spine-canvas'
import { getCanvasBufferSize } from './gachaRenderShared'

/** 由 URL 推断图片 MIME 类型（与 WebGL 路径同逻辑）。 */
function imageMimeFromUrl(url) {
  const clean = String(url).split('?')[0].toLowerCase()
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** 按 URL 缓存 ArrayBuffer，避免同一资源重复下载（与 WebGL 路径同语义）。 */
const bufferCache = new Map()
function cachedFetch(url) {
  if (bufferCache.has(url)) return bufferCache.get(url)
  const p = fetch(url).then(res => {
    if (!res.ok) throw new Error(`加载失败 ${res.status}: ${url}`)
    return res.arrayBuffer()
  }).catch(err => {
    bufferCache.delete(url)
    throw err
  })
  bufferCache.set(url, p)
  return p
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`图片解码失败: ${url}`))
    image.src = url
  })
}

/**
 * 直通 alpha 贴图 → 预乘 alpha。
 *
 * 与 WebGL 路径保持一致：那边对 `def.premultiply` 的层走 loadPremultipliedCanvas，
 * 再交给 `UNPACK_PREMULTIPLY_ALPHA_WEBGL`。Canvas2D 的 drawImage 内部同样按预乘
 * 语义合成，故这里复刻同一份预处理，避免两条路径观感不同。
 */
async function loadPremultipliedCanvas(url) {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = frame.data
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255
    px[i] = Math.round(px[i] * a)
    px[i + 1] = Math.round(px[i + 1] * a)
    px[i + 2] = Math.round(px[i + 2] * a)
  }
  ctx.putImageData(frame, 0, 0)
  return canvas
}

/**
 * 带**三角面外扩**的 Canvas2D 渲染器。
 *
 * ── 为什么需要 ──
 * `SkeletonRenderer.drawTriangles` 对每个三角形单独 `ctx.clip()` + `drawImage`。
 * Canvas2D 的 clip 路径边缘会做抗锯齿，于是每个三角形四周都留一圈**半透明边**；
 * 相邻三角形拼在一起时，这些半透明边叠加/露底，形成肉眼可见的**网格接缝**
 * （实测：角色脸部/身体上成片蛛网状细线）。
 *
 * ── 修法 ──
 * 把每个三角形相对自身重心**向外放大一点点**再裁剪，使相邻三角形互相重叠，
 * 接缝被后画的三角形盖住。外扩量按**屏幕像素**折算，与缩放级别无关
 * （绘制时 ctx 已带相机变换，故先读出当前缩放再反算世界坐标下的外扩量）。
 *
 * 取 0.6 屏幕像素：足以盖住抗锯齿缝，又远小于三角形尺寸，不会造成轮廓外溢。
 */
const TRIANGLE_EXPAND_SCREEN_PX = 0.6

class SeamlessSkeletonRenderer extends SkeletonRenderer {
  drawTriangle(img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
    const ctx = this.ctx
    // 当前 ctx 的缩放（相机变换），把屏幕像素外扩量折算到世界坐标
    const t = ctx.getTransform()
    const scale = Math.max(1e-6, Math.hypot(t.a, t.b))
    const grow = TRIANGLE_EXPAND_SCREEN_PX / scale
    // 重心
    const cx = (x0 + x1 + x2) / 3
    const cy = (y0 + y1 + y2) / 3
    // 相对重心外扩（保持形状，只放大）
    const expand = (vx, vy) => {
      const d = Math.hypot(vx - cx, vy - cy) || 1
      const k = 1 + grow / d
      return [cx + (vx - cx) * k, cy + (vy - cy) * k]
    }
    const [ex0, ey0] = expand(x0, y0)
    const [ex1, ey1] = expand(x1, y1)
    const [ex2, ey2] = expand(x2, y2)

    const iw = img.width
    const ih = img.height
    const su0 = u0 * iw; const sv0 = v0 * ih
    const su1 = u1 * iw; const sv1 = v1 * ih
    const su2 = u2 * iw; const sv2 = v2 * ih

    ctx.beginPath()
    ctx.moveTo(ex0, ey0)
    ctx.lineTo(ex1, ey1)
    ctx.lineTo(ex2, ey2)
    ctx.closePath()

    // 用原始三顶点解纹理→世界的仿射矩阵（外扩只改裁剪路径，不改映射）
    const dx1 = x1 - x0; const dy1 = y1 - y0
    const dx2 = x2 - x0; const dy2 = y2 - y0
    const du1 = su1 - su0; const dv1 = sv1 - sv0
    const du2 = su2 - su0; const dv2 = sv2 - sv0
    const det = 1 / (du1 * dv2 - du2 * dv1)
    const a = (dv2 * dx1 - dv1 * dx2) * det
    const b = (dv2 * dy1 - dv1 * dy2) * det
    const c = (du1 * dx2 - du2 * dx1) * det
    const d = (du1 * dy2 - du2 * dy1) * det
    const e = x0 - a * su0 - c * sv0
    const f = y0 - b * su0 - d * sv0

    ctx.save()
    ctx.transform(a, b, c, d, e, f)
    ctx.clip()
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }
}
/**
 * 创建一个 Canvas2D Spine 场景，API 与 `createSpineScene`（WebGL）**完全一致**，
 * 以便上层（GachaCardPanel / GachaPetPanel / GachaRevealPanel）无感切换。
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array} layers `{ key, atlas, skeleton, premultiply?, binary?, skin? }`
 * @param {object} options 与 WebGL 路径同参（fit / pad / zoom / groundY / yOffset 等）
 * @param {Function} buildCamera 由调用方注入的相机计算回调
 *        `(cam) => void`，`cam` 暴露 `{ canvas, aspect, viewportWidth/Height, setPosition(x,y) }`。
 *        复用 WebGL 路径的取景逻辑，保证两端构图一致。
 */
export function createSpineCanvas2DScene(canvas, layers, options = {}, buildCamera) {
  const ctx2d = canvas.getContext('2d', { alpha: true })
  if (!ctx2d) return Promise.reject(new Error('Canvas2D 不可用'))

  const renderer = new SeamlessSkeletonRenderer(ctx2d)
  /**
   * **必须开启三角面渲染**：`SkeletonRenderer` 默认走 `drawImages`，而它内部有
   * `if (!(attachment instanceof RegionAttachment)) continue`——**跳过所有网格附件**。
   * 角色骨架的头发/身体正是网格（MeshAttachment），于是整个角色画不出来
   * （实测：桌面层只有区域附件、正常显示，角色层完全空白）。
   * `drawTriangles` 同时支持区域与网格附件；接缝问题由 SeamlessSkeletonRenderer 处理。
   */
  renderer.triangleRendering = true
  const pad = Number(options.pad) > 0 ? Number(options.pad) : 1
  const padding = Number(options.padding) > 0 ? Number(options.padding) : 1.12
  let disposed = false
  let paused = false
  let frameRunner = null
  let last = performance.now()
  let rafId = 0
  const actors = []

  // 相机状态（由 buildCamera 填充，语义与 WebGL 的 OrthoCamera 一致）
  const camera = {
    viewportWidth: canvas.width || 1,
    viewportHeight: canvas.height || 1,
    position: { x: 0, y: 0 },
    zoom: 1,
  }

  /** 供 buildCamera 使用的适配器：把相机数学与画布解耦。 */
  const cameraApi = {
    canvas,
    get viewportWidth() { return camera.viewportWidth },
    set viewportWidth(v) { camera.viewportWidth = v },
    get viewportHeight() { return camera.viewportHeight },
    set viewportHeight(v) { camera.viewportHeight = v },
    get aspect() { return canvas.width / canvas.height },
    setPosition(x, y) { camera.position.x = x; camera.position.y = y },
    update() { applyTransform() },
  }

  /** 世界坐标 → 画布像素的仿射变换（推导见文件头注释）。 */
  function applyTransform() {
    const w = canvas.width || 1
    const h = canvas.height || 1
    const vw = camera.viewportWidth || 1
    const vh = camera.viewportHeight || 1
    const scaleX = w / vw
    const scaleY = h / vh
    ctx2d.setTransform(
      scaleX, 0,
      0, -scaleY,
      w / 2 - camera.position.x * scaleX,
      h / 2 + camera.position.y * scaleY
    )
  }

  async function init() {
    for (const def of layers) {
      const atlasText = new TextDecoder('utf-8').decode(await cachedFetch(def.atlas))
      const atlas = new TextureAtlas(atlasText)
      for (const page of atlas.pages) {
        // 页名相对 atlas 目录解析（与 WebGL 路径同规则）
        const url = new URL(page.name, new URL(def.atlas, window.location.href)).href
        const buffer = await cachedFetch(url)
        const blob = new Blob([buffer], { type: imageMimeFromUrl(url) })
        const objectUrl = URL.createObjectURL(blob)
        try {
          const source = def.premultiply
            ? await loadPremultipliedCanvas(objectUrl)
            : await loadImage(objectUrl)
          page.setTexture(new CanvasTexture(source))
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
      const attachmentLoader = new AtlasAttachmentLoader(atlas)
      let data
      if (def.binary) {
        data = new SkeletonBinary(attachmentLoader)
          .readSkeletonData(new Uint8Array(await cachedFetch(def.skeleton)))
      } else {
        data = new SkeletonJson(attachmentLoader)
          .readSkeletonData(JSON.parse(new TextDecoder('utf-8').decode(await cachedFetch(def.skeleton))))
      }
      const skeleton = new Skeleton(data)
      const skinName = def.skin ?? data.defaultSkin?.name
      if (skinName && data.findSkin(skinName)) skeleton.setSkinByName(skinName)
      skeleton.setToSetupPose()
      skeleton.updateWorldTransform()
      const state = new AnimationState(new AnimationStateData(data))
      state.data.defaultMix = 0.12
      actors.push({ key: def.key, data, skeleton, state, yOffset: 0 })
    }
    if (!actors.length) throw new Error('没有可渲染的骨架')

    // 取景交给注入的回调（与 WebGL 路径共用同一份数学）
    if (typeof buildCamera === 'function') {
      buildCamera(cameraApi, actors, { pad, padding })
    } else {
      // 兜底：按首层数据包围盒居中
      const first = actors[0].data
      camera.viewportHeight = (first.height || 1) * pad
      camera.viewportWidth = camera.viewportHeight * cameraApi.aspect
      camera.position.x = (first.x || 0) + (first.width || 1) / 2
      camera.position.y = (first.y || 0) + (first.height || 1) / 2
    }
    applyTransform()

    // 各层 yOffset / stretchX（与 WebGL 路径同公式）
    const worldPerDesignPx = camera.viewportWidth / (canvas.clientWidth || canvas.width || 1)
    layers.forEach((def, index) => {
      actors[index].yOffset = -(Number(def.yOffset) || 0) * worldPerDesignPx
      if (def.stretchX) {
        const baseStretch = typeof def.stretchX === 'number' ? def.stretchX : 1.25
        const wideRatio = Math.max(1, cameraApi.aspect / (1534 / 750))
        actors[index].scaleX = baseStretch * wideRatio
        actors[index].skeleton.scaleX = actors[index].scaleX
      }
    })

    function resizeCardStage() {
      if (options.fit !== 'card-stage') return
      // 复用 WebGL 路径同一份缓冲尺寸逻辑（含微信降 DPR 与像素预算），避免两端不一致
      const { width, height } = getCanvasBufferSize(canvas)
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      camera.viewportWidth = camera.viewportHeight * (width / height)
      applyTransform()
      const worldPerPx = camera.viewportHeight / (canvas.clientHeight || 1)
      layers.forEach((def, index) => {
        actors[index].yOffset = -(Number(def.yOffset) || 0) * worldPerPx
        if (def.stretchX) {
          const baseStretch = typeof def.stretchX === 'number' ? def.stretchX : 1.25
          actors[index].scaleX = baseStretch * Math.max(1, (width / height) / (1534 / 750))
        }
      })
    }

    function frame(now) {
      if (disposed || paused) return
      resizeCardStage()
      let delta = Math.min((now - last) / 1000, 0.1)
      last = now
      for (const actor of actors) {
        actor.state.update(delta)
        actor.state.apply(actor.skeleton)
        actor.skeleton.y = actor.yOffset
        if (actor.scaleX) actor.skeleton.scaleX = actor.scaleX
        actor.skeleton.updateWorldTransform()
      }
      // Canvas2D：清空后按相机变换绘制（clearRect 受变换影响，故先重置再清）
      ctx2d.setTransform(1, 0, 0, 1, 0, 0)
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      applyTransform()
      for (const actor of actors) renderer.draw(actor.skeleton)
      rafId = requestAnimationFrame(frame)
    }
    frameRunner = frame
    rafId = requestAnimationFrame(frame)
    return api
  }

  const api = {
    play(key, animName, { loop = false, onComplete } = {}) {
      const actor = actors.find(item => item.key === key)
      if (!actor || !actor.data.findAnimation(animName)) return false
      const entry = actor.state.setAnimation(0, animName, loop)
      if (onComplete && !loop) entry.listener = { complete: () => onComplete() }
      return true
    },
    pause() {
      paused = true
      cancelAnimationFrame(rafId)
      rafId = 0
    },
    resume() {
      if (disposed || !paused || rafId || !frameRunner) return
      paused = false
      last = performance.now()
      rafId = requestAnimationFrame(frameRunner)
    },
    dispose() {
      disposed = true
      paused = true
      cancelAnimationFrame(rafId)
      // Canvas2D 无需释放 GPU 资源，置空引用帮助 GC
      actors.length = 0
    },
    /** Canvas2D 无 WebGL 上下文可丢，保留空实现以对齐 API。 */
    dropContext() {},
  }

  return init()
}
