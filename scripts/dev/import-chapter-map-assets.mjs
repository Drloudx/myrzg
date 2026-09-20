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

const root = fileURLToPath(new URL('../../', import.meta.url))
const sourceDir = path.resolve(root, '../4.24路资源包/assets/res/prefab/uiprefab/chapterpanel')
const target = path.join(root, 'public/images/chapters')
const apply = process.argv.includes('--apply')

/** 世界地图底图 + 6 个已开放章节的彩色拼块 + 标题条；锁定块另行评估。 */
const ASSETS = [
  { from: 'map_w1_bg.png', to: 'map_w1_bg.webp', note: '世界地图底图 1680x1680' },
  ...['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map(id => ({ from: `map_w1_${id}.png`, to: `map_w1_${id}.webp`, note: `第 ${id.slice(1)} 章彩色拼块` })),
  { from: 'map_w1_title.png', to: 'map_w1_title.webp', note: '「世界地图 · 选择需要前往的章节」标题条' }
]

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

const plan = []
for (const asset of ASSETS) {
  const from = path.join(sourceDir, asset.from)
  if (!fs.existsSync(from)) throw new Error(`缺少源素材：${from}`)
  const bytes = fs.readFileSync(from)
  const meta = await sharp(from).metadata()
  const out = await sharp(from).webp({ quality: 85, effort: 5 }).toBuffer()
  plan.push({
    ...asset,
    width: meta.width,
    height: meta.height,
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
  fs.writeFileSync(outPath, entry._out)
  if (hash(fs.readFileSync(outPath)) !== entry.outputSha256) throw new Error(`写入校验失败：${outPath}`)
}
console.log(`已写入 ${plan.length} 个文件到 public/images/chapters，合计 ${(total / 1048576).toFixed(2)} MB`)

const ownerPath = path.join(root, 'scripts/parse/chapterMapOwner.json')
fs.writeFileSync(ownerPath, JSON.stringify(ownerGrid), 'utf8')
console.log(`已写入拼块归属图 ${ownerGrid.resolution}x${ownerGrid.resolution}（${(ownerGrid.data.length / 1024).toFixed(1)} KB）到 scripts/parse/chapterMapOwner.json`)
