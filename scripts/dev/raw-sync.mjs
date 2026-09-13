import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { resolveChild } from './maintenance-paths.mjs'

export const RAW_ALIASES = Object.freeze({
  'condition.json': ['task/condition.json'],
  'equipEnchant.json': ['equip/equipEnchant.json'],
  'equipGroup.json': ['equip/equipGroup.json'],
  'equipSuit.json': ['equip/equipSuit.json'],
  'equipGlobalConfig.json': ['equip/装备符石数据对应表equipGlobalConfig.json'],
  'equipLevel.json': ['equip/装备升级经验equipLevel.json'],
  'equipDec.json': ['equip/装备分解equipDec.json'],
  ...Object.fromEntries([
    'hero', 'heroArchives', 'heroBehavior', 'heroLevel', 'heroMail',
    'heroRank', 'heroSkillUpgrade', 'heroStar', 'heroTalk'
  ].map(name => [`${name}.json`, [`hero/${name}.json`]])),
  ...Object.fromEntries(['pet', 'petLevel', 'petSetting'].map(name => [`${name}.json`, [`pet/${name}.json`]]))
})

export const DERIVED_RAW_FILES = new Set([
  'dungeonBattle.json', 'dungeonBattleRooms.json', 'dungeonBattleRoutes.json',
  'monsterTowerUsage.json', 'equip/equips.json'
])

export const fileDigest = file => createHash('sha256').update(readFileSync(file)).digest('hex')

export function createRawSyncPlan({ sourceRoot, targetRoot, replace = false, files = null, onInvalid = null }) {
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(`Configuration directory not found: ${sourceRoot}`)
  }
  const sources = []
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith('.json')) sources.push(full)
    }
  }
  if (files) sources.push(...files.map(file => resolveChild(sourceRoot, file)))
  else walk(sourceRoot)

  const plan = new Map()
  for (const source of sources.sort()) {
    const sourceName = relative(sourceRoot, source).replaceAll('\\', '/')
    if (DERIVED_RAW_FILES.has(sourceName)) continue
    const content = readFileSync(source)
    try {
      JSON.parse(content.toString('utf8'))
    } catch (error) {
      if (onInvalid) {
        onInvalid({ source, sourceName, error: error.message })
        continue
      }
      throw new Error(`Invalid JSON ${source}: ${error.message}`)
    }
    const sourceHash = createHash('sha256').update(content).digest('hex')
    const group = []
    for (const targetName of [sourceName, ...(RAW_ALIASES[sourceName] || [])]) {
      const target = resolveChild(targetRoot, targetName)
      const previous = plan.get(target)
      if (previous) {
        if (previous.sourceHash !== sourceHash) throw new Error(`Conflicting source tables for ${targetName}`)
        group.push(previous)
        continue
      }
      const targetHash = existsSync(target) ? fileDigest(target) : null
      const action = !targetHash ? 'add' : targetHash === sourceHash ? 'unchanged' : replace ? 'replace' : 'keep'
      const entry = { source, sourceName, sourceHash, target, targetName, targetHash, action }
      plan.set(target, entry)
      group.push(entry)
    }
    // Filling only a missing alias must not introduce a second version of an existing original.
    if (!replace && group.some(entry => entry.action === 'keep')) {
      for (const entry of group) if (entry.action === 'add') entry.action = 'blocked'
    }
  }
  return [...plan.values()]
}

export function applyRawSyncPlan(plan) {
  const writes = plan.filter(entry => entry.action === 'add' || entry.action === 'replace')
  // Validate the entire plan before the first copy so a changed source cannot cause a partial sync.
  for (const entry of writes) {
    const currentTargetHash = existsSync(entry.target) ? fileDigest(entry.target) : null
    if (fileDigest(entry.source) !== entry.sourceHash || currentTargetHash !== entry.targetHash) {
      throw new Error(`Table changed after preview; rerun synchronization: ${entry.targetName}`)
    }
  }
  for (const entry of writes) {
    mkdirSync(dirname(entry.target), { recursive: true })
    copyFileSync(entry.source, entry.target)
  }
  return writes.length
}
