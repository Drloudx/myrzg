/**
 * 导入章节地图素材（世界地图底图 + 章节拼块）到 public/images/chapters。
 *
 * 源：4.24路资源包/assets/res/prefab/uiprefab/chapterpanel/（游戏原图，PNG）
 * 目标：public/images/chapters/*.webp
 *
 * 为什么转 WebP：仓库里的运行时图片已经统一为 `.webp`（见 2026-09-18 日报），
 * 新素材按同一口径导入；源 PNG 始终留在资源包里，不受影响，需要原图可直接重取。
 * 默认只预览，`--apply` 才写入；写入时记录源文件 SHA-256 与目标体积。
 *
 * 用法：
 *   node scripts/dev/import-chapter-map-assets.mjs            # 预览
 *   node scripts/dev/import-chapter-map-assets.mjs --apply
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  ATLAS_PATH, STAGE_PLATFORM_RECT, STAGE_PLATFORM_LOCKED_RECT, AREA_TITLE_RECT, STAGE_CRYSTAL_RECT, STAGE_CRYSTAL_SMALL_RECT
} from '../parse/chapterMapLayout.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const resDir = path.resolve(root, '../4.24路资源包/assets/res')
const sourceDir = path.join(resDir, 'prefab/uiprefab/chapterpanel')
const target = path.join(root, 'public/images/chapters')
const apply = process.argv.includes('--apply')

/**
 * 地区/副本节点的图标名直接读构建产物里的 `icon` 字段，不另维护一份清单——
 * 清单一旦和产物脱节就会出现「有节点没图」的空白。
 */
function collectIcons() {
  const file = path.join(root, 'public/data/parsed/chapters.json')
  const areas = new Set(), instances = new Set()
  if (!fs.existsSync(file)) return { areas: [...areas], instances: [...instances] }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const region of Object.values(data.map?.regions || {})) {
    for (const node of region.nodes || []) {
      if (!node.icon) continue
      if (node.kind === 'area') areas.add(node.icon)
      if (node.kind === 'instance') instances.add(node.icon)
    }
  }
  return { areas: [...areas].sort(), instances: [...instances].sort() }
}
const { areas: AREA_ICONS, instances: INSTANCE_ICONS } = collectIcons()

/** 世界地图底图 + 6 个已开放章节的彩色拼块 + 标题条；锁定块另行评估。 */
const ASSETS = [
  { from: path.join(sourceDir, 'map_w1_bg.png'), to: 'map_w1_bg.webp', note: '世界地图底图 1680x1680' },
  ...['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map(id => ({ from: path.join(sourceDir, `map_w1_${id}.png`), to: `map_w1_${id}.webp`, note: `第 ${id.slice(1)} 章彩色拼块` })),
  { from: path.join(sourceDir, 'map_w1_title.png'), to: 'map_w1_title.webp', note: '「世界地图 · 选择需要前往的章节」标题条' },
  // 章节地区地图底图（点进章节后的那张关卡地图）。8 张全导——sp1/sp2 当前在黑名单里用不到，
  // 但 chapters.json 同样保留这些章节的数据，只导一半会让「取消隐藏」变成半坏状态。
  // 单张 2~4.5 MB 的整屏地图，用 q80（世界地图那套小图仍用 q85）。
  ...['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'sp1', 'sp2'].map(id => ({
    from: path.join(resDir, `texture/area/bg/map_w1_${id}_bg.png`),
    to: `map_w1_${id}_bg.webp`,
    quality: 80,
    note: `${id} 地区地图底图`
  })),
  // 关卡节点石台：从 MapPanelAtlas 切出来（见 chapterMapLayout.mjs 的说明）
  { from: path.join(resDir, ATLAS_PATH), to: 'stage_platform.webp', crop: STAGE_PLATFORM_RECT, note: '关卡节点石台（三水晶 + 橙宝石）' },
  { from: path.join(resDir, ATLAS_PATH), to: 'stage_platform_locked.webp', crop: STAGE_PLATFORM_LOCKED_RECT, note: '关卡节点石台（未开放，灰）' },
  { from: path.join(resDir, ATLAS_PATH), to: 'area_title.webp', crop: AREA_TITLE_RECT, note: '地区名称牌边框' },
  { from: path.join(resDir, ATLAS_PATH), to: 'stage_crystal.webp', crop: STAGE_CRYSTAL_RECT, note: '关卡石台中间的大宝石' },
  { from: path.join(resDir, ATLAS_PATH), to: 'stage_crystal_small.webp', crop: STAGE_CRYSTAL_SMALL_RECT, note: '关卡石台两侧的小宝石' },
  // 地区节点立体图：按 area.icon 命名，只导有 icon 的
  ...AREA_ICONS.map(icon => ({
    from: path.join(resDir, `texture/area/icon/${icon}.png`),
    to: `area/${icon}.webp`,
    note: `地区节点立体图 ${icon}`
  })),
  // 副本入口图：按 instance.icon 命名。这批图标散在两个目录（map_w1_cN_dM 在 area/icon、
  // map_fb_* 在 instancepanel），按顺序取第一个存在的。
  ...INSTANCE_ICONS.map(icon => ({
    from: [
      path.join(resDir, `texture/area/icon/${icon}.png`),
      path.join(resDir, `texture/uipanel/instancepanel/${icon}.png`)
    ],
    to: `instance/${icon}.webp`,
    note: `副本入口图 ${icon}`
  }))
]

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

