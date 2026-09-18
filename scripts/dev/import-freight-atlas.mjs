/**
 * 导入货运面板（FreightPanel）图集切图到项目资源目录。
 *
 * 来源：`UI_Atlases/FreightPanel_Atlas/sprites/*.png`（已切好的 35 张）
 * 目标：`public/images/FreightPanel_Atlas/*.webp`（与项目其他图集同构）
 *
 * 与项目既有做法一致：转**无损 WebP**（保留 `.webp` 扩展名，内容与像素一致），
 * 转完做「alpha 逐字节 + 可见像素零差异」复核，不通过则不落盘。
 *
 * 用法：
 *   node scripts/dev/import-freight-atlas.mjs            # 预览
 *   node scripts/dev/import-freight-atlas.mjs --apply    # 执行
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })

const SRC = join(projectRoot, '../UI_Atlases/FreightPanel_Atlas/sprites')
/**
 * 预制体目录里的额外大图（不在图集切图里，是独立贴图）。
 * 例如 `cart_order_botm`（列表面板底）、`cart_order_empty`（空态）、`cart_bg`（面板底）。
 * 只取本项目实际用到的，避免把小车分层图（cyyd_cart001_*）等无关资源也搬进来。
 */
const EXTRA_SRC = join(projectRoot, '../4.24路资源包/assets/res/prefab/uiprefab/freightpanel')
const EXTRA_FILES = ['cart_order_botm.png', 'cart_order_empty.png', 'cart_bg.png', 'cart_market_botm.png']
const DST = join(projectRoot, 'public/images/FreightPanel_Atlas')

if (!existsSync(SRC)) {
  console.error(`✗ 源目录不存在：${SRC}`)
  process.exit(1)
}

const files = [
  ...readdirSync(SRC).filter(f => /\.(png|jpg|jpeg)$/i.test(f)).map(f => ({ name: f, dir: SRC })),
  ...EXTRA_FILES.filter(f => existsSync(join(EXTRA_SRC, f))).map(f => ({ name: f, dir: EXTRA_SRC }))
]
console.log(`[freight] 图集切图: ${SRC}`)
console.log(`[freight] 额外大图: ${EXTRA_SRC}`)
console.log(`[freight] 待导入 ${files.length} 张`)

const { default: sharp } = await import('sharp')

let totalSrc = 0
let totalDst = 0
const rows = []
const failures = []

for (const { name: f, dir } of files) {
  const src = join(dir, f)
  const name = basename(f).replace(/\.(png|jpg|jpeg)$/i, '') + '.webp'
  const dst = join(DST, name)
  const srcBuf = (await import('node:fs')).readFileSync(src)
  let webp
  try {
    webp = await sharp(srcBuf).webp({ lossless: true, effort: 6 }).toBuffer()
  } catch (e) {
    failures.push(`${f}: 编码失败 ${e.message}`)
    continue
  }
  // 无损复核
  let bad = ''
  try {
    const a = await sharp(srcBuf).ensureAlpha().raw().toBuffer()
    const b = await sharp(webp).ensureAlpha().raw().toBuffer()
    if (a.length !== b.length) bad = '像素缓冲长度不一致'
    else {
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] !== b[i + 3]) { bad = 'alpha 变化'; break }
        if ((a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) && a[i + 3] !== 0) { bad = '可见像素变化'; break }
      }
    }
  } catch (e) { bad = e.message }
  if (bad) { failures.push(`${f}: 复核失败(${bad})`); continue }

  totalSrc += srcBuf.length
  totalDst += webp.length
  rows.push({ name, src: srcBuf.length, dst: webp.length })
  if (values.apply) {
    mkdirSync(DST, { recursive: true })
    writeFileSync(dst, webp)
  }
}

console.log('\n[freight] 计划：')
for (const r of rows.slice(0, 40)) {
  console.log(`  ${r.name.padEnd(28)} ${String(Math.round(r.src / 1024)).padStart(4)}KB → ${String(Math.round(r.dst / 1024)).padStart(4)}KB`)
}
console.log(`\n[freight] 合计 ${(totalSrc / 1048576).toFixed(2)} MB → ${(totalDst / 1048576).toFixed(2)} MB`)
if (failures.length) {
  console.log(`[freight] ⚠ 失败 ${failures.length} 个：`)
  for (const f of failures.slice(0, 10)) console.log('   ' + f)
}

if (!values.apply) {
  console.log('\n[freight] 预览结束，未写入。加 --apply 执行。')
} else {
  const n = readdirSync(DST).filter(f => f.endsWith('.webp')).length
  console.log(`\n[freight] 已写入 ${DST}（现共 ${n} 个 .webp）`)
}
