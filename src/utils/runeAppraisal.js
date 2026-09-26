// Config-based independent draws. The supplied client receives actual results from the server.
export function pickWeighted(entries, roll) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = roll * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor <= 0) return entry
  }
  return entries[entries.length - 1]
}

export function appraiseRunes(acquisition, count, random = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > 999) throw new RangeError('Appraisal count must be an integer from 1 to 999')
  const group = acquisition?.groups?.[0]
  if (acquisition?.action !== 'appraisal' || acquisition.groups.length !== 1
    || group.kind !== 'random' || group.rate !== 1 || group.num !== 1
    || !group.rules?.length || group.rules.some(rule => rule.mode !== 'item' || !rule.typeId
      || rule.min !== 1 || rule.max !== 1 || !Number.isFinite(Number(rule.chance)) || Number(rule.chance) < 0)) {
    throw new Error('Unsupported rune appraisal configuration')
  }
  const entries = group.rules.map(rule => ({ rule, weight: Number(rule.chance) })).filter(entry => entry.weight > 0)
  if (!entries.length) throw new Error('Missing rune appraisal weights')
  const draws = []
  const totals = new Map()
  for (let index = 0; index < count; index++) {
    // 注入的随机源必须显式校验。`pickWeighted` 对越界/NaN 会一路落到最后一个候选，
    // 于是非法随机性会产出"看起来正常、其实毫无随机性"的结果而不报错——
    // 与这里对 count、对配置的显式校验保持一致，宁可抛错也不要静默给错结果。
    const roll = random()
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new RangeError('Appraisal randomness must be a finite number in [0, 1)')
    }
    const { rule } = pickWeighted(entries, roll)
    draws.push(rule.typeId)
    const previous = totals.get(rule.typeId)
    if (previous) previous.count++
    else totals.set(rule.typeId, { typeId: rule.typeId, name: rule.targetName,
      icon: rule.targetImg, quality: rule.targetQuality, count: 1 })
  }
  return { sourceItemId: acquisition.sourceItemId, count, draws, results: [...totals.values()] }
}
