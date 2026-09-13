/**
 * 极简 Spine 播放器（spine-webgl 4.0，与游戏 Spine 版本 4.0.09 数据兼容）。
 *
 * 加载一组**同坐标空间**的骨架（atlas + 骨架 JSON + 贴图），按传入顺序渲染
 * （后写的在上层），供招募翻卡（elsa_rawcard + elsa_rawcard_desk）等游戏演出复用。
 * 加载渲染手法与 `scripts/dev/export-skin-models.mjs` 的浏览器端一致。
 *
 * 渲染上下文按 premultipliedAlpha 建立；`premultiply: true` 的层（图集无 pma 标记的
 * 直通 alpha 贴图，如 elsa_rawcard）在载入时先在 2D canvas 上做预乘，避免边缘发暗。
 * 相机取第一层骨架的设定包围盒**按高**铺满画布（世界单位），场景水平居中。
 */
import {
  SceneRenderer, TextureAtlas, GLTexture, Vector2,
  AtlasAttachmentLoader, SkeletonJson, SkeletonBinary, Skeleton,
  AnimationState, AnimationStateData
} from '@esotericsoftware/spine-webgl'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`贴图加载失败：${url}`))
    image.src = url
  })
}

/**
 * 演出资源内存缓存：抽卡面板在挂载后才建场景，若等点击再拉 atlas/skel/贴图会有
 * 可感知的点击延迟——进入招募页时先 `preloadGachaSpineAssets` 预热，之后
 * `createSpineScene` 直接命中缓存，秒开。
 */
const assetCache = new Map()

function cachedFetch(url) {
  let entry = assetCache.get(url)
  if (!entry) {
    entry = fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
      return response.arrayBuffer()
    })
    assetCache.set(url, entry)
    entry.catch(() => assetCache.delete(url))
  }
  return entry
}

/** 预取演出骨骼资源（atlas/skeleton/贴图），预热内存缓存；失败静默（播放时再兜底重试）。 */
export function preloadGachaSpineAssets(layers) {
  for (const def of layers) {
    cachedFetch(def.atlas)
      .then(buffer => new TextDecoder('utf-8').decode(buffer))
      .then(text => {
        // 解析 atlas 页名，把贴图一并预热
        const pageNames = text
          .split('\n')
          .map(line => line.trim())
          .filter(name => name && !name.includes(':') && !/^(size|filter|repeat|format)\b/.test(name))
        for (const name of pageNames) {
          try {
            const pageUrl = new URL(name, new URL(def.atlas, window.location.href)).href
            cachedFetch(pageUrl)
              .then(buffer => new Promise((resolve, reject) => {
                const image = new Image()
                image.onload = resolve
                image.onerror = reject
                image.src = URL.createObjectURL(new Blob([buffer]))
              }))
              .catch(() => {})
          } catch { /* 非页名行，忽略 */ }
        }
      })
      .catch(() => {})
    cachedFetch(def.skeleton).catch(() => {})
  }
}

/** 直通 alpha 贴图 → 预乘 alpha（PMA 渲染上下文需要）。 */
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
 * 创建场景。
 * @param {HTMLCanvasElement} canvas 已设置好 width/height 的画布
 * @param {Array} layers `{ key, atlas, skeleton, premultiply? }`，atlas 同目录下的贴图按
 *   图集内的 page 名称解析；数组顺序即绘制顺序（后写的在上层）。
 * @param {Object} options `{ fit?: 'height'|'width'|'bounds', pad?: number, padding?: number, initialAnimation?: string }`
 *   `pad`：取景结果**乘以** pad —— **大于 1 = 视野更大 = 内容更小**（与备份实现同口径：
 *   蛋袋 1.08 时袋身约占画布高 92%）。`padding`：`fit:'bounds'` 时的额外留白系数（默认 1.12）。
 */
