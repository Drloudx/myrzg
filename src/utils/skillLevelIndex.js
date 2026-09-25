/**
 * 技能等级索引（构建期纯函数）：`buffID → 它是哪个技能的第几级`，以及「游戏内最高能升到几级」。
 *
 * **为什么需要它**：`skill.json` 的 `levelData` 给主动技能配了 **21 级**，每级一份专属 buff
 * （`hero049Skill2Buff1_1` … `_21`，第 N 级的配置直接引用 `_N`）。但游戏内的升级表
 * `heroSkillUpgrade.json` 里 `skillOne` / `skillTwo` 的**每个稀有度都只有 12 行**，源码
 * `HeroSkillUI.cs:245` 直接拿行数当上限：
 *
 * ```csharp
 * num = heroSkillUpgradeConf[SkillTypeName][hero.rare.ToString()].Count;  // = 12
 * if (level >= num) { ... }   // 到上限就隐藏升级按钮
 * ```
 *
 * 也就是 **Lv.13–21 是配置里有、当前客户端升不到的预留等级**。词条库只收录游戏内可达的等级，
 * 否则「穿甲箭」会平白多出 9 个玩家永远查不到的数值版本（21 个胶囊）。
 *
 * **等级不靠 id 后缀猜**：只认 `skill.json` `levelData[N]` 里**直接引用**的 buffID。
 * 猜后缀会误伤 `item_30004`、`monBuff_5003`、`2006_014` 这类恰好以数字结尾的 id。
 */
import { isPlainObject } from './buffParser.js'

/** 收集节点里所有「确实是 buff 表主键」的字符串（比按字段名猜测更准）。 */
function collectReferencedBuffIds(node, buffData, out, depth = 0) {
  if (depth > 8 || node == null) return
  if (typeof node === 'string') {
    if (buffData[node]) out.add(node)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) collectReferencedBuffIds(child, buffData, out, depth + 1)
    return
  }
  if (!isPlainObject(node)) return
  for (const value of Object.values(node)) collectReferencedBuffIds(value, buffData, out, depth + 1)
}

/**
 * 游戏内技能等级上限 = `heroSkillUpgrade` 里该技能类型的升级行数（实测 5 个稀有度都是 12）。
 * 行数不一致时取**最小值**：宁可少收录，也不把升不到的等级当成可达的。
 */
export function resolveSkillLevelCap(heroSkillUpgradeJson) {
  const conf = heroSkillUpgradeJson?.datas || heroSkillUpgradeJson || {}
  const caps = []
  for (const [typeName, byRare] of Object.entries(conf)) {
    if (!isPlainObject(byRare)) continue
    for (const [rare, rows] of Object.entries(byRare)) {
      if (Array.isArray(rows) && rows.length) caps.push({ typeName, rare, count: rows.length })
    }
  }
  return { cap: caps.length ? Math.min(...caps.map(item => item.count)) : 0, caps }
}

/**
 * 建立等级索引。
 *
 * 返回的 `levelOf` 只包含「被某个技能等级直接引用」的 buff；同一个 buff 被多级引用时取最小等级。
 * 拿不到等级的 buff（普攻、天赋、升星、怪物异变、物品等）不在索引里，一律视为可达。
 */
export function buildSkillLevelIndex({ skillJson, buffJson, heroSkillUpgradeJson } = {}) {
  const buffData = buffJson || {}
  const { cap, caps } = resolveSkillLevelCap(heroSkillUpgradeJson)
  const levelOf = new Map()

  for (const [skillId, skill] of Object.entries(skillJson || {})) {
    const levelData = skill?.levelData
    if (!isPlainObject(levelData)) continue
    for (const [levelKey, node] of Object.entries(levelData)) {
      const level = Number(levelKey)
      if (!Number.isFinite(level) || level <= 0) continue
      const ids = new Set()
      collectReferencedBuffIds(node, buffData, ids)
      for (const id of ids) {
        const prev = levelOf.get(id)
        if (prev && prev.level <= level) continue
        levelOf.set(id, {
          skillId: String(skillId),
          skillName: String(skill?.name || ''),
          level
        })
      }
    }
  }

  return {
    cap,
    caps,
    levelOf,
    /** 取某条 buff 的技能等级信息；没有就返回 null。 */
    infoOf: buffId => levelOf.get(String(buffId || '')) || null,
    /** 该 buff 是否属于游戏内可达的等级。拿不到等级的 buff 一律视为可达。 */
    isReachable(buffId) {
      const info = levelOf.get(String(buffId || ''))
      if (!info || !cap) return true
      return info.level <= cap
    }
  }
}
