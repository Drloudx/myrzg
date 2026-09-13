import { isBlacklisted } from '../config/blacklist.js'
import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, getMapName } from './gameMappings.js'
import { fetchWithFallback } from './request.js'
import { createCachedLoader } from './resourceClient.js'

const FURNITURE_ACTIONS = new Set(['unlockHomeItem', 'unlockHomeItemSkin'])
const NON_CATALOG_HOME_ITEMS = new Set(['cultivation001', 'petRoom01'])
const FIXED_CAMP_FACILITIES = new Set(['mailBox', 'carriage'])
const ROOM_OBJECT_PREVIEW_IMAGES = {
  // This is the actual in-world mailbox shown by the game, not the build-list
  // placeholder stored in homeItem.icon.
  c001_ludeng001: '/RoomObj/c001_ludeng001.png'
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
      img: `/Common_ItemIcon/${item.img || entry.typeId}.png`,
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
      img: `/Common_ItemIcon/${item?.img || typeId}.png`,
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

function formatAcquisitionNote(homeItem) {
  const tip = trimSentenceEnd(homeItem?.tip).replace(/[，,]\s*/gu, ' / ')
  if (tip) return tip
  return '开启奖励宝箱后获得'
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
  taskRes
}) {
  const homeItems = homeItemMapOf(homeItemRes)
  const items = itemMapOf(itemRes)
  const consumes = consumeMapOf(consumeRes)
  const conditions = conditionMapOf(conditionRes)
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
    const sourceLabels = sourceTags.map(tag => getMapName(tag))
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
        summary: isAcquisitionCondition
          ? formatAcquisitionNote(homeItem)
          : formatFurnitureCondition(condition, taskRes),
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