const plan = []
for (const asset of ASSETS) {
  // from 允许是候选路径数组：取第一个存在的
  const from = (Array.isArray(asset.from) ? asset.from : [asset.from]).find(p => fs.existsSync(p))
  if (!from) throw new Error(`缺少源素材：${[].concat(asset.from).join(' 或 ')}`)
  const bytes = fs.readFileSync(from)
  const meta = await sharp(from).metadata()
  // 图集里的 sprite 需要先裁出来；裁剪矩形是构建期常量（见 chapterMapLayout.mjs）
  const pipeline = asset.crop
    ? sharp(from).extract({ left: asset.crop.x, top: asset.crop.y, width: asset.crop.w, height: asset.crop.h })
    : sharp(from)
  const out = await pipeline.webp({ quality: asset.quality ?? 85, effort: 5 }).toBuffer()
  const size = asset.crop ? { width: asset.crop.w, height: asset.crop.h } : { width: meta.width, height: meta.height }
  plan.push({
    ...asset,
    source: path.relative(path.resolve(root, '..'), from).replaceAll('\\', '/'),
    width: size.width,
    height: size.height,
    sourceBytes: bytes.length,
    sourceSha256: hash(bytes),
    outputBytes: out.length,
    outputSha256: hash(out),
    _out: out
  })
}

const total = plan.reduce((sum, entry) => sum + entry.outputBytes, 0)

/**
 * 拼块归属图：地图上每个格子属于哪一块。
 *
 * 为什么需要：拼块的**包围盒**重叠严重（c0 的框有 57% 被 c3 压住），按矩形做点击热区会点错章节；
 * 而拼块的**不透明区域**也有 7.8% 互相重叠，所以「命中不透明像素」还要叠加渲染顺序才正确。
 * 构建期把「该像素最终由哪一块画在上面」烘焙成一张低分辨率归属图，运行时按格查表即可，
 * 既不用 canvas 取 alpha（原生端 CDN 跨域会让 canvas 被污染），也不依赖浏览器命中测试。
 */
async function buildOwnerGrid(resolution = 256) {
  const { CHAPTER_TILE_RECTS, CHAPTER_MAP_SIZE } = await import('../parse/chapterMapLayout.mjs')
  const ids = Object.keys(CHAPTER_TILE_RECTS)
  const { w: W, h: H } = CHAPTER_MAP_SIZE
  const owner = new Int8Array(W * H).fill(-1)
  for (let index = 0; index < ids.length; index++) {
    const { x: ox, y: oy, w, h } = CHAPTER_TILE_RECTS[ids[index]]
    const source = path.join(sourceDir, `map_w1_${ids[index]}.png`)
    const { data } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] <= 128) continue
        const gx = ox + x, gy = oy + y
        if (gx < W && gy < H) owner[gy * W + gx] = index
      }
    }
  }
  const cell = W / resolution
  const grid = new Int8Array(resolution * resolution)
  for (let gy = 0; gy < resolution; gy++) {
    for (let gx = 0; gx < resolution; gx++) {
      const sx = Math.min(W - 1, Math.floor((gx + 0.5) * cell))
      const sy = Math.min(H - 1, Math.floor((gy + 0.5) * cell))
      grid[gy * resolution + gx] = owner[sy * W + sx]
    }
  }
  const parts = []
  let current = grid[0], run = 0
  for (const value of grid) {
    if (value === current) run++
    else { parts.push(`${current}:${run}`); current = value; run = 1 }
  }
  parts.push(`${current}:${run}`)
  return { resolution, ids, data: parts.join(',') }
}

const ownerGrid = apply ? await buildOwnerGrid() : null

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'preview',
  source: path.relative(root, sourceDir).replaceAll('\\', '/'),
  target: path.relative(root, target).replaceAll('\\', '/'),
  files: plan.length,
  sourceTotalMB: +(plan.reduce((sum, entry) => sum + entry.sourceBytes, 0) / 1048576).toFixed(2),
  outputTotalMB: +(total / 1048576).toFixed(2),
  plan: plan.map(({ _out, ...rest }) => rest)
}, null, 1))

if (!apply) process.exit(0)

fs.mkdirSync(target, { recursive: true })
for (const entry of plan) {
  const outPath = path.join(target, entry.to)
  // 地区/副本节点图放在 area/ 与 instance/ 子目录，先建目录
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, entry._out)
  if (hash(fs.readFileSync(outPath)) !== entry.outputSha256) throw new Error(`写入校验失败：${outPath}`)
}
console.log(`已写入 ${plan.length} 个文件到 public/images/chapters，合计 ${(total / 1048576).toFixed(2)} MB`)

const ownerPath = path.join(root, 'scripts/parse/chapterMapOwner.json')
fs.writeFileSync(ownerPath, JSON.stringify(ownerGrid), 'utf8')
console.log(`已写入拼块归属图 ${ownerGrid.resolution}x${ownerGrid.resolution}（${(ownerGrid.data.length / 1024).toFixed(1)} KB）到 scripts/parse/chapterMapOwner.json`)
