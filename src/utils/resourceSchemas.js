export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isList = value => Array.isArray(value) && value.every(isRecord)
const hasId = (entry, key = 'id') => typeof entry?.[key] === 'string' && entry[key].length > 0
const recordList = (value, key = 'id') => isList(value)
  && value.every(entry => hasId(entry, key) && typeof entry.name === 'string')
const runeEffect = value => isRecord(value) && Number.isInteger(value.level)
  && Array.isArray(value.positions) && Array.isArray(value.positionLabels)
  && typeof value.description === 'string' && typeof value.desHtml === 'string'
const acquisition = value => isRecord(value) && isList(value.costs) && isList(value.groups)
  && value.groups.every(group => Number.isFinite(group.num) && isList(group.rules))

const schemas = {
  'data/parsed/runes.json': data => isRecord(data) && data.schemaVersion === 1
    && recordList(data.runes) && data.runes.every(entry => runeEffect(entry.effect))
    && recordList(data.appraisals) && data.appraisals.every(entry => acquisition(entry.acquisition))
    && recordList(data.syntheses) && data.syntheses.every(entry => acquisition(entry.acquisition)
      && hasId(entry.input) && runeEffect(entry.input.effect) && hasId(entry.output) && runeEffect(entry.output.effect))
    && isList(data.enchantCosts) && isRecord(data.sources) && Object.values(data.sources).every(isList),
  'data/parsed/gacha.json': data => isRecord(data) && data.schemaVersion === 1 && data.modelVersion === 'config-v1'
    && recordList(data.pools) && data.pools.every(pool => ['hero', 'pet'].includes(pool.kind)
      && typeof pool.stateKey === 'string' && typeof pool.poolTypeId === 'string' && typeof pool.slotId === 'string'
      && (pool.opensAt === null || Number.isFinite(pool.opensAt)) && (pool.closesAt === null || Number.isFinite(pool.closesAt))
      && isRecord(pool.assets) && typeof pool.assets.cover === 'string' && isList(pool.costs) && isList(pool.bonus)
      && isList(pool.tiers) && pool.tiers.length > 0 && pool.tiers.every(tier => typeof tier.key === 'string'
        && Number.isFinite(tier.weight) && tier.weight > 0 && isList(tier.candidates) && tier.candidates.length > 0
        && tier.candidates.every(entry => typeof entry.typeId === 'string' && typeof entry.name === 'string'
          && typeof entry.icon === 'string' && Number.isFinite(entry.weight) && entry.weight > 0))),
  'data/parsed/items.json': data => isRecord(data) && recordList(data.items, 'typeId')
    && Array.isArray(data.categoryTree) && Array.isArray(data.avatars)
    && ['lanDict', 'rewards', 'equipEnchants', 'skillTriggers', 'equipGroups', 'equipSuits', 'itemAffixes']
      .every(key => isRecord(data[key])),
  'data/parsed/furniture.json': data => isRecord(data) && recordList(data.furniture)
    && data.furniture.every(entry => Array.isArray(entry.categoryIds)
      && Array.isArray(entry.sourceTags) && isList(entry.skins)
      && isList(entry.blueprints) && isRecord(entry.consume)
      && Array.isArray(entry.consume.items) && Array.isArray(entry.consume.currencies)
      && isRecord(entry.condition))
    && isList(data.categories) && isRecord(data.stats),
  'data/parsed/facilities.json': data => Array.isArray(data) && data.every(facility => typeof facility?.key === 'string'
    && typeof facility?.name === 'string'
    && typeof facility.icon === 'string'
    && Array.isArray(facility.modes)
    && (facility.key === 'camp'
      ? recordList(facility.buildings) && recordList(facility.research)
        && facility.buildings.every(building => isList(building.levels) && building.levels.every(level =>
          Number.isFinite(level.level) && Array.isArray(level.stats) && Array.isArray(level.recipes)
          && (level.upgrade === null || isRecord(level.upgrade) && Array.isArray(level.upgrade.costs) && Array.isArray(level.upgrade.rewards))))
        && facility.research.every(research => isList(research.levels) && research.levels.every(level =>
          Number.isFinite(level.level) && Array.isArray(level.costs) && Array.isArray(level.recipes)))
      : typeof facility.facilityId === 'string' && facility.modes.every(mode => typeof mode?.key === 'string'
      && typeof mode?.name === 'string'
      && Array.isArray(mode.levels)
      && Array.isArray(mode.recipes)
      && mode.recipes.every(recipe => typeof recipe?.id === 'string' && isRecord(recipe.output) && Array.isArray(recipe.materials))))),
  'data/parsed/heroes.json': data => isRecord(data) && recordList(data.heroes)
    && data.heroes.every(hero => isRecord(hero.unitData) && isList(hero.skills))
    && recordList(data.mailboxes) && data.mailboxes.every(box => isList(box.mails)
      && box.mails.every(mail => hasId(mail) && [1, 2].includes(mail.mailType)
        && typeof mail.title === 'string' && typeof mail.content === 'string'
        && typeof mail.hasAttachment === 'boolean'))
    && ['heroLevel', 'heroRank', 'consumeDatas'].every(key => isRecord(data[key]))
    && Number.isFinite(data.playerLevelCap) && data.playerLevelCap > 0,
  'data/parsed/pets.json': data => isRecord(data) && recordList(data.pets)
    && data.pets.every(pet => isList(pet.skills))
    && isRecord(data.petLevel) && isRecord(data.petSetting)
    && Number.isFinite(data.playerLevelCap) && data.playerLevelCap > 0,
  'data/parsed/monsters.json': data => isRecord(data) && recordList(data.monsters)
    && data.monsters.every(monster => recordList(monster.forms) && monster.forms.length > 0
      && monster.forms.every(form => isRecord(form.rawStats) && isList(form.skills))),
  'data/parsed/monLevelStrength.json': data => {
    const levels = data?.datas?.monLevelStrength || data?.monLevelStrength
    return isRecord(levels) && Object.keys(levels).length > 0
      && Object.values(levels).every(level => isRecord(level)
        && Number.isFinite(level.coefficient) && level.coefficient > 0)
  },
  'data/parsed/tasks.json': data => isRecord(data) && recordList(data.tasks)
    && data.tasks.every(task => isList(task.steps) && isRecord(task.getTask))
    && isRecord(data.subOptions) && isRecord(data.stats),
  'data/parsed/recipes.json': data => isRecord(data) && recordList(data.recipes),
  'data/parsed/item-sources.json': data => isRecord(data) && Object.values(data).every(isList)
}

export function validateResource(path, data) {
  const validate = schemas[path]
  if (validate ? !validate(data) : data === null || typeof data !== 'object') {
    throw new Error(`数据格式不完整，请重试或更新应用：${path}`)
  }
  return true
}
