/**
 * 同步评论头像清单（写入 public/data/parsed/avatarCatalog.json）
 *
 * ## 收录范围（用户指定：只显示角色图鉴与魔物图鉴里有的）
 * 素材目录 `public/images/HeadIconAtals/` 里只取两类，且必须能对应到图鉴实体：
 *   - `at*`          → 角色头像，`at001_0` 对应 `hero_001`（取前三位数字）
 *   - `avatar_pet_*` → 魔物头像，`avatar_pet_006` 对应 `pet_006`
 * 对不上图鉴的**一律不收录**（实测隐藏 9 个角色头像 + 1 个魔物头像，
 * 例如 `hero_002` 未进图鉴，`at002_0` 就不该让用户选到）。
 * `avatar_Mon*`（怪物头像）按用户要求完全不收录。
 *
 * 图鉴数据来自 `public/data/parsed/heroes.json` / `pets.json`（构建产物，已入库）。
 *
 * ## 为什么生成清单而不是让前端遍历目录
 * 浏览器拿不到目录列表。清单也让头像 ID 与图片路径解耦——
 * 素材目录改名时只改清单，**库里历史评论存的是 ID，不会变成失效路径**。
 * 清单同时带上角色/魔物名，选择器可以显示中文名而不是 `at001b_0` 这种内部编号。
 *
 * 用法：
 *   node scripts/dev/sync-avatar-catalog.mjs          # 默认只预览，不写文件
 *   node scripts/dev/sync-avatar-catalog.mjs --apply  # 写入 public/data/parsed/avatarCatalog.json
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
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
const heroesFile = join(repoRoot, 'public/data/parsed/heroes.json')
const petsFile = join(repoRoot, 'public/data/parsed/pets.json')

if (!existsSync(sourceDir)) {
  console.error(`未找到头像目录：${sourceDir}`)
  process.exit(1)
}
for (const f of [heroesFile, petsFile]) {
  if (!existsSync(f)) {
    console.error(`未找到图鉴数据：${f}`)
    console.error('请先运行 npm run data:build 生成 public/data/parsed/ 下的图鉴产物。')
    process.exit(1)
  }
}

const heroes = JSON.parse(readFileSync(heroesFile, 'utf8')).heroes || []
const pets = JSON.parse(readFileSync(petsFile, 'utf8')).pets || []
const heroById = new Map(heroes.map((h) => [h.id, h.name]))
const petById = new Map(pets.map((p) => [p.id, p.name]))

/** `at001_0` / `at001b_0` / `at005a` → `hero_001`；取前三位数字，后缀差异视为同一角色的不同立绘 */
function heroIdOf(base) {
  const m = base.match(/^at(\d{3})/i)
  return m ? `hero_${m[1]}` : null
}
/** `avatar_pet_006` / `avatar_pet_006_a` → `pet_006` */
function petIdOf(base) {
  const m = base.match(/^avatar_pet_(\d{3})/i)
  return m ? `pet_${m[1]}` : null
}

const files = readdirSync(sourceDir).filter((f) => statSync(join(sourceDir, f)).isFile())

const build = (matcher, idOf, byId) => {
  const included = []
  const skipped = []
  const skippedNoEntity = []
  for (const file of files.filter(matcher)) {
    const base = file.replace(/\.webp$/i, '')
    const entityId = idOf(base)
    const name = entityId ? byId.get(entityId) : null
    if (!entityId || !name) {
      skippedNoEntity.push(`${base}（无 ${entityId || '对应实体'}）`)
      continue
    }
    included.push({ id: base, path: `/images/HeadIconAtals/${file}`, name })
    void skipped
  }
  // 同一个角色/魔物的多个立绘：名字后补区别，避免选择器里出现两个同名项
  const nameCount = new Map()
  for (const it of included) nameCount.set(it.name, (nameCount.get(it.name) || 0) + 1)
  const seen = new Map()
  for (const it of included) {
    if (nameCount.get(it.name) > 1) {
      const n = (seen.get(it.name) || 0) + 1
      seen.set(it.name, n)
      if (n > 1) it.name = `${it.name}（${n}）`
    }
  }
  included.sort((a, b) => a.id.localeCompare(b.id, 'en'))
  return { included, skippedNoEntity }
}

const player = build((f) => /^at\d/i.test(f), heroIdOf, heroById)
const pet = build((f) => /^avatar_pet_\d/i.test(f), petIdOf, petById)

const groups = [
  { key: 'player', label: '角色头像', items: player.included },
  { key: 'pet', label: '魔物头像', items: pet.included }
]

const total = groups.reduce((n, g) => n + g.items.length, 0)
const allSkipped = [...player.skippedNoEntity, ...pet.skippedNoEntity]

console.log(`源目录：public/images/HeadIconAtals（${files.length} 个文件）`)
console.log(`图鉴：角色 ${heroes.length} 个 / 魔物 ${pets.length} 个\n`)
for (const g of groups) console.log(`  ${g.label}（${g.key}）: ${g.items.length} 个`)
console.log(`\n因对不上图鉴而未收录 ${allSkipped.length} 个：`)
for (const s of allSkipped) console.log('  - ' + s)

if (total === 0) {
  console.error('❌ 没有匹配到任何头像，请检查命名规则或图鉴数据')
  process.exit(1)
}

const catalog = {
  source: 'public/images/HeadIconAtals',
  note: '由 scripts/dev/sync-avatar-catalog.mjs 生成；只收录能对应到角色图鉴/魔物图鉴的头像，不含 avatar_Mon*',
  matchedAgainst: { heroes: heroes.length, pets: pets.length, skipped: allSkipped.length },
  groups
}

if (!values.apply) {
  console.log(`\n（预览）将写入 ${outFile}，共 ${total} 个头像。加 --apply 才写入。`)
  process.exit(0)
}

writeFileSync(outFile, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
console.log(`\n✅ 已写入 ${outFile}（${total} 个头像，跳过 ${allSkipped.length} 个）`)
