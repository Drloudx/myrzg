/**
 * 一键验收脚本（npm run verify）：
 *   1) 静态检查：parsed 产物齐全 + 源码/配置无旧脚本残留引用
 *   2) 完整构建：npm run build（数据预处理 + vite build）
 *   3) 产物检查：dist/data/parsed 关键产物存在
 * 全部通过输出 PASS，任一失败 exit 1。
 * 依赖：Node 18+；脚本目录 scripts/dev/（开发工具，不进构建链）。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const parsedDir = join(root, 'public/data/parsed')
const distParsedDir = join(root, 'dist/data/parsed')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ---------- 1. 先构建，再检查本次生成的产物 ----------
console.log('── 1/3 完整构建（npm run build） ──')
let buildOk = true
try {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execSync(`${npmCmd} run build`, { stdio: 'inherit', cwd: root })
} catch (e) {
  buildOk = false
}
check('npm run build 通过', buildOk)

// ---------- 2. 产物齐全（public/data/parsed + dist） ----------
console.log('── 2/3 预解析产物检查 ──')
const expected = {
  'items.json': 500, 'tasks.json': 500, 'heroes.json': 500, 'monsters.json': 300,
  'furniture.json': 50, 'facilities.json': 50,
  'pets.json': 20, 'recipes.json': 5, 'achievements.json': 20, 'events.json': 20,
  'pet-eggs.json': 5, 'search-index.json': 100, 'item-sources.json': 20,
  'itemAffixes.json': 1, 'parsed-exchange.json': 100, 'parsed-pvp.json': 5,
  'parsed-hidden.json': 10, 'dialogIndex.json': 50, 'dialogSegments.json': 1,
  'parsed-pvp-sources.json': 0, 'parsed-hidden-sources.json': 0,
  'parsed-dungeon-sources.json': 1, 'dungeons.json': 10
}
for (const [file, minKB] of Object.entries(expected)) {
  const p = join(parsedDir, file)
  const ok = existsSync(p) && statSync(p).size >= minKB * 1024
  check(`parsed/${file}`, ok, ok ? `${Math.round(statSync(p).size / 1024)}KB` : '缺失或过小')
}

const dungeonDetailDir = join(parsedDir, 'dungeons')
const dungeonDetailFiles = existsSync(dungeonDetailDir)
  ? readdirSync(dungeonDetailDir).filter(file => file.endsWith('.json'))
  : []
const largestDungeonDetail = dungeonDetailFiles
  .map(file => ({ file, bytes: statSync(join(dungeonDetailDir, file)).size }))
  .sort((a, b) => b.bytes - a.bytes)[0]
check('副本详情已按关卡拆分', dungeonDetailFiles.length > 0,
  largestDungeonDetail
    ? `${dungeonDetailFiles.length} 个详情文件；最大 ${largestDungeonDetail.file} ${(largestDungeonDetail.bytes / 1024 / 1024).toFixed(2)}MB`
    : '未找到详情文件')

const monsterEncounterDir = join(parsedDir, 'monster-encounters')
check('怪物来源分片已移除', !existsSync(monsterEncounterDir), existsSync(monsterEncounterDir) ? '仍存在旧目录' : '')

// 不写死点位数量或地区：每次都按当前原表的精确外键关系重算期望集合。
try {
  const readRawTable = (file) => {
    const json = JSON.parse(readFileSync(join(root, 'raw', file), 'utf8'))
    return json.datas || json || {}
  }
  const indexByTypeId = (table) => new Map(Object.entries(table).map(([key, value]) => [value?.typeId || key, value]))
  const roomData = indexByTypeId(readRawTable('room.json'))
  const levelRoomData = readRawTable('levelRoom.json')
  const collectData = indexByTypeId(readRawTable('roomCollect.json'))
  const collectTypeData = new Map(Object.values(readRawTable('roomCollectType.json'))
    .filter(entry => entry?.collectTypeId)
    .map(entry => [entry.collectTypeId, entry]))
  const rewardData = indexByTypeId(readRawTable('reward.json'))
  const expectedRelations = new Set()

  for (const lr of Object.values(levelRoomData)) {
    const room = roomData.get(lr?.roomTypeId)
    if (!room) continue
    const collectIds = new Set()
    for (const obj of room?.battleData?.spObj || []) {
      if (obj?.caijiTypeId) collectIds.add(obj.caijiTypeId)
    }
    for (const trigger of room?.battleData?.triggers || []) {
      for (const action of trigger?.actions || []) {
        if (action?.actionPara?.roomCollectId) collectIds.add(action.actionPara.roomCollectId)
      }
    }
    for (const collectId of collectIds) {
      const collect = collectData.get(collectId)
      const collectType = collectTypeData.get(collect?.collectTypeId)
      const reward = rewardData.get(collectType?.reward)
      if (reward?.category?.includes('场景宝箱')) {
        expectedRelations.add(`${lr.typeId}|${lr.roomTypeId}|${collectId}|${reward.typeId}`)
      }
    }
  }

  const hiddenRewards = JSON.parse(readFileSync(join(parsedDir, 'parsed-hidden.json'), 'utf8'))
  const actualRelations = hiddenRewards.map(entry =>
    `${entry.roomId}|${entry.roomTypeId}|${entry.collectId}|${entry.rewardId}`)
  const actualRelationSet = new Set(actualRelations)
  const uniqueEntryIds = new Set(hiddenRewards.map(entry => entry.id))
  const missing = [...expectedRelations].filter(key => !actualRelationSet.has(key))
  const extra = [...actualRelationSet].filter(key => !expectedRelations.has(key))
  const hiddenRelationsOk = missing.length === 0
    && extra.length === 0
    && actualRelations.length === actualRelationSet.size
    && hiddenRewards.length === uniqueEntryIds.size
  check('隐藏点位与当前原表精确对应', hiddenRelationsOk,
    hiddenRelationsOk
      ? `${hiddenRewards.length} 个点位，无丢失、串房或重复`
      : `缺失 ${missing.slice(0, 3).join(', ') || '0'}；多余 ${extra.slice(0, 3).join(', ') || '0'}；关系重复 ${actualRelations.length - actualRelationSet.size}；ID 重复 ${hiddenRewards.length - uniqueEntryIds.size}`)
} catch (error) {
  check('隐藏点位与当前原表精确对应', false, error.message)
}

try {
  const parsedMonsterFile = JSON.parse(readFileSync(join(parsedDir, 'monsters.json'), 'utf8'))
  const parsedMonsters = parsedMonsterFile.monsters || []
  const chief = parsedMonsters.find(monster => monster.id === '034_3')
  const commander = parsedMonsters.find(monster => monster.id === '052')
  const spider = parsedMonsters.find(monster => monster.id === '002')
  const warrior = parsedMonsters.find(monster => monster.id === '011')
  const turod = parsedMonsters.find(monster => monster.id === '069')
  const crystalMonster = parsedMonsters.find(monster => monster.id === '055')
  const ansen = parsedMonsters.find(monster => monster.id === '042')
  const elite064 = parsedMonsters.find(monster => monster.id === '064')
  const elite067 = parsedMonsters.find(monster => monster.id === '067')
  const chiefForms = new Map((chief?.forms || []).map(form => [form.id, form]))
  const commanderForms = new Map((commander?.forms || []).map(form => [form.id, form]))
  const spiderForms = new Map((spider?.forms || []).map(form => [form.id, form]))
  const warriorForms = new Map((warrior?.forms || []).map(form => [form.id, form]))
  const chiefTowerFloors = chiefForms.get('034_tower1_25')?.towerAppearances?.[0]?.floors || []
  const sourceDrivenVariantsOk = chiefForms.get('034_3')?.relationType === '本体'
    && chiefForms.get('034_2')?.relationType === '变身阶段'
    && chiefForms.get('034_2')?.transform?.condition === '生命值降至 80% 及以下'
    && chiefForms.get('034_2')?.transform?.currentStage === 'after'
    && chiefTowerFloors.join(',') === '7,25,39,64,78'
    && elite064?.forms?.some(form => form.id === '064_elite' && form.relationType === '通用版本' && form.towerBossAppearances?.[0]?.floors?.join(',') === '11,23,52')
    && elite067?.forms?.some(form => form.id === '067_elite' && form.relationType === '通用版本' && form.towerBossAppearances?.[0]?.floors?.join(',') === '3,19,31,42,46,56,69')
    && !spiderForms.get('002')?.towerAppearances
    && warriorForms.get('011_tower1_40')?.towerAppearances?.[0]?.floors?.join(',') === '40'
    && !chiefForms.has('034_4')
    && commanderForms.get('052_1')?.relationType === '探索版本'
    && commanderForms.get('052_2')?.relationType === '剧情版本'
    && commanderForms.get('052_tower1_30')?.relationType === '爬塔版本'
    && ![...chiefForms.values(), ...commanderForms.values()].some(form => /特殊|爬塔\s*\d+层/.test(form.tabLabel || ''))
    && turod?.summons?.some(form => form.id === '069_jianci' && form.name === '尖刺')
    && turod?.forms?.some(form => form.skills?.some(skill => skill.addBuffs?.some(buff => buff.id === 'mon069StunBuff' && buff.name === '特殊眩晕' && buff.description?.includes('尖刺被破坏时解除'))))
    && crystalMonster?.summons?.some(form => form.id === 'Mon055StoneMon')
    && ansen?.forms?.some(form => form.skills?.some(skill => skill.id === 'mon_04207' && skill.damageHits?.some(hit => hit.source === 'lineDamage' && hit.multiplier === 0.6) && skill.damageHits?.some(hit => hit.source === 'atkDamage' && hit.multiplier === 1.5)))
    && ansen?.forms?.some(form => form.skills?.some(skill => skill.id === 'mon_04208' && skill.ranges?.some(range => range.key === 'moveGridRange' && range.value === '3')))
    && ansen?.forms?.some(form => form.skills?.some(skill => skill.id === 'mon_04209' && skill.summons?.some(summon => summon.monsterId === '042_1' && summon.count === 3)))
  check('怪物变种按源码用途归类', sourceDrivenVariantsOk,
    sourceDrivenVariantsOk ? '关系、Boss 塔层、尖刺召唤与晶石召唤均正确' : '关系、Boss 塔层或召唤物解析不符合预期')
  check('全怪物图鉴产物已移除', !Object.hasOwn(parsedMonsterFile, 'handbook'),
    Object.hasOwn(parsedMonsterFile, 'handbook') ? 'parsed/monsters.json 仍含 handbook' : '')
} catch (error) {
  check('怪物变种按源码用途归类', false, error.message)
}

// mon.json 归一化链校验：
//   raw/mon.json（构建期原始表；未迁移前为 public/data/mon.json）为游戏原始版，
//   由 scripts/parse/shared.mjs 的 normalizeMonJson 在预处理时修正为 critDam（app 读取字段），
//   页面只消费 parsed/monsters.json。校验确保 raw 表是原始版 + parsed 已应用 critDam 修正。
const monPath = join(root, 'raw/mon.json')
const parsedMonPath = join(root, 'public/data/parsed/monsters.json')
try {
  const monJson = JSON.parse(readFileSync(monPath, 'utf8'))
  const rawEntries = Object.values(monJson.datas || {})
  const hasCirtDam = rawEntries.some(e => e?.unitData && 'cirtDam' in e.unitData)
  check('mon.json 为原始版(unitData 含 cirtDam 待归一化)', hasCirtDam,
    hasCirtDam ? `${rawEntries.length} 条单位` : '未发现 cirtDam，疑似已被手动修正为非原始版')
} catch (error) {
  check('mon.json 为原始版(unitData 含 cirtDam 待归一化)', false, error.message)
}
try {
  const parsedMonster = JSON.parse(readFileSync(parsedMonPath, 'utf8'))
  const monsters = parsedMonster.monsters || []
  const allForms = monsters.flatMap(m => m?.forms || [])
  const sample = allForms.find(m => m?.rawStats) || {}
  const useCritDam = sample.rawStats && 'critDam' in sample.rawStats
  const leakedCirtDam = allForms.filter(fm => fm?.rawStats && 'cirtDam' in fm.rawStats).length
  check('parsed/monsters.json 已应用 critDam 修正', useCritDam && leakedCirtDam === 0,
    useCritDam && leakedCirtDam === 0 ? `${monsters.length} 个怪物` : `critDam 归一化失效（泄露 cirtDam ${leakedCirtDam} 处，疑似 monsters.mjs/shared.mjs 被改）`)
} catch (error) {
  check('parsed/monsters.json 已应用 critDam 修正', false, error.message)
}

// ---------- 3. 源码/配置无旧脚本残留引用 ----------
console.log('── 3/3 旧脚本残留检查 ──')
// 2a. 旧文件必须已删除（存在即失败）
const goneFiles = [
  'scripts/clean-data.js', 'scripts/parse-rewards.js', 'scripts/parse-exchange.js',
  'scripts/generate-affixes.js', 'scripts/parse-hidden-rewards.js',
  'src/assets/common.css', 'src/components/BackToTop.vue',
  'src/views/MonstersView.bak.vue', 'src/utils/monsterParser.bak.js'
]
let staleFound = []
for (const rel of goneFiles) {
  if (existsSync(join(root, rel))) staleFound.push(`${rel} 仍存在`)
}
// 2b. 无对已删除模块的 import / 脚本引用（注释不算：只扫 import 与 package.json scripts）
const importRe = /from\s+['"][^'"]*(common\.css|BackToTop|MonstersView\.bak|monsterParser\.bak|UI_REFACTOR_GUIDE)['"]/
const scanImportDirs = ['src']
for (const d of scanImportDirs) {
  const dir = join(root, d)
  if (!existsSync(dir)) continue
  const walk = (cur) => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(js|mjs|vue|ts)$/.test(entry.name)) continue
      try {
        const rel = full.replace(root + '/', '')
        if (importRe.test(readFileSync(full, 'utf8'))) staleFound.push(`${rel} 含已删除模块 import`)
      } catch { }
    }
  }
  walk(dir)
}
try {
  const pkg = readFileSync(join(root, 'package.json'), 'utf8')
  for (const old of ['clean-data.js', 'parse-rewards.js', 'parse-exchange.js', 'generate-affixes.js', 'parse-hidden-rewards.js']) {
    if (pkg.includes(old)) staleFound.push(`package.json 引用 ${old}`)
  }
} catch { }
check('源码/配置无旧脚本残留', staleFound.length === 0, staleFound.length ? staleFound.join('; ') : '')

// 浏览器运行时只允许读取预解析数据、公告与剧情分片；原始配置表仅供构建期 scripts/parse 使用。
const allowedRuntimeDataPrefixes = ['data/parsed/', 'data/dialogs/', 'data/taskDialogs/']
const allowedRuntimeDataFiles = new Set(['data/notice.json'])
const runtimeRawRefs = []
const runtimeDataRequestRe = /(?:fetchWithFallback|fetch)\s*\(\s*([`'"])([^`'"]*data\/[^`'"]*)\1/g
const scanRuntimeDataRequests = (currentDir) => {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const full = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      scanRuntimeDataRequests(full)
      continue
    }
    if (!/\.(js|vue|ts)$/.test(entry.name)) continue

    const source = readFileSync(full, 'utf8')
    for (const match of source.matchAll(runtimeDataRequestRe)) {
      const dataIndex = match[2].indexOf('data/')
      const dataPath = dataIndex >= 0 ? match[2].slice(dataIndex) : match[2]
      const allowed = allowedRuntimeDataFiles.has(dataPath)
        || allowedRuntimeDataPrefixes.some(prefix => dataPath.startsWith(prefix))
      if (!allowed) runtimeRawRefs.push(`${full.slice(root.length + 1)} -> ${dataPath}`)
    }
  }
}
scanRuntimeDataRequests(join(root, 'src'))
check('浏览器运行时不引用原始配置表', runtimeRawRefs.length === 0,
  runtimeRawRefs.length ? runtimeRawRefs.join('; ') : '仅使用 parsed、公告与剧情分片')

// ---------- 2b. dist 产物 ----------
for (const f of ['items.json', 'furniture.json', 'facilities.json', 'tasks.json', 'heroes.json', 'monsters.json', 'search-index.json', 'parsed-exchange.json', 'dungeons.json']) {
  const p = join(distParsedDir, f)
  const ok = existsSync(p)
  check(`dist/data/parsed/${f}`, ok)
}

const distDungeonDetailDir = join(distParsedDir, 'dungeons')
const distDungeonDetails = existsSync(distDungeonDetailDir)
  ? readdirSync(distDungeonDetailDir).filter(file => file.endsWith('.json'))
  : []
check('dist/data/parsed/dungeons 详情产物', distDungeonDetails.length === dungeonDetailFiles.length,
  `${distDungeonDetails.length}/${dungeonDetailFiles.length} 个文件`)

const distMonsterEncounterDir = join(distParsedDir, 'monster-encounters')
check('dist 不包含怪物来源分片', !existsSync(distMonsterEncounterDir), existsSync(distMonsterEncounterDir) ? '仍存在旧目录' : '')

// ---------- 汇总 ----------
const failed = results.filter(r => !r.ok)
console.log('\n' + (failed.length === 0
  ? '✅ verify 全部通过：产物齐全、无残留、build 成功'
  : `❌ verify 失败 ${failed.length} 项，请见上方 ❌ 列表`))
process.exit(failed.length === 0 ? 0 : 1)
