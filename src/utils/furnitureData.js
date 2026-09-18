import { isBlacklisted } from '../config/blacklist.js'
import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, getMapName, getSourceTagName } from './gameMappings.js'
import { fetchWithFallback } from './request.js'
import { createCachedLoader } from './resourceClient.js'

const FURNITURE_ACTIONS = new Set(['unlockHomeItem', 'unlockHomeItemSkin'])
const NON_CATALOG_HOME_ITEMS = new Set(['cultivation001', 'petRoom01'])
const FIXED_CAMP_FACILITIES = new Set(['mailBox', 'carriage'])
const ROOM_OBJECT_PREVIEW_IMAGES = {
  // This is the actual in-world mailbox shown by the game, not the build-list
  // placeholder stored in homeItem.icon.
  c001_ludeng001: '/RoomObj/c001_ludeng001.webp'
}
const PLACE_NAMES = {
  all: '营地/房间',
  camp: '营地',
  room: '房间'
}
const CONSUME_CURRENCIES = ['money', 'ke', 'ti', 'speed', 'payKe']

const asRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const asArray = value => Array.isArray(value) ? value : []
const homeItemMapOf = value => asRecord(value?.furniture || value?.datas || value)
const itemMapOf = value => asRecord(value?.datas || value)
const consumeMapOf = value => asRecord(value?.datas || value)
const conditionMapOf = value => asRecord(value?.gameConditions || value?.datas || value)
const taskMapOf = value => asRecord(value?.datas || value)
const skinLevel = skin => Math.max(0, Number.parseInt(skin?.homeLevel, 10) || 0)

function pickDefaultHomeItemSkin(homeItem, playerData, currentHomeLevel) {
  const skins = asArray(homeItem?.skin)
  const level = Math.max(0, Number(currentHomeLevel) || 0)
  let selected = null

  // FurnitureData.GetDefaltHomeItemSkin first walks player allSkins in its saved order.
  let selectedLevel = 0
  for (const type of asArray(playerData?.allSkins)) {
    const skin = skins.find(entry => entry?.type === type)
    if (!skin) continue
    const requiredLevel = skinLevel(skin)
    if (requiredLevel <= level && selectedLevel <= requiredLevel) {
      selected = skin
      selectedLevel = requiredLevel
    }
  }

  // If no owned skin is eligible, use config-unlocked skins in config order.
  if (!selected) {
    selectedLevel = 0
    for (const skin of skins) {
      const requiredLevel = skinLevel(skin)
      if (skin?.unlock === true && requiredLevel <= level && selectedLevel <= requiredLevel) {
        selected = skin
        selectedLevel = requiredLevel
      }
    }
  }

  return selected
}

/**
 * Mirrors FurnitureData.GetDefaltHomeItemSkin. The web catalog has no live
 * workshop level, so callers default to level 0. Equal-level later entries win.
 */
export function resolveDefaultHomeItemSkin(homeItem, playerData = null, currentHomeLevel = 0) {
  if (typeof playerData === 'number' && arguments.length < 3) {
    currentHomeLevel = playerData
    playerData = null
  }
  if (playerData && typeof playerData === 'object' && arguments.length < 3
    && playerData.homeLevel !== undefined) {
    currentHomeLevel = playerData.homeLevel
  }
  if (Array.isArray(playerData)) playerData = { allSkins: playerData }
  const selected = pickDefaultHomeItemSkin(homeItem, playerData, currentHomeLevel)
  if (!selected) return null
  return { ...selected, icon: selected.icon || '' }
}

/** Static catalog policy: the source exclusion plus entries explicitly marked as drafts in config. */
export function isFurnitureCatalogEntry(homeItem) {
  if (!homeItem || NON_CATALOG_HOME_ITEMS.has(String(homeItem.typeId || homeItem.id || ''))) return false
  const categories = Array.isArray(homeItem.category) ? homeItem.category : [homeItem.category]
  return ![homeItem.name, ...categories].some(value => /废稿/.test(String(value || '')))
}

/**
 * Resolve only the two item actions consumed by BackpackServerData. Relations
 * are keyed exclusively by useActionPara.homeItems[].typeId, never by names.
 */
