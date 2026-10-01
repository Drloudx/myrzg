/**
 * 同步评论头像清单（写入 public/data/parsed/avatarCatalog.json）
 *
 * 输入：`public/images/HeadIconAtals/` 下 `at*`（玩家头像）与 `avatar_pet*`（宠物头像）。
 * 只收录这两类——用户指定。`avatar_Mon*`（101 个怪物头像）不收录。
 *
 * 为什么生成清单而不是让前端遍历目录：
 *   浏览器拿不到目录列表。清单也让头像 ID 与图片路径解耦——
 *   素材目录改名时只改清单，**库里历史评论存的是 ID，不会变成失效路径**。
 *   服务端用同一份 ID 规则校验，客户端塞不进任意路径。
 *
 * 用法：
 *   node scripts/dev/sync-avatar-catalog.mjs          # 默认只预览，不写文件
 *   node scripts/dev/sync-avatar-catalog.mjs --apply  # 写入 public/data/parsed/avatarCatalog.json
 */
import { readdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const sourceDir = join(repoRoot, 'public/images/HeadIconAtals')
/**
 * 输出到 `public/data/parsed/`：`verify.mjs` 的护栏规定浏览器运行时
 * **只允许**读 `data/parsed/`、`data/dialogs/`、`data/taskDialogs/` 与 `data/notice.json`，
 * 放到 `public/data/` 根会被判为"引用原始配置表"而验收失败（实际踩过一次）。
 */
const outFile = join(repoRoot, 'public/data/parsed/avatarCatalog.json')

if (!existsSync(sourceDir)) {
  console.error(`未找到头像目录：${sourceDir}`)
  process.exit(1)
}

const files = readdirSync(sourceDir).filter((f) => statSync(join(sourceDir, f)).isFile())

/** 文件名（去扩展名）就是头像 ID；按前缀分类 */
const GROUPS = [
  { key: 'player', label: '玩家头像', match: (name) => /^at[0-9A-Za-z_]+\.webp$/i.test(name) },
  { key: 'pet', label: '宠物头像', match: (name) => /^avatar_pet_[0-9A-Za-z_]+\.webp$/i.test(name) }
]

const groups = GROUPS.map(({ key, label, match }) => {
  const items = files
    .filter(match)
    .map((file) => ({
      id: file.replace(/\.webp$/i, ''),
      path: `/images/HeadIconAtals/${file}`
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
  return { key, label, items }
})

// 排除项统计：让"没被收录"这件事可见，而不是静默丢弃
const included = new Set(groups.flatMap((g) => g.items.map((i) => i.id)))
const excluded = files
  .map((f) => f.replace(/\.webp$/i, ''))
  .filter((id) => !included.has(id))
  .sort()

const catalog = {
  source: 'public/images/HeadIconAtals',
  note: '由 scripts/dev/sync-avatar-catalog.mjs 生成；只收录 at* 与 avatar_pet*，不含 avatar_Mon*',
  groups
}

console.log(`源目录：public/images/HeadIconAtals（${files.length} 个文件）`)
for (const g of groups) console.log(`  ${g.label}（${g.key}）: ${g.items.length} 个`)
console.log(`未收录：${excluded.length} 个（含 avatar_Mon* 等）`)
if (excluded.length <= 12) console.log('  ' + excluded.join(' '))

const total = groups.reduce((n, g) => n + g.items.length, 0)
if (total === 0) {
  console.error('❌ 没有匹配到任何头像，请检查命名规则')
  process.exit(1)
}

if (!values.apply) {
  console.log(`\n（预览）将写入 ${outFile}，共 ${total} 个头像。加 --apply 才写入。`)
  process.exit(0)
}

writeFileSync(outFile, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
console.log(`\n✅ 已写入 ${outFile}（${total} 个头像）`)
