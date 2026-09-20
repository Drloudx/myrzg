/**
 * 重测章节拼块在世界地图底图上的坐标（只读，打印结果供人工更新 chapterMapLayout.mjs）。
 *
 * 原理：`map_w1_cN_lock.png` 是底图对应区域的单色版，因此可以用模板匹配在 `map_w1_bg.png`
 * 上定位。先 1/4 分辨率粗搜，再在全分辨率上做 ±6px 精修，最后与随机位置基线对比——
 * 分数远低于基线才说明是真实匹配，而不是碰巧。
 *
 * 用法：node scripts/dev/measure-chapter-map-tiles.mjs
 */
import sharp from 'sharp'

const dir = 'E:/Desktop/html/myrzg/4.24路资源包/assets/res/prefab/uiprefab/chapterpanel/'
const COARSE = 4

const raw = async (file, w, h, channel) => {
  let pipe = sharp(file)
  if (w) pipe = pipe.resize(w, h, { fit: 'fill' })
  pipe = channel === 'alpha' ? pipe.ensureAlpha().extractChannel(3) : pipe.grayscale()
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

const baseMeta = await sharp(dir + 'map_w1_bg.png').metadata()
const BW = baseMeta.width, BH = baseMeta.height
const cw = Math.round(BW / COARSE), ch = Math.round(BH / COARSE)
const baseCoarse = await raw(dir + 'map_w1_bg.png', cw, ch, 'gray')
const baseFull = await raw(dir + 'map_w1_bg.png', null, null, 'gray')

const locate = async tile => {
  const meta = await sharp(dir + tile).metadata()
  const tw = meta.width, th = meta.height
  const twc = Math.round(tw / COARSE), thc = Math.round(th / COARSE)
  const tileCoarse = await raw(dir + tile, twc, thc, 'gray')
  const maskCoarse = await raw(dir + tile, twc, thc, 'alpha')
  const coarseSamples = []
  for (let y = 0; y < thc; y++) for (let x = 0; x < twc; x++) if (maskCoarse.data[y * twc + x] > 200) coarseSamples.push(y * twc + x)

  let best = { score: Infinity, x: 0, y: 0 }
  for (let oy = 0; oy + thc <= ch; oy++) {
    for (let ox = 0; ox + twc <= cw; ox++) {
      let sum = 0
      for (const p of coarseSamples) {
        const ty = (p / twc) | 0, tx = p % twc
        sum += Math.abs(baseCoarse.data[(oy + ty) * cw + ox + tx] - tileCoarse.data[p])
      }
      const score = sum / coarseSamples.length
      if (score < best.score) best = { score, x: ox, y: oy }
    }
  }

  const tileFull = await raw(dir + tile, null, null, 'gray')
  const maskFull = await raw(dir + tile, null, null, 'alpha')
  const samples = []
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (maskFull.data[y * tw + x] > 200) samples.push(y * tw + x)
  const scoreAt = (ox, oy) => {
    let sum = 0
    for (const p of samples) {
      const ty = (p / tw) | 0, tx = p % tw
      sum += Math.abs(baseFull.data[(oy + ty) * BW + ox + tx] - tileFull.data[p])
    }
    return sum / samples.length
  }

  let fine = { score: Infinity, x: 0, y: 0 }
  const cx = best.x * COARSE, cy = best.y * COARSE
  for (let oy = Math.max(0, cy - 6); oy <= Math.min(BH - th, cy + 6); oy++) {
    for (let ox = Math.max(0, cx - 6); ox <= Math.min(BW - tw, cx + 6); ox++) {
      const score = scoreAt(ox, oy)
      if (score < fine.score) fine = { score, x: ox, y: oy }
    }
  }
  let random = 0
  for (let k = 0; k < 120; k++) random += scoreAt((Math.random() * (BW - tw)) | 0, (Math.random() * (BH - th)) | 0)
  random /= 120
  return { tile, w: tw, h: th, ...fine, random, ratio: fine.score / random }
}

console.log(`底图 ${BW}x${BH}\n`)
const rows = []
for (const id of ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']) {
  const r = await locate(`map_w1_${id}_lock.png`)
  rows.push([id, r])
  console.log(`${id}: ${r.w}x${r.h} @ (${r.x},${r.y})  分数 ${r.score.toFixed(2)} / 随机基线 ${r.random.toFixed(2)} = ${(r.ratio * 100).toFixed(1)}%`)
}
console.log('\n若结果与 chapterMapLayout.mjs 一致，无需改动；否则把下面这段替换进去：\n')
console.log('export const CHAPTER_TILE_RECTS = {')
for (const [id, r] of rows) console.log(`  ${id}: { x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} },`)
console.log('}')
