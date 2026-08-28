/**
 * 任务图鉴数据维护脚本
 * - 把 Config_decrypted 中缺失/过期的数据文件同步到 public/data
 * - 从 GAoNano_decrypted 复制任务剧情到 public/data/taskDialogs（去重）
 * - 校验任务引用解析率，输出统计 + unresolved.json
 *
 * 用法：node scripts/check-task-data.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = 'E:\\Desktop\\html\\myrzg\\Config_decrypted'
const GAO = 'E:\\Desktop\\html\\myrzg\\GAoNano_decrypted'
const FILELIST = 'E:\\Desktop\\html\\myrzg\\源码\\CDN最新配置\\json\\GAoNano\\GAoNanoFileList.json'
const DATA = path.join(ROOT, 'public', 'data')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'))
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8')
}

// ---------- 1. 生成任务页用到的精简数据表 ----------
// battle.json：任务页只用 name / para.movieMode / layers[].layerDatas[].name
const battleFull = readJson(path.join(SRC, 'battle.json')).datas
const battleTrim = { datas: {} }
for (const [id, b] of Object.entries(battleFull)) {
  const layers = (b.layers || []).map((lay) => ({
    layerDatas: (lay.layerDatas || []).map((ld) => ({ name: ld.name || '' }))
  }))
  battleTrim.datas[id] = {
    name: b.name || id,
    para: (b.para && { movieMode: !!b.para.movieMode }) || {},
    layers
  }
}
writeJson(path.join(DATA, 'battle.json'), battleTrim)
console.log(`[trim] battle.json -> ${(fs.statSync(path.join(DATA, 'battle.json')).size / 1048576).toFixed(2)} MB`)

// room.json：任务页只用来解析 NPC 名 + hunterUid 反查怪物，
// 保留 battleData.npcList(uid/npcName/npcDes/npcView) 和 monRounds.mons(monId/typeId)
const roomFull = readJson(path.join(SRC, 'room.json')) // 顶层即场景表，无 datas 包裹
const roomTrim = {}
for (const [id, r] of Object.entries(roomFull)) {
  const npcList = ((r.battleData || {}).npcList || [])
    .filter((n) => n && n.uid)
    .map((n) => ({ uid: n.uid, npcName: n.npcName || '', npcDes: n.npcDes || '', npcView: n.npcView || '' }))
  const monRounds = ((r.battleData || {}).monRounds || [])
    .map((round) => ({
      mons: (round.mons || [])
        .filter((mn) => mn && mn.monId)
        .map((mn) => ({ monId: mn.monId, typeId: mn.typeId || '' }))
    }))
    .filter((round) => round.mons.length)
  roomTrim[id] = { battleData: { npcList, monRounds } }
}
writeJson(path.join(DATA, 'room.json'), roomTrim)
console.log(`[trim] room.json -> ${(fs.statSync(path.join(DATA, 'room.json')).size / 1048576).toFixed(2)} MB`)

// condition.json：任务页需要，缺失则整表复制
const condTarget = path.join(DATA, 'condition.json')
if (!fs.existsSync(condTarget)) {
  fs.copyFileSync(path.join(SRC, 'condition.json'), condTarget)
  console.log('[sync] condition.json 已复制')
}

// ---------- 2. 收集任务引用的剧情 id ----------
const task = readJson(path.join(SRC, 'task.json')).datas
const dialogIds = new Set()
for (const t of Object.values(task)) {
  const gt = t.getTask || {}
  for (const k of ['dialog', 'dialog0', 'dialog1']) if (gt[k]) dialogIds.add(gt[k])
  for (const s of t.steps || []) {
    const p = s.stepPara || {}
    for (const k of ['dialog', 'dialog0', 'dialog1']) if (p[k]) dialogIds.add(p[k])
  }
}

// ---------- 3. 复制剧情脚本（去重，保留原文件名） ----------
const dialogDir = path.join(DATA, 'taskDialogs')
fs.mkdirSync(dialogDir, { recursive: true })
let copiedDialog = 0
const missingDialogs = []

// 复制单个文件（跳过已存在）
const copyIfMissing = (src, target) => {
  if (!fs.existsSync(src)) return false
  if (!fs.existsSync(target)) {
    fs.copyFileSync(src, target)
    copiedDialog++
  }
  return true
}

for (const id of dialogIds) {
  // 分段事件：fav_hero_041_4_0 这类 id 只是某段，整个事件是 fav_hero_041_4_0/1/2...
  // （_1/_2 可能只出现在 room.json 的战斗触发器里，任务表引用不到，必须整族复制）
  const existed = []
  const segMatch = /^(.*)_\d+$/.exec(id)
  const baseId = segMatch ? segMatch[1] : id

  // 族内分段：base_0, base_1, ...（有 base_0 才说明是分段事件）
  if (copyIfMissing(path.join(GAO, baseId + '_0.json'), path.join(dialogDir, baseId + '_0.json'))) {
    existed.push(baseId + '_0')
    let segIdx = 1
    while (true) {
      const segName = `${baseId}_${segIdx}`
      if (copyIfMissing(path.join(GAO, segName + '.json'), path.join(dialogDir, segName + '.json'))) {
        existed.push(segName)
        segIdx++
      } else {
        break
      }
    }
  }

  // 非分段事件：直接复制 id 本体
  if (copyIfMissing(path.join(GAO, id + '.json'), path.join(dialogDir, id + '.json'))) existed.push(id)

  // 兼容：id 是分段事件的一段的场景，确保该段本身也在
  if (segMatch && !existed.includes(id) && copyIfMissing(path.join(GAO, id + '.json'), path.join(dialogDir, id + '.json'))) {
    existed.push(id)
  }

  // 旧逻辑兜底：id_0 / id_1 ...（处理“id 是基名”的情况）
  if (!segMatch && !existed.length) {
    let segIdx = 0
    while (true) {
      const segName = `${id}_${segIdx}`
      if (copyIfMissing(path.join(GAO, segName + '.json'), path.join(dialogDir, segName + '.json'))) {
        existed.push(segName)
        segIdx++
      } else {
        break
      }
    }
  }

  if (!existed.length) {
    missingDialogs.push(id)
  }
}
console.log(`[dialog] 唯一剧情 id：${dialogIds.size}，新增复制：${copiedDialog}，缺失文件：${missingDialogs.length}`)
if (missingDialogs.length) {
  console.log('[dialog] 缺失（多为纯文本目标，如“提交 1 个xxx。”）：')
  console.log('  ' + missingDialogs.slice(0, 30).join('、'))
}

// ---------- 3.5 生成剧情名称索引（GAoNanoFileList 的 des，页面用作剧情标题） ----------
if (fs.existsSync(FILELIST)) {
  const fl = JSON.parse(fs.readFileSync(FILELIST, 'utf-8'))
  const flFiles = Array.isArray(fl) ? fl : fl.files || []
  const dialogIndex = {}
  for (const f of flFiles) {
    if (f && f.type === 'script' && f.name) dialogIndex[f.name] = f.des || ''
  }
  writeJson(path.join(DATA, 'parsed', 'dialogIndex.json'), dialogIndex)
  console.log(`[dialog] 剧情名称索引已生成（${Object.keys(dialogIndex).length} 条）-> public/data/parsed/dialogIndex.json`)
}

// ---------- 3.6 生成分段事件索引（基名 -> 段列表，用于好感度剧情按段分开展示） ----------
const segmentIndex = {}
for (const id of dialogIds) {
  const m = /^(.*)_\d+$/.exec(id)
  if (!m) continue
  const baseId = m[1]
  if (segmentIndex[baseId]) continue
  const segs = []
  let idx = 0
  while (fs.existsSync(path.join(GAO, `${baseId}_${idx}.json`))) {
    segs.push(`${baseId}_${idx}`)
    idx++
  }
  if (segs.length >= 2) segmentIndex[baseId] = segs
}
writeJson(path.join(DATA, 'parsed', 'dialogSegments.json'), segmentIndex)
console.log(`[dialog] 分段事件索引已生成（${Object.keys(segmentIndex).length} 个事件）-> public/data/parsed/dialogSegments.json`)

// ---------- 4. 基础引用解析率校验 ----------
const levelStage = readJson(path.join(SRC, 'levelStage.json')).datas
const levelRoom = readJson(path.join(SRC, 'levelRoom.json')).datas
const area = readJson(path.join(SRC, 'area.json')).datas
const instance = readJson(path.join(SRC, 'instance.json')).datas
const battle = readJson(path.join(SRC, 'battle.json')).datas

const instBattleIds = new Set()
for (const iv of Object.values(instance)) {
  for (const b of iv.battles || []) if (b.dungeonBattle) instBattleIds.add(b.dungeonBattle)
}

const unresolved = new Set()
const resolve = (id) => {
  if (levelStage[id] || levelRoom[id] || area[id] || instance[id] || battle[id] || instBattleIds.has(id)) return true
  if (id.includes('_')) {
    const prefix = id.split('_')[0]
    if (area[prefix]) return true
  }
  unresolved.add(id)
  return false
}

let refTotal = 0
let refMiss = 0
const stepTypes = new Map()
const demoCount = { demo: 0, pa: 0, close: 0 }
for (const t of Object.values(task)) {
  const cat = t.category || []
  const isDemo = cat.includes('demo') || cat.includes('demo支线') || String(t.typeId).startsWith('demo_')
  const isPa = JSON.stringify(cat) === JSON.stringify(['伙伴档案'])
  if (isDemo) { demoCount.demo++; continue }
  if (isPa) { demoCount.pa++; continue }
  if (t.close) demoCount.close++

  for (const u of t.unlockStage || []) { refTotal++; if (!resolve(u)) refMiss++ }
  for (const s of t.steps || []) {
    stepTypes.set(s.stepType, (stepTypes.get(s.stepType) || 0) + 1)
    for (const u of s.stepUnlockStage || []) { refTotal++; if (!resolve(u)) refMiss++ }
    const pos = s.stepPosition || []
    if (pos.length >= 2) { refTotal++; if (!resolve(pos[1])) refMiss++ }
  }
}

writeJson(path.join(DATA, 'parsed', 'task-unresolved.json'), {
  generatedAt: new Date().toISOString(),
  summary: {
    taskTotal: Object.keys(task).length,
    removedDemo: demoCount.demo,
    removedPartnerArchive: demoCount.pa,
    keptClosed: demoCount.close,
    refTotal,
    refMiss
  },
  stepTypes: Object.fromEntries([...stepTypes.entries()].sort()),
  unresolved: [...unresolved].sort()
})

console.log(`[check] 任务总数 ${Object.keys(task).length}，删除 demo ${demoCount.demo}，删除伙伴档案 ${demoCount.pa}，保留已下架 ${demoCount.close}`)
console.log(`[check] 引用总数 ${refTotal}，未命中 ${refMiss}`)
console.log(`[check] stepType 分布：`, Object.fromEntries([...stepTypes.entries()].sort()))
console.log(`[check] 报告已写入 public/data/parsed/task-unresolved.json`)
