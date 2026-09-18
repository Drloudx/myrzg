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

/**
 * 由 URL 推断图片 MIME 类型。
 *
 * 必要性：贴图走 `fetch → Blob → objectURL → Image` 加载。`new Blob([buf])` 不指定 type 时
 * blob URL 没有 Content-Type，浏览器**不再按内容嗅探**（PNG 时代能蒙对，WebP 会直接解码失败：
 * `贴图加载失败：blob:…`）。故必须显式给出类型。
 */
function imageMimeFromUrl(url) {
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

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
        // 页名用 TextureAtlas 解析器取，**不要用正则猜**：
        // atlas 里除页名外还有大量附件名（如 armA_l / bagHandle），正则会把它们误当页名，
        // 于是请求一堆不存在的文件（dev server 回 SPA fallback 的 HTML）→ Image 解码失败刷错误。
        let pageNames = []
        try {
          pageNames = new TextureAtlas(text).pages.map(page => page.name)
        } catch { /* 解析失败则跳过预热，播放时仍会正常加载 */ }
        for (const name of pageNames) {
          try {
            const pageUrl = new URL(name, new URL(def.atlas, window.location.href)).href
            cachedFetch(pageUrl)
              .then(buffer => new Promise((resolve, reject) => {
                const image = new Image()
                image.onload = resolve
                image.onerror = reject
                image.src = URL.createObjectURL(new Blob([buffer], { type: imageMimeFromUrl(pageUrl) }))
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
  let paused = false
  /** 渲染循环函数（init 内定义）；pause/resume 在外层 api 上，需要跨作用域引用。 */
  let frameRunner = null
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
        const blob = new Blob([buffer], { type: imageMimeFromUrl(url) })
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
      actors.push({ key: def.key, data, skeleton, state, yOffset: 0 })
    }
    if (!actors.length) throw new Error('没有可渲染的骨架')

    // fit:'bounds'：先在首层骨架上套用 initialAnimation（如揭晓小人的 win），按**运行时
    // 包围盒**取景（与 export-skin-models 的取景一致）。骨架数据头部的 setup 包围盒会
    // 被未启用的战斗特效附件（attack_circle 等）撑大，不能用于小人取景。
    const aspect = canvas.width / canvas.height
    if (options.fit === 'stage') {
      // 抽卡角色小人站台（英雄揭晓 HeroGachaShowPanel）：
      // 骨架 rootBone 原点 (0,0) 即角色双足接地点，必须绝对锚定在台座上平面中心。
      // 不能使用 fit: 'bounds'：技能圈/特效等附件会把包围盒偏向一侧并撑大数倍，
      // 导致小人漂移到台座左下方空地。
      // Unity 源码：heroAnimRoot pos=(0,-114)，stage pos=(0,-118)，Spine 局部原点(0,0)，
      // 缩放 0.0016 * 100 * 0.95 = 0.152 px/Spine单位。
      const vh = Number(options.viewportHeight) > 0 ? Number(options.viewportHeight) : 2400
      renderer.camera.viewportHeight = vh
      renderer.camera.viewportWidth = vh * aspect
      const groundY = Number(options.groundY) > 0 ? Number(options.groundY) : 202
      // groundY 是 CSS 设计像素。canvas.height 是 DPR 后的缓冲区尺寸，不能混算；
      // 否则同一个台座在手机上会随像素密度和外层缩放改变落脚点。
      const logicalHeight = canvas.clientHeight || canvas.height
      const cy = (groundY / logicalHeight * 2 - 1) * (vh / 2)
      renderer.camera.position.set(0, cy, 0)
    } else if (options.fit === 'bounds') {
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
        offset.y + boundHeight / 2 + (Number(options.yOffset) || 0),
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
      if (options.fit === 'card-stage') {
        // 翻卡演出相机（高度对齐 750 设计基准，宽度随画布横向延展铺满）：
        // 纵向视野与标准 1534×750 完全一致（zoom=1.2 时为 900），
        // 横向视野由 aspect 动态决定，保证艾尔莎大小/脸部特写焦距在任意比例下恒定，
        // 同时横向舞台与桌面完全盖满视口、桌沿两端无切断留空。
        const zoom = Number(options.zoom) > 1 ? Number(options.zoom) : 1.2
        const vh = (sceneRect.width * pad * zoom) / (1534 / 750)
        renderer.camera.viewportHeight = vh
        renderer.camera.viewportWidth = vh * aspect
        renderer.camera.position.set(
          sceneRect.x + sceneRect.width / 2,
          sceneRect.y + vh / 2,
          0
        )
      } else if (options.fit === 'width') {
        // `zoom` > 1 = 视野放大（内容变小）：骨架数据头包围盒按宽铺满的默认取景比游戏紧，
        // 站立姿的头顶会被画布上缘裁掉（用户实机对照）。**底边保持锚定**在数据包围盒下缘
        // ——桌面层 yOffset 是按最终视口高度换算的，桌沿依旧贴住画布底边。
        const zoom = Number(options.zoom) > 1 ? Number(options.zoom) : 1
        renderer.camera.viewportWidth = sceneRect.width * pad * zoom
        renderer.camera.viewportHeight = sceneRect.width / aspect * pad * zoom
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

    // 各层整体偏移（`yOffset`，设计像素，正值向下）：游戏桌面在独立的前景 3D 平面
    // （prefab gacha_BG.foreground），终帧构图桌沿贴画布底边——同一相机渲染时桌面层
    // 需要单独下移。Skeleton.x/y 是根偏移，在 updateWorldTransform 时叠加，动画不会覆盖。
    const worldPerDesignPx = renderer.camera.viewportWidth / (canvas.clientWidth || canvas.width || 1)
    layers.forEach((def, index) => {
      actors[index].yOffset = -(Number(def.yOffset) || 0) * worldPerDesignPx
      // `stretchX`：该层随 zoom 同步横向拉伸（Skeleton.scaleX，关于世界原点=画布中线），
      // 保证桌面这类全宽绘制在拉远后仍盖满画布（内容宽度 < 数据头包围盒宽度）。
      if (def.stretchX) {
        const baseStretch = typeof def.stretchX === 'number' ? def.stretchX : 1.25
        const wideRatio = Math.max(1, aspect / (1534 / 750))
        actors[index].scaleX = baseStretch * wideRatio
        actors[index].skeleton.scaleX = actors[index].scaleX
      }
    })

    function resizeCardStage() {
      if (options.fit !== 'card-stage') return
      const { width, height } = getCanvasBufferSize(canvas)
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      const aspect = width / height
      renderer.camera.viewportWidth = renderer.camera.viewportHeight * aspect
      renderer.camera.update()
      const worldPerPx = renderer.camera.viewportHeight / canvas.clientHeight
      layers.forEach((def, index) => {
        actors[index].yOffset = -(Number(def.yOffset) || 0) * worldPerPx
        if (def.stretchX) {
          const baseStretch = typeof def.stretchX === 'number' ? def.stretchX : 1.25
          actors[index].scaleX = baseStretch * Math.max(1, aspect / (1534 / 750))
        }
      })
    }

    function frame(now) {
      if (disposed || paused) return
      // 浏览器旋转、地址栏收起会改变舞台比例；更新取景而不重播抽卡动画。
      resizeCardStage()
      // 修改 canvas 缓冲区不会自动更新 WebGL viewport；共享画布重挂载也会改尺寸。
      // 必须与当前缓冲区同步，否则场景只绘制在旧宽度内，角色偏左、桌面出现竖缝。
      gl.viewport(0, 0, canvas.width, canvas.height)
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      for (const actor of actors) {
        actor.state.update(delta)
        actor.state.apply(actor.skeleton)
        actor.skeleton.y = actor.yOffset
        if (actor.scaleX) actor.skeleton.scaleX = actor.scaleX
        actor.skeleton.updateWorldTransform()
      }
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      renderer.begin()
      for (const actor of actors) renderer.drawSkeleton(actor.skeleton, true)
      renderer.end()
      rafId = requestAnimationFrame(frame)
    }
    frameRunner = frame
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
    /** 暂停渲染循环（共享场景无人引用时调用；上下文与纹理全部保留）。 */
    pause() {
      paused = true
      cancelAnimationFrame(rafId)
      rafId = 0
    },
    /** 恢复渲染循环（共享场景被再次获取时调用）。 */
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
      try { renderer.dispose() } catch { /* 已释放则忽略 */ }
      for (const texture of gpuTextures) {
        try { texture.dispose() } catch { /* 已释放则忽略 */ }
      }
      gpuTextures.length = 0
    },
    /**
     * 主动丢弃 WebGL 上下文（`WEBGL_lose_context`）。只在**整页离开招募页**清理共享
     * 场景时调用；抽卡过程中不要调用——反复建/丢上下文会让 GPU 进程累积待回收显存，
     * 几次抽卡后把窗口压垮（表现为整窗挂死、无法点击，而 JS 主线程仍响应）。
     */
    dropContext() {
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch { /* 忽略 */ }
    }
  }

  return init()
}

/**
 * ── 共享演出场景（跨抽卡复用）──
 * 每次抽卡都新建/销毁 WebGL 上下文 + 重新上传纹理的话：上下文要等 GC 回收，反复
 * 抽卡会累积待回收显存，几次后整个窗口挂死；而且每抽一次都要重新解析骨架、重新
 * 上传贴图（用户感知为「每次抽卡结束都把资源卸载了」）。共享场景把画布、上下文、
 * 纹理和解析好的骨架全部留在内存里，面板挂载/卸载只做 acquire/release（无人引用
 * 时暂停渲染循环，重新挂载秒开），离开 /gacha 时统一 `disposeSharedSpineScenes`。
 */
const sharedScenes = new Map()

/**
 * 获取（或创建）共享场景并把画布挂到 host。
 * @returns {{ canvas: HTMLCanvasElement, ready: Promise<object> }}
 *   `ready` resolve 为场景实例（与 createSpineScene 的 api 一致）；失败时 reject。
 * 视口宽高比与上次创建差超过 2%（相机取景依赖比例）时整场景重建。
 */
export function mountSharedSpineScene(key, host, layers, options = {}, styleCss = {}) {
  let entry = sharedScenes.get(key)
  let canvas = entry?.canvas || document.createElement('canvas')
  for (const [name, value] of Object.entries(styleCss)) canvas.style.setProperty(name, value)
  if (canvas.parentElement !== host) host.appendChild(canvas)
  const { width, height } = getCanvasBufferSize(canvas)
  if (entry) {
    const aspect = width / height
    const built = entry.canvas.width / entry.canvas.height
    if (Math.abs(aspect - built) / aspect > 0.02) {
      // 窗口比例变了：相机取景失效，整场景按新比例重建
      entry.scene?.dispose()
      entry.scene?.dropContext?.()
      entry.canvas.remove()
      canvas = document.createElement('canvas')
      for (const [name, value] of Object.entries(styleCss)) canvas.style.setProperty(name, value)
      host.appendChild(canvas)
      sharedScenes.delete(key)
      entry = null
    } else {
      if (entry.canvas.width !== width || entry.canvas.height !== height) {
        entry.canvas.width = width
        entry.canvas.height = height
      }
      entry.refs += 1
      entry.scene?.resume()
      if (entry.canvas.parentElement !== host) host.appendChild(entry.canvas)
      return { canvas: entry.canvas, ready: entry.ready }
    }
  }
  canvas.width = width
  canvas.height = height
  entry = { canvas, refs: 1, scene: null, ready: null }
  sharedScenes.set(key, entry)
  entry.ready = createSpineScene(canvas, layers, options).then(scene => {
    entry.scene = scene
    if (entry.refs <= 0) scene.pause()
    return scene
  }).catch(error => {
    canvas.remove()
    sharedScenes.delete(key)
    throw error
  })
  return { canvas, ready: entry.ready }
}

/** 释放一次引用；引用归零时暂停渲染循环（资源保留）。 */
export function releaseSharedSpineScene(key) {
  const entry = sharedScenes.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs === 0) entry.scene?.pause()
}

/** 离开 /gacha 时统一清理：释放渲染器与纹理并丢弃 WebGL 上下文。 */
export function disposeSharedSpineScenes() {
  for (const entry of sharedScenes.values()) {
    entry.scene?.dispose()
    entry.scene?.dropContext?.()
    entry.canvas.remove()
  }
  sharedScenes.clear()
}

/**
 * 共享裸画布（不绑定场景）：揭晓小人的骨架逐角色不同、但画布/上下文可以跨揭晓复用
 * （同一画布上重建场景时 `getContext` 返回同一上下文，旧场景纹理经 dispose 释放）。
 * 每次揭晓新建画布 = 每轮揭晓多建/丢一个上下文，同样会累积待回收显存。
 */
const sharedCanvases = new Map()

function getCanvasBufferSize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // client 尺寸为局部设计坐标，忽略外层缩放、相机动画和手机 90° 横置。
  // 尤其小人画布 440×520 不等于其 380×380 宿主，不能按宿主的屏幕包围盒取景。
  return {
    width: Math.max(1, Math.round(canvas.clientWidth * dpr)),
    height: Math.max(1, Math.round(canvas.clientHeight * dpr))
  }
}

export function acquireSharedCanvas(key, host, styleCss = {}) {
  let canvas = sharedCanvases.get(key)
  if (!canvas) {
    canvas = document.createElement('canvas')
    sharedCanvases.set(key, canvas)
  }
  for (const [name, value] of Object.entries(styleCss)) canvas.style.setProperty(name, value)
  if (canvas.parentElement !== host) host.appendChild(canvas)
  const { width, height } = getCanvasBufferSize(canvas)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return canvas
}

export function releaseSharedCanvas(key) {
  const canvas = sharedCanvases.get(key)
  canvas?.parentElement?.removeChild(canvas)
}

/**
 * 共享画布上的**多场景注册表**：同一画布/上下文上按 sceneKey 缓存场景（各含骨架与
 * 纹理），同一时刻只恢复当前场景的渲染循环、其余 pause。同一画布重建场景时
 * `getContext` 返回同一上下文，旧场景纹理经 dispose 释放。
 */
const canvasSceneRegistry = new Map() // canvasKey -> Map(sceneKey -> { scene, aspect })

/**
 * 在共享画布上获取（或创建）一个命名场景，并暂停该画布上的其他场景。
 * 场景按 sceneKey 缓存（如揭晓小人 `chibi:Npc_012:def`）——同一角色再次揭晓时
 * 零上传零解析，直接 resume + 重播动画。画布比例变化超过 2% 时该场景重建。
 */
export function mountCanvasScene(canvasKey, sceneKey, host, layers, options = {}, styleCss = {}) {
  const canvas = acquireSharedCanvas(canvasKey, host, styleCss)
  let scenes = canvasSceneRegistry.get(canvasKey)
  if (!scenes) {
    scenes = new Map()
    canvasSceneRegistry.set(canvasKey, scenes)
  }
  const aspect = canvas.width / canvas.height
  let entry = scenes.get(sceneKey)
  if (entry && Math.abs(entry.aspect - aspect) / aspect > 0.02) {
    // 视口比例变了：该场景相机取景失效，重建
    entry.scene.dispose()
    scenes.delete(sceneKey)
    entry = null
  }
  if (!entry) {
    // createSpineScene 内部首帧 rAF 由其 init 启动；此处先建后由下方 resume/pause 统一调度
    const created = createSpineScene(canvas, layers, options).then(scene => {
      entry.scene = scene
      if (entry.paused) scene.pause()
      return scene
    }).catch(error => {
      scenes.delete(sceneKey)
      throw error
    })
    entry = { scene: null, aspect, ready: created, paused: false }
    scenes.set(sceneKey, entry)
  }
  for (const [key, other] of scenes) {
    if (key === sceneKey) continue
    other.paused = true
    other.scene?.pause()
  }
  if (!entry.scene) {
    // 新场景仍在创建：清掉画布上其他场景暂停时残留的最后一帧（否则旧小人会
    // 和新角色的立绘/名牌同框，直到新场景渲染出第一帧）
    const gl = canvas.getContext('webgl')
    if (gl) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }
  entry.paused = false
  entry.scene?.resume()
  const ready = entry.ready ?? Promise.resolve(entry.scene)
  return { scene: entry.scene, ready }
}

/** 暂停共享画布上的全部场景（面板卸载时调用；场景与纹理保留）。 */
export function pauseCanvasScenes(canvasKey) {
  const scenes = canvasSceneRegistry.get(canvasKey)
  if (!scenes) return
  for (const entry of scenes.values()) {
    entry.paused = true
    entry.scene?.pause()
  }
}

/** 离开 /gacha 时丢弃共享裸画布与其上全部场景（含上下文）。 */
export function disposeSharedCanvases() {
  for (const [canvasKey, scenes] of canvasSceneRegistry) {
    for (const entry of scenes.values()) {
      entry.scene?.dispose()
      entry.scene?.dropContext?.()
    }
    scenes.clear()
    const canvas = sharedCanvases.get(canvasKey)
    canvas?.parentElement?.removeChild(canvas)
  }
  canvasSceneRegistry.clear()
  sharedCanvases.clear()
}