export function createSpineScene(canvas, layers, options = {}) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true })
  if (!gl) return Promise.reject(new Error('WebGL 不可用'))
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  const renderer = new SceneRenderer(canvas, gl)
  const pad = Number(options.pad) > 0 ? Number(options.pad) : 1
  const padding = Number(options.padding) > 0 ? Number(options.padding) : 1.12
  let disposed = false
  let last = performance.now()
  let rafId = 0
  const actors = []
  /** 本场景创建的 GPU 纹理。`renderer.dispose()` 只释放渲染器自身的 shader/buffer，
   *  不会释放图集的 GLTexture —— 揭晓每换一个角色就重建一次场景，
   *  不在这里释放的话每次泄漏一整张贴图，多次抽卡后显存耗尽会把整个窗口挂死。 */
  const gpuTextures = []

  async function init() {
    for (const def of layers) {
      const atlasText = new TextDecoder('utf-8').decode(await cachedFetch(def.atlas))
      const atlas = new TextureAtlas(atlasText)
      for (const page of atlas.pages) {
        const url = new URL(page.name, new URL(def.atlas, window.location.href)).href
        const buffer = await cachedFetch(url)
        const blob = new Blob([buffer])
        const objectUrl = URL.createObjectURL(blob)
        try {
          const source = def.premultiply ? await loadPremultipliedCanvas(objectUrl) : await loadImage(objectUrl)
          const texture = new GLTexture(gl, source)
          page.setTexture(texture)
          gpuTextures.push(texture)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      }
      const attachmentLoader = new AtlasAttachmentLoader(atlas)
      let data
      if (def.binary) {
        // 二进制骨架（.skel，如 perform_bag）
        data = new SkeletonBinary(attachmentLoader).readSkeletonData(new Uint8Array(await cachedFetch(def.skeleton)))
      } else {
        data = new SkeletonJson(attachmentLoader).readSkeletonData(JSON.parse(new TextDecoder('utf-8').decode(await cachedFetch(def.skeleton))))
      }
      const skeleton = new Skeleton(data)
      // 显式设置皮肤（构造器不会自动套用）：蛋袋 perform_bag 的实附在 `def` 皮肤里，
      // 源码 `CreatSpineModel.BuildSpineObj(..., "def", ...)`；未指定时回落 default 皮肤。
      const skinName = def.skin ?? data.defaultSkin?.name
      if (skinName && data.findSkin(skinName)) skeleton.setSkinByName(skinName)
      skeleton.setToSetupPose()
      skeleton.updateWorldTransform()
      const state = new AnimationState(new AnimationStateData(data))
      // 与游戏一致的动画过渡（备份实现同款）：切换动画 0.12s 混合，避免跳帧
      state.data.defaultMix = 0.12
      actors.push({ key: def.key, data, skeleton, state })
    }
    if (!actors.length) throw new Error('没有可渲染的骨架')

    // fit:'bounds'：先在首层骨架上套用 initialAnimation（如揭晓小人的 win），按**运行时
    // 包围盒**取景（与 export-skin-models 的取景一致）。骨架数据头部的 setup 包围盒会
    // 被未启用的战斗特效附件（attack_circle 等）撑大，不能用于小人取景。
    if (options.fit === 'bounds') {
      const firstActor = actors[0]
      if (options.initialAnimation && firstActor.data.findAnimation(options.initialAnimation)) {
        firstActor.state.setAnimation(0, options.initialAnimation, false)
        firstActor.state.apply(firstActor.skeleton)
      }
      firstActor.skeleton.updateWorldTransform()
      const offset = new Vector2()
      const size = new Vector2()
      firstActor.skeleton.getBounds(offset, size, [])
      const boundWidth = Math.max(size.x, 1)
      const boundHeight = Math.max(size.y, 1)
      // pad 越大视野越大 → 内容越小；padding 为 bounds 留白（1.12 ≈ 四周 6% 边距）
      const height = Math.max(boundHeight, boundWidth / (canvas.width / canvas.height)) * padding * pad
      renderer.camera.viewportHeight = height
      renderer.camera.viewportWidth = height * (canvas.width / canvas.height)
      renderer.camera.position.set(
        offset.x + boundWidth / 2,
        offset.y + boundHeight / 2,
        0
      )
    } else {
      // 相机：取第一层骨架数据头部的场景包围盒（`skeleton.x/y/width/height`，比 setup pose
      // 的实时包围盒稳定）。`fit:'width'` 时宽度铺满、**底边对齐**视口下缘（桌面前景贴住
      // 画布底边，只裁掉场景顶部）；`fit:'height'`（默认）整包居中。
      const first = actors[0].data
      const sceneRect = {
        x: first.x ?? 0,
        y: first.y ?? 0,
        width: first.width || 1,
        height: first.height || 1
      }
      const aspect = canvas.width / canvas.height
      if (options.fit === 'width') {
        renderer.camera.viewportWidth = sceneRect.width * pad
        renderer.camera.viewportHeight = sceneRect.width / aspect * pad
        renderer.camera.position.set(
          sceneRect.x + sceneRect.width / 2,
          sceneRect.y + renderer.camera.viewportHeight / 2,
          0
        )
      } else {
        renderer.camera.viewportHeight = sceneRect.height * pad
        renderer.camera.viewportWidth = sceneRect.height * aspect * pad
        renderer.camera.position.set(
          sceneRect.x + sceneRect.width / 2,
          sceneRect.y + sceneRect.height / 2,
          0
        )
      }
    }
    renderer.camera.update()

    function frame(now) {
      if (disposed) return
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      for (const actor of actors) {
        actor.state.update(delta)
        actor.state.apply(actor.skeleton)
        actor.skeleton.updateWorldTransform()
      }
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      renderer.begin()
      for (const actor of actors) renderer.drawSkeleton(actor.skeleton, true)
      renderer.end()
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return api
  }

  const api = {
    /**
     * 播放动画（0 号轨道，替换当前动画）。
     * `onComplete` 仅在非循环动画自然播完时触发一次。
     */
    play(key, animName, { loop = false, onComplete } = {}) {
      const actor = actors.find(item => item.key === key)
      if (!actor || !actor.data.findAnimation(animName)) return false
      const entry = actor.state.setAnimation(0, animName, loop)
      if (onComplete && !loop) entry.listener = { complete: () => onComplete() }
      return true
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(rafId)
      try { renderer.dispose() } catch { /* 已释放则忽略 */ }
      for (const texture of gpuTextures) {
        try { texture.dispose() } catch { /* 已释放则忽略 */ }
      }
      gpuTextures.length = 0
    },
    /**
     * 主动丢弃 WebGL 上下文（`WEBGL_lose_context`）。画布随面板卸载而销毁的场景
     * （翻卡/蛋池每次抽卡新建画布）必须在卸载时调用：否则上下文要等 GC 回收，
     * 反复抽卡会累积几十个大纹理上下文，把 GPU 进程压垮（表现为整窗挂死、无法点击、
     * 开发者工具卡住，而 JS 主线程仍响应）。揭晓小人的画布跨角色复用同一上下文，
     * **逐角色 dispose 时不要调用**，只在揭晓整体卸载时调用。
     */
    dropContext() {
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch { /* 忽略 */ }
    }
  }

  return init()
}
