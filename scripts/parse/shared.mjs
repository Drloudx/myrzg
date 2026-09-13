/**
 * scripts/parse 共用工具：优先读取 raw/ 原始表，public/data 仅兼容旧输入与派生产物。
 * 所有预解析脚本（*.mjs）统一从这里取数据，产物统一写到 public/data/parsed/
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const publicDataDir = join(repoRoot, 'public', 'data')
export const parsedDir = join(publicDataDir, 'parsed')
export const rawDir = join(repoRoot, 'raw')

/** 读取原始 JSON：优先 raw/（构建期原始表，不进 repo/dist），缺失时兜底 public/data。
 *  mon.json 项目修正（critDam 拼写 + 特殊单位图标）统一由 normalizeMonJson 归一化注入。
 */
export function readJson(relativePath) {
  // raw/ 优先（构建期原始表，不进 repo/dist）；文件不在 raw/ 时兜底 public/data。
  // 未迁移前 raw/ 为空 → 走 public/data，行为不变；迁移后 build 自动改用 raw/。
  const rawPath = join(rawDir, relativePath)
  const baseDir = existsSync(rawPath) ? rawDir : publicDataDir
  const data = JSON.parse(readFileSync(join(baseDir, relativePath), 'utf8'))
  if (relativePath === 'mon.json') return normalizeMonJson(data)
  return data
}

/**
 * mon.json 归一化（把项目对原始表的必要修正挪到预处理，raw 表保持原始版）：
 * 1) unitData.cirtDam（游戏源码拼写错误）→ critDam（app 读的是 critDam）
 * 2) 特殊单位（召唤物/塔层装置/NPC/石魔等）图标重定向到真实存在的头像（原始指向错误/通用/空图标）
 */
const MON_ICON_OVERRIDES = {
  '042': 'avatar_Mon_092', '042_tower1_35': 'avatar_Mon_092', '042_tower1_70': 'avatar_Mon_092', '042_2': 'avatar_Mon_092',
  'hero029_1': 'hero029_1', 'hero029_2': 'hero029_2', 'hero026_1': 'hero026_1',
  'scfx_towerMon': 'avatar_obj_000700_test2', 'hanbingbaotong001': 'avatar_obj_000700_11',
  '069_jianci': 'avatar_obj_mon069', 'car_back': 'car_back', 'car_front': 'car_front', 'car_idle': 'car_idle',
  'hero019_npc_noAtk': 'at019_0', 'hero064_npc_noAtk': 'at064_0', 'hero034_mon': 'hero034_mon',
  '066HeroMon': 'avatar_obj_npc066', 'Mon055StoneMon': 'avatar_obj_mon055', '003SummonMon': 'avatar_Mon_003_Summon',
  'tower1_protected': 'avatar_obj_007_01', 'tower1_damaged': 'avatar_obj_007_02',
  'mon_094': 'avatar_Mon_094', '065Summon1': '065Summon1', '065Summon2': '065Summon2',
  'hero046Mon1': 'hero046Mon1', 'hero046Mon2': 'hero046Mon2'
}
export function normalizeMonJson(monJson) {
  const datas = monJson?.datas || monJson
  if (!datas || typeof datas !== 'object') return monJson
  for (const id of Object.keys(datas)) {
    const entry = datas[id]
    if (!entry || typeof entry !== 'object') continue
    // 1) critDam 拼写修正（幂等：已带 critDam 则跳过，避免重复）
    if (entry.unitData && 'cirtDam' in entry.unitData && !('critDam' in entry.unitData)) {
      entry.unitData.critDam = entry.unitData.cirtDam
      delete entry.unitData.cirtDam
    }
    // 2) 图标修正
    if (entry.icon && typeof entry.icon === 'string' && MON_ICON_OVERRIDES[id]) {
      entry.icon = MON_ICON_OVERRIDES[id]
    }
  }
  return monJson
}

/** 输出文件体积（KB） */
export function sizeOf(data) {
  return Math.round(Buffer.byteLength(JSON.stringify(data), 'utf8') / 1024)
}