export function resolveHomeItemUnlocks(item, homeItemRes) {
  if (!item || !FURNITURE_ACTIONS.has(item.useAction)) return []
  const homeItems = homeItemMapOf(homeItemRes)

  return asArray(item.useActionPara?.homeItems).flatMap(reference => {
    const typeId = String(reference?.typeId || '')
    const homeItem = homeItems[typeId]
    if (!typeId || !homeItem) return []

    const skinIds = asArray(reference.skin).map(String).filter(Boolean)
    const resolvedSkins = skinIds.map(skinId =>
      asArray(homeItem.skin).find(skin => skin?.type === skinId) || null
    )
    const firstSkin = resolvedSkins[0]
    const icon = item.useAction === 'unlockHomeItemSkin'
      ? (firstSkin?.icon || '')
      : (homeItem.icon || '')

    return [{
      typeId,
      name: homeItem.name || typeId,
      icon,
      quality: Number(homeItem.quality) || 0,
      action: item.useAction,
      skinIds,
      skinNames: resolvedSkins.map((skin, index) => skin?.name || skinIds[index]),
      catalogVisible: isFurnitureCatalogEntry(homeItem)
    }]
  })
}

const trimSentenceEnd = value => String(value || '').trim().replace(/[。.!！?？]+$/u, '')

function formatConditionRule(rule, tasks, battles) {
  const para = asRecord(rule?.para)
  const required = rule?.need === true

  if (rule?.type === 'level' && Number.isFinite(Number(para.min))) {
    const text = `玩家等级达到 ${Number(para.min)} 级`
    return required ? text : `玩家等级未达到 ${Number(para.min)} 级`
  }

  if (rule?.type === 'passTask' && para.typeId) {
    const taskId = String(para.typeId)
    const step = Math.max(0, Number.parseInt(para.step, 10) || 0)
    const task = tasks[taskId]
    const taskName = task?.name ? `《${task.name}》` : `任务 ${taskId} `
    const stepName = step > 0 ? trimSentenceEnd(asArray(task?.steps)[step - 1]?.stepName) : ''
    const target = `${taskName}第 ${step} 步${stepName ? `「${stepName}」` : ''}`
    return required ? `完成${target}` : `尚未完成${target}`
  }

  if (rule?.type === 'passBattle' && asArray(para.battles).length) {
    const names = para.battles.map(id => battles[id]?.name)
    if (names.some(name => !name)) return ''
    return `${required ? '通关' : '尚未通关'}${names.map(name => `《${name}》`).join('、')}`
  }

  return ''
}

/**
 * Mirrors CheckResultConditions for the condition types referenced by homeItem.
 * Rule-level `need` is applied before the condition-level reverse of the AND result.
 */
export function formatFurnitureCondition(condition, taskRes = {}, battleRes = {}) {
  const rules = asArray(condition?.rules)
  const tasks = taskMapOf(taskRes)
  const texts = rules.map(rule => formatConditionRule(rule, tasks, taskMapOf(battleRes))).filter(Boolean)
  if (!texts.length || texts.length !== rules.length) return ''
  const joined = texts.join('；且')
  return condition?.reverse === true ? `不满足以下全部条件：${joined}` : joined
}

function normalizeCategories(settingRes) {
  const source = asArray(settingRes?.data?.typeSetting?.homeItem_type)
  const normalize = entry => ({
    type: String(entry?.type ?? ''),
    name: String(entry?.name || entry?.type || ''),
    ...(Array.isArray(entry?.info) ? { info: entry.info.map(normalize) } : {})
  })
  return source.map(normalize)
}

function categoryLookups(categories) {
  const names = new Map()
  for (const main of categories) {
    names.set(main.type, main.name)
    for (const sub of asArray(main.info)) names.set(sub.type, sub.name)
  }
  return names
}

function buildConsume(consumeId, consumes, items) {
  const consume = consumes[consumeId]
  if (!consume) return { id: consumeId || '', items: [], currencies: [] }

  const materialItems = asArray(consume.items).flatMap(entry => {
    const item = items[entry?.typeId]
    if (!entry?.typeId || !item) return []
    return [{
      typeId: entry.typeId,
      name: item.name || entry.typeId,
      img: `/Common_ItemIcon/${item.img || entry.typeId}.webp`,
      quality: Number(item.quality) || 0,
      num: Number(entry.num) || 0
    }]
  })

  const currencies = CONSUME_CURRENCIES.flatMap(field => {
    const num = Number(consume[field]) || 0
    if (num <= 0) return []
    const typeId = BASE_REWARD_ICONS[field]
    const item = items[typeId]
    return [{
      typeId,
      name: item?.name || BASE_REWARD_NAMES[field] || field,
      img: `/Common_ItemIcon/${item?.img || typeId}.webp`,
      quality: Number(item?.quality) || 0,
      num
    }]
  })

  return { id: consumeId || '', items: materialItems, currencies }
}

