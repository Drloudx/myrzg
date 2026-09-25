/**
 * 导入 buff 图标到 public/images/CombatPanel_Atlas。
 *
 * 源：`UI_Atlases/CombatPanel_Atlas/sprites/buff_NNN.png`（图集 `CombatPanel_Atlas.png` 的 28×28 sprite）
 * 目标：`public/images/CombatPanel_Atlas/*.webp`
 *
 * 为什么转 WebP：仓库运行时图片已统一为 `.webp`（见 2026-09-18 日报），新素材按同一口径导入。
 * 图标只有 28×28，**用无损 WebP**（有损在这么小的图上会糊掉描边）；实测 37 张 43.8 KB → 27.4 KB。
 * 源 PNG 始终留在资源包/图集目录，不受影响，需要原图可直接重取。
 *
 * 图标清单**不另维护**：直接取 `buffParser` 判定的「精选通用 buff」的 `buffIcon`，
 * 避免清单与产物脱节出现「有词条没图」。
 *
 * 每个源 sprite 都会与图集 sprite 表逐像素核对（SPEC 六：裁剪矩形以图集 sprite 表为准，
 * 切到空白区域时产物仍是合法 PNG，只有比对像素才会暴露），核对不过直接报错。
 *
 * 用法：
 *   node scripts/dev/import-buff-icons.mjs            # 预览
 *   node scripts/dev/import-buff-icons.mjs --apply
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { isCommonBuff } from '../../src/utils/buffParser.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const atlasDir = path.resolve(root, '../UI_Atlases/CombatPanel_Atlas')
const spriteDir = path.join(atlasDir, 'sprites')
const atlasPng = path.join(atlasDir, 'CombatPanel_Atlas.png')
const atlasJson = path.join(atlasDir, 'CombatPanel_Atlas.json')
const target = path.join(root, 'public/images/CombatPanel_Atlas')
const apply = process.argv.includes('--apply')

/** 精选通用 buff 用到的全部图标名。 */
function collectIcons() {
  const buffs = JSON.parse(fs.readFileSync(path.join(root, 'raw/buff.json'), 'utf8'))
  const icons = new Set()
  for (const buff of Object.values(buffs)) {
    if (!isCommonBuff(buff)) continue
    if (buff.buffIcon) icons.add(String(buff.buffIcon))
  }
  return [...icons].sort()
}

const icons = collectIcons()
if (!icons.length) throw new Error('精选 buff 未解析出任何图标，检查 buffParser.isCommonBuff 与 raw/buff.json')

const spriteTable = new Map(
  (JSON.parse(fs.readFileSync(atlasJson, 'utf8')).mSprites || []).map(sprite => [sprite.name, sprite])
)
const atlasMeta = await sharp(atlasPng).metadata()

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

const plan = []
for (const icon of icons) {
  const source = path.join(spriteDir, `${icon}.png`)
  if (!fs.existsSync(source)) throw new Error(`缺少源图标：${source}`)
  const sprite = spriteTable.get(icon)
  if (!sprite) throw new Error(`图集 sprite 表里没有 ${icon}`)

  // 与图集裁剪结果逐像素核对，确认预切 sprite 没切歪或切到空白
  const expected = await sharp(atlasPng)
    .extract({ left: sprite.x, top: sprite.y, width: sprite.width, height: sprite.height })
    .raw().toBuffer()
  const actual = await sharp(source).raw().toBuffer()
  if (!expected.equals(actual)) {
    throw new Error(`${icon} 与图集 sprite 表 (${sprite.x},${sprite.y},${sprite.width}x${sprite.height}) 的裁剪结果不一致`)
  }

  const sourceBytes = fs.readFileSync(source)
  // 28×28 图标用无损 WebP，避免有损压糊描边
  const out = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer()
  plan.push({
    icon,
    to: `${icon}.webp`,
    rect: `${sprite.x},${sprite.y} ${sprite.width}x${sprite.height}`,
    sourceBytes: sourceBytes.length,
    sourceSha256: hash(sourceBytes),
    outputBytes: out.length,
    _out: out
  })
}

const sourceTotal = plan.reduce((sum, entry) => sum + entry.sourceBytes, 0)
const outputTotal = plan.reduce((sum, entry) => sum + entry.outputBytes, 0)

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'preview',
  atlas: `${atlasMeta.width}x${atlasMeta.height}`,
  source: path.relative(root, spriteDir).replaceAll('\\', '/'),
  target: path.relative(root, target).replaceAll('\\', '/'),
  files: plan.length,
  sourceTotalKB: +(sourceTotal / 1024).toFixed(1),
  outputTotalKB: +(outputTotal / 1024).toFixed(1),
  savingPercent: +((1 - outputTotal / sourceTotal) * 100).toFixed(1),
  plan: plan.map(({ _out, ...rest }) => rest)
}, null, 1))

if (!apply) {
  console.log('[import-buff-icons] 预览模式，未写入任何文件。加 --apply 写入。')
  process.exit(0)
}

fs.mkdirSync(target, { recursive: true })
for (const entry of plan) {
  const outPath = path.join(target, entry.to)
  fs.writeFileSync(outPath, entry._out)
  if (hash(fs.readFileSync(outPath)) !== hash(entry._out)) throw new Error(`写入校验失败：${outPath}`)
}
console.log(`已写入 ${plan.length} 个文件到 public/images/CombatPanel_Atlas，合计 ${(outputTotal / 1024).toFixed(1)} KB`)
