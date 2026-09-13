/**
 * Spine 页面贴图尺寸审计（只读，不改文件）。
 *
 * 背景：资源包里的图集页面 PNG 是提取工具**裁掉透明边**后的版本；Spine 运行时按 `.atlas` 里
 * 声明的 `size:` 归一化 UV，贴图尺寸一旦不同，采样位置就会整体偏移——
 * 典型症状是角色渲染成"散开的碎片"。`Npc_007` 原本 510×359 / 声明 524×524，就散得最厉害；
 * 按图集画布补回（左 4 / 上 158 → 524×524，做法与 `scripts/dev/export-skin-models.mjs` 一致）后正常。
 * 其余条目多为 1~4px 偏差，观感可接受；**彻底修法是**用 UnityPy 从 AssetBundle 重新导出原始
 * Texture2D（本机 `game.taptap.tqpmyrzg/.../AssetBundle/...` + `python -c "import UnityPy"` 可用）。
 *
 * 用法：node scripts/dev/audit-spine-textures.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const roots = [
  join(root, 'public', 'images', 'gacha', 'spine'),
  join(root, 'public', 'images', 'gacha', 'spine', 'heroes')
]

function parseAtlas(text) {
  const lines = text.split(/\r?\n/)
  const page = lines.find(line => /\.png\s*$/.test(line.trim()))
  const size = lines.find(line => line.trim().startsWith('size:'))
  if (!page || !size) return null
  const [width, height] = size.replace('size:', '').split(',').map(Number)
  return { page: page.trim(), width, height }
}

const atlases = []
for (const dir of roots) {
  if (!existsSync(dir)) continue
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.atlas')) atlases.push(join(dir, entry.name))
    else if (entry.isDirectory()) {
      for (const file of readdirSync(join(dir, entry.name))) {
        if (file.endsWith('.atlas')) atlases.push(join(dir, entry.name, file))
      }
    }
  }
}

const issues = []
for (const atlasPath of atlases) {
  const parsed = parseAtlas(readFileSync(atlasPath, 'utf8'))
  if (!parsed) continue
  const pngPath = join(dirname(atlasPath), parsed.page)
  if (!existsSync(pngPath)) {
    issues.push({ label: relative(root, pngPath), note: '图集声明的页面贴图不存在' })
    continue
  }
  const meta = await sharp(pngPath).metadata()
  if (meta.width === parsed.width && meta.height === parsed.height) continue
  issues.push({
    label: relative(root, pngPath),
    note: `${meta.width}x${meta.height} ≠ 图集声明 ${parsed.width}x${parsed.height}（差 ${parsed.width - meta.width}, ${parsed.height - meta.height}）`
  })
}

if (!issues.length) {
  console.log(`✅ 全部 ${atlases.length} 个图集的页面贴图尺寸与声明一致`)
} else {
  console.log(`⚠ ${issues.length} / ${atlases.length} 个图集的页面贴图与声明尺寸不一致（只读报告）：`)
  for (const item of issues) console.log(`  · ${item.label}: ${item.note}`)
  console.log('\n已修：Npc_007（510×359 → 524×524，补 左4/上158）。其余偏差 1~4px，观感可接受；')
  console.log('彻底修法：用 UnityPy 从 AssetBundle 重新导出原始 Texture2D，或按图集画布补齐。')
}