function countBy(entries, keyOf) {
  return entries.reduce((counts, entry) => {
    const key = String(keyOf(entry) ?? '')
    if (key) counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
}

/**
 * 家具「获取方式」（`homeItem.tip`）里的原始 ID → 可读名称。
 *
 * 游戏配置里 tip 直接写了内部 ID，例如 `c1商店购买：market50011`、`长支线s_1_13格薇勒与秘密基地`、
 * `c2委托兑换 weituo_item_50030`。这些 ID 对用户没有意义，这里按**权威配置关系**换成名称：
 *
 * - `market*`  → `reward.json` 的 `items[0].rules[0].typeId`（制作图）
 *              → `item.json` 的 `useActionPara.homeItems[0].typeId`（家具）
 *              → 家具名。这条链与 `itemParser.js` 判定制作图归属用的是同一套关系。
 *              注意不能用 `itemExchange.market*.des`：其中若干条是配置时复制的占位串
 *              （如 market50027/50100/50101/50102 的 des 都是 "c1_q2原木小柜"），会张冠李戴。
 * - `weituo_item_NNN` → 去掉前缀取 `item_NNN` 的名称（制作图）
 * - `s_*` / `m_*`（任务）→ `task.json` 的 name + category（支线/主线）+ 章节对应的地区
 * - `c1`..`c5` → 地区名（与 `gameMappings.js` 的 MAP_NAMES 一致）
 */
const CHAPTER_TO_MAP = { 序章: 'c0', 第一章: 'c1', 第二章: 'c2', 第三章: 'c3', 第四章: 'c4', 第五章: 'c5' }

/** market ID → 家具名；链断则退回制作图名（去掉「制作图」后缀）。 */
function resolveMarketName(marketId, rewards, items, homeItems) {
  const reward = rewards[String(marketId)]
  const blueprintId = reward?.items?.[0]?.rules?.[0]?.typeId
  if (!blueprintId) return ''
  const blueprint = items[String(blueprintId)]
  const homeId = blueprint?.useActionPara?.homeItems?.[0]?.typeId
  if (homeId && homeItems[String(homeId)]) return homeItems[String(homeId)].name || ''
  return String(blueprint?.name || '').replace(/制作图$/u, '')
}

/** 任务 ID → `地区 类型 「任务名」`。 */
function resolveTaskLabel(taskId, tasks) {
  const task = tasks[String(taskId)]
  if (!task) return ''
  const categories = asArray(task.category).map(String)
  const chapter = categories.find(name => CHAPTER_TO_MAP[name])
  const region = chapter ? getMapName(CHAPTER_TO_MAP[chapter]) : ''
  const kind = categories.find(name => name === '主线' || name === '支线')
    || (/^m/u.test(String(taskId)) ? '主线' : '支线')
  return [region, kind, `「${task.name || ''}」`].filter(Boolean).join(' ')
}

/** 把 tip 里的 ID 全部换成可读名称。 */
function formatAcquisitionNote(homeItem, { rewards = {}, tasks = {}, items = {}, homeItems = {} } = {}) {
  const raw = trimSentenceEnd(homeItem?.tip)
  if (!raw) return '开启奖励宝箱后获得'

  // 先统一分隔逗号，**在替换任务名之前做**，否则任务名内部的逗号会被一起改掉。
  let text = raw.replace(/[，,]\s*/gu, ' / ')

  // 「爬塔」是玩家俗称、且后面跟的内部编号（如「爬塔1兑换」「爬塔1家具」）对用户无意义，
  // 统一换成游戏内正式名「神匠之塔」，并去掉编号。
  text = text.replace(/爬塔\s*[0-9]*/gu, '神匠之塔')

  // 任务：先剥离原文自带的「地区码 + 类型词」前缀（c1商店购买 / c2任务支线 / C3支线 / 长支线 / 种植支线 …），
  // 再让 resolveTaskLabel 统一生成「地区 类型 「名字」」。否则前缀会与生成的标签叠成
  // 「长支线秋日荒野 支线」「索利德山地任务支线：索利德山地 支线」这类重复文案。
  text = text.replace(
    /(?:[cC][1-5]\s*)?(?:长?支线|种植支线|任务\s*[:：]?\s*支线|任务|成就|商店(?:购买)?|委托兑换)\s*[:：]?\s*(?=[sm]_[0-9])/gu,
    ''
  )

  text = text
    .replace(/market[0-9]+/gu, id => resolveMarketName(id, rewards, items, homeItems) || id)
    .replace(/weituo_item_([0-9]+)/gu, (whole, num) => items[`item_${num}`]?.name || whole)
    .replace(/([sm]_[0-9]+(?:_[0-9]+)*)([^\s/：:（(]*)/gu, (whole, id, trailing) => {
      const label = resolveTaskLabel(id, tasks)
      if (!label) return whole
      // 原文在 ID 后常又跟一遍任务名（如「s_1_13格薇勒与秘密基地」），吃掉它避免重复
      const taskName = tasks[id]?.name || ''
      const eaten = trailing && taskName && (trailing === taskName || taskName.startsWith(trailing)) ? trailing : ''
      return label + (eaten ? '' : trailing)
    })

  // 残留地区码
  text = text.replace(/([cC][1-5])\b/gu, whole => getMapName(whole.toLowerCase()) || whole)
  // 相邻重复片段折叠（兜底，覆盖「魔爪湖畔魔爪湖畔」这类）
  text = text.replace(/([\u4e00-\u9fa5]{2,6}?)\1(?=\s*(?:主线|支线))/gu, '$1')

  // 末尾形如 `/ 贝拉多娜` 的残留：任务名已用「」标出，其后若只剩一个短片段且非「第N步」，
  // 说明是原文重复的尾巴，去掉。
  text = text.replace(/(「[^」]*」)\s*\/\s*([^/]{1,12})$/u, (whole, quoted, tail) =>
    /第\s*\d+\s*步/u.test(tail) ? whole : quoted)

  return text.replace(/\s{2,}/gu, ' ').trim()
}

function roomObjectPreviewImage(roomObj) {
  return ROOM_OBJECT_PREVIEW_IMAGES[String(roomObj || '')] || ''
}

function buildCraftingState(homeItem, initialNum) {
  const typeId = String(homeItem?.typeId || '')
  if (FIXED_CAMP_FACILITIES.has(typeId)) {
    return { available: false, note: '营地固定设施，无需制作' }
  }

  const maxNum = Number(homeItem?.cntMax) || 0
  if (maxNum > 0 && initialNum >= maxNum) {
    return { available: false, note: '初始拥有，无需制作' }
  }

  return { available: true, note: '' }
}

/** Build the furniture encyclopedia data from the exact game configuration relations. */
export function buildFurnitureData({
  homeItemRes,
  itemRes,
  settingRes,
  consumeRes,
  playerInitRes,
  conditionRes,
  taskRes,
  rewardRes
}) {
  const homeItems = homeItemMapOf(homeItemRes)
  const items = itemMapOf(itemRes)
  const consumes = consumeMapOf(consumeRes)
  const conditions = conditionMapOf(conditionRes)
  const tasks = asRecord(taskRes?.datas || taskRes)
  const rewards = asRecord(rewardRes?.datas || rewardRes)
  const categories = normalizeCategories(settingRes)
  const categoryNames = categoryLookups(categories)
  const initialNums = new Map(asArray(playerInitRes?.homeItems || playerInitRes?.data?.homeItems)
    .map(entry => [String(entry?.typeId || ''), Number(entry?.num) || 0]))
  const blueprintsByFurniture = new Map()

  for (const item of Object.values(items)) {
    // Visibility is a catalog concern; resolveHomeItemUnlocks remains a source-faithful relation parser.
    if (isBlacklisted(item)) continue
    for (const unlock of resolveHomeItemUnlocks(item, homeItems)) {
      const blueprints = blueprintsByFurniture.get(unlock.typeId) || []
      blueprints.push({
        typeId: item.typeId,
        name: item.name || item.typeId,
        quality: Number(item.quality) || 0,
        img: item.img || '',
        icon: unlock.icon,
        action: unlock.action,
        skinIds: unlock.skinIds,
        skinNames: unlock.skinNames
      })
      blueprintsByFurniture.set(unlock.typeId, blueprints)
    }
  }

  const furniture = Object.values(homeItems).flatMap((homeItem, configOrder) => {
    if (!isFurnitureCatalogEntry(homeItem)) return []

    const categoryIds = asArray(homeItem.objType).map(String)
    const mainType = categoryIds[0] || ''
    const subType = categoryIds[1] || ''
    const mainName = categoryNames.get(mainType) || mainType
    const subName = categoryNames.get(subType) || subType
    const defaultSkin = pickDefaultHomeItemSkin(homeItem, null, 0)
    // Some functional/event furniture has an empty default-skin icon while its
    // build-list icon is valid. The catalog can still show that source asset.
    const displayIcon = defaultSkin?.icon || homeItem.icon || ''
    const displayImage = roomObjectPreviewImage(defaultSkin?.roomObj || homeItem.roomObj)
    const conditionId = String(homeItem.condition || '')
    const condition = conditions[conditionId]
    const sourceTags = [...asArray(homeItem.category)]
    const sourceLabels = sourceTags.map(tag => getSourceTagName(tag))
    const isAcquisitionCondition = conditionId === 'rewardBox'
    const initialNum = initialNums.get(homeItem.typeId) || 0

    return [{
      id: homeItem.typeId,
      name: homeItem.name || homeItem.typeId,
      quality: Number(homeItem.quality) || 0,
      mainType,
      subType,
      mainName,
      subName,
      categoryIds,
      categoryNames: categoryIds.map(type => categoryNames.get(type) || type),
      sourceTags,
      sourceLabels,
      place: homeItem.place || '',
      placeName: PLACE_NAMES[homeItem.place] || homeItem.place || '',
      icon: homeItem.icon || '',
      displayIcon,
      displayImage,
      displaySkinType: defaultSkin?.type || '',
      displayMode: 'config-level-0',
      desc: defaultSkin?.desc || homeItem.desc || '',
      dec: Number(homeItem.dec) || 0,
      cntMax: Number(homeItem.cntMax) || 0,
      sellMoney: Number(homeItem.sellMoney) || 0,
      consume: buildConsume(homeItem.consume, consumes, items),
      crafting: buildCraftingState(homeItem, initialNum),
      skins: asArray(homeItem.skin).map(skin => ({
        type: skin.type || '',
        name: skin.name || skin.type || '',
        icon: skin.icon || '',
        image: roomObjectPreviewImage(skin.roomObj),
        desc: skin.desc || '',
        unlock: skin.unlock === true,
        homeLevel: skinLevel(skin),
        isDefault: skin === defaultSkin,
        configDefault: skin === defaultSkin
      })),
      blueprints: blueprintsByFurniture.get(homeItem.typeId) || [],
      initialNum,
      condition: {
        id: conditionId,
        label: isAcquisitionCondition ? '获取方式' : '开放条件',
        // 少数家具的 condition 为空（如「豪华露营餐点」）但 tip 里写了来源，此时
        // formatFurnitureCondition 因无 rules 返回空串。回退用 tip，避免该行整条空白；
        // 仅在确有 tip 时回退，否则会误显示 formatAcquisitionNote 的默认句。
        summary: isAcquisitionCondition
          ? formatAcquisitionNote(homeItem, { rewards, tasks, items, homeItems })
          : (formatFurnitureCondition(condition, taskRes)
            || (trimSentenceEnd(homeItem?.tip)
              ? formatAcquisitionNote(homeItem, { rewards, tasks, items, homeItems })
              : '')),
        configNote: condition?.desc || '',
        reverse: condition?.reverse === true,
        rules: asArray(condition?.rules)
      },
      configOrder
    }]
  })

  const stats = {
    total: furniture.length,
    byMainType: countBy(furniture, entry => entry.mainType),
    bySubType: countBy(furniture, entry => entry.subType),
    byQuality: countBy(furniture, entry => entry.quality),
    byPlace: countBy(furniture, entry => entry.place),
    withBlueprint: furniture.filter(entry => entry.blueprints.length > 0).length,
    withoutBlueprint: furniture.filter(entry => entry.blueprints.length === 0).length
  }

  return { furniture, categories, stats }
}

/** Runtime loading is intentionally parsed-data-only. */
export const fetchFurnitureData = createCachedLoader(() =>
  fetchWithFallback('data/parsed/furniture.json')
)
