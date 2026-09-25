/**
 * 物品关联信息与同类物品数据处理模块：
 * 建立物品与其上下游生产、种植、合成、锻造、怪物掉落、角色碎片、魔物蛋等多维关联索引，
 * 以及同系列阶梯（宝箱、好感礼物、同功能药水、同技能符石、种子等）同类物品索引。
 * 纯函数设计，既可在 Node 构建脚本中使用，也可在前端运行时使用。
 */

import { isBlacklisted, isEquipTierHidden } from '../config/blacklist.js'

const EXCLUDE_GLOBAL_CURRENCY_IDS = new Set(['item_00001', 'item_00002', 'item_00004'])

function isTestOrDeprecatedItem(it) {
  if (!it || it.hide) return true
  const n = it.name || ''
  return n.includes('测试') || n.includes('废弃') || n.includes('未使用') || n.startsWith('test_')
}

export function isValidRelationItem(it) {
  if (!it) return false
  if (it.hide) return false
  if (isTestOrDeprecatedItem(it)) return false
  if (isBlacklisted(it)) return false
  if (isEquipTierHidden(it)) return false
  return true
}

/**
 * 构建全量物品关联关系字典 (itemId -> Array<ItemRelation>)
 */
export function buildItemRelations({
  items = [],
  recipes = [],
  heroes = [],
  pets = [],
  monsters = [],
  itemSources = {}
} = {}) {
  const itemList = Array.isArray(items) ? items : (items.items || [])
  const recipeList = Array.isArray(recipes) ? recipes : (recipes.recipes || [])
  const heroList = Array.isArray(heroes) ? heroes : (heroes.heroes || [])
  const petList = Array.isArray(pets) ? pets : (pets.pets || [])
  const monsterList = Array.isArray(monsters) ? monsters : (monsters.monsters || [])

  const itemMap = new Map()
  for (const it of itemList) {
    if (it && it.typeId) itemMap.set(it.typeId, it)
  }

  const heroMap = new Map()
  for (const h of heroList) {
    if (h && h.id) heroMap.set(h.id, h)
  }

  const petMap = new Map()
  for (const p of petList) {
    if (p && p.id) petMap.set(p.id, p)
  }

  const monsterMap = new Map()
  for (const m of monsterList) {
    if (m && m.id) monsterMap.set(m.id, m)
  }

  const relations = {}

  const addRelation = (sourceId, rel) => {
    if (!sourceId || !rel || !rel.id) return
    const sourceItem = itemMap.get(sourceId)
    if (!isValidRelationItem(sourceItem)) return

    if (rel.targetType === 'item') {
      const targetItem = itemMap.get(rel.id)
      if (!isValidRelationItem(targetItem)) return
    } else if (rel.targetType === 'hero') {
      const targetHero = heroMap.get(rel.id)
      if (isBlacklisted(targetHero || { id: rel.id, name: rel.name })) return
    } else if (rel.targetType === 'monster') {
      const targetMonster = monsterMap.get(rel.id)
      if (isBlacklisted(targetMonster || { id: rel.id, name: rel.name })) return
    } else if (rel.targetType === 'pet') {
      const targetPet = petMap.get(rel.id)
      if (isBlacklisted(targetPet || { id: rel.id, name: rel.name })) return
    }

    if (!relations[sourceId]) relations[sourceId] = []
    const exists = relations[sourceId].some(
      r => r.targetType === rel.targetType && r.id === rel.id && r.relationType === rel.relationType
    )
    if (!exists) {
      relations[sourceId].push(rel)
    }
  }

  // 1. 种子与收获物双向关联
  for (const it of itemList) {
    if (it.seedInfo && it.seedInfo.harvest) {
      const harvestId = it.seedInfo.harvest.typeId
      const harvestItem = itemMap.get(harvestId)
      if (harvestItem) {
        addRelation(it.typeId, {
          relationType: 'harvest_product',
          relationLabel: '种植收获',
          targetType: 'item',
          id: harvestItem.typeId,
          name: harvestItem.name,
          icon: harvestItem.img,
          quality: Number(harvestItem.quality) || 1
        })
        addRelation(harvestItem.typeId, {
          relationType: 'harvest_source',
          relationLabel: '种子来源',
          targetType: 'item',
          id: it.typeId,
          name: it.name,
          icon: it.img,
          quality: Number(it.quality) || 1
        })
      }
    }
  }

  // 2. 设施加工配方 (facilityCrafting)
  for (const it of itemList) {
    if (Array.isArray(it.facilityCrafting) && it.facilityCrafting.length > 0) {
      for (const fc of it.facilityCrafting) {
        const facilityName = fc.facilityName || '设施'
        const materials = fc.materials || []
        for (const mat of materials) {
          const matItem = itemMap.get(mat.typeId)
          if (matItem) {
            addRelation(matItem.typeId, {
              relationType: 'craft_product',
              relationLabel: '可加工',
              extra: facilityName,
              targetType: 'item',
              id: it.typeId,
              name: it.name,
              icon: it.img,
              quality: Number(it.quality) || 1
            })
            addRelation(it.typeId, {
              relationType: 'craft_material',
              relationLabel: '制作材料',
              extra: facilityName,
              targetType: 'item',
              id: matItem.typeId,
              name: matItem.name,
              icon: matItem.img,
              quality: Number(matItem.quality) || 1
            })
          }
        }
      }
    }
  }

  // 3. 铁匠铺锻造打造 (smithing)
  for (const it of itemList) {
    if (it.smithing?.recipes && Array.isArray(it.smithing.recipes)) {
      for (const sr of it.smithing.recipes) {
        for (const mat of (sr.materials || [])) {
          const matItem = itemMap.get(mat.typeId)
          if (matItem) {
            addRelation(matItem.typeId, {
              relationType: 'smithing_product',
              relationLabel: '可锻造',
              extra: '锻造台',
              targetType: 'item',
              id: it.typeId,
              name: it.name,
              icon: it.img,
              quality: Number(it.quality) || 1
            })
            addRelation(it.typeId, {
              relationType: 'smithing_material',
              relationLabel: '锻造材料',
              extra: '锻造台',
              targetType: 'item',
              id: matItem.typeId,
              name: matItem.name,
              icon: matItem.img || mat.img || mat.typeId,
              quality: Number(matItem.quality) || 1
            })
          }
        }
      }
    }
  }

  // 4. 料理配方 (recipes)
  for (const rc of recipeList) {
    const productItem = itemMap.get(rc.id)
    if (productItem) {
      const ingredients = rc.ingredients || []
      for (const ing of ingredients) {
        const ingItem = itemMap.get(ing.typeId)
        if (ingItem) {
          addRelation(ingItem.typeId, {
            relationType: 'recipe_product',
            relationLabel: '可烹饪',
            extra: '料理',
            targetType: 'item',
            id: productItem.typeId,
            name: productItem.name,
            icon: productItem.img,
            quality: Number(productItem.quality) || 1
          })
          addRelation(productItem.typeId, {
            relationType: 'recipe_material',
            relationLabel: '烹饪食材',
            extra: '料理',
            targetType: 'item',
            id: ingItem.typeId,
            name: ingItem.name,
            icon: ingItem.img,
            quality: Number(ingItem.quality) || 1
          })
        }
      }
    }
  }

  // 5. 怪物掉落 (monsters)
  for (const m of monsterList) {
    const monsterItemIds = new Set()
    ;(m.baseRewards || []).forEach(br => {
      ;(br.rules || []).forEach(r => {
        if (r.typeId && !EXCLUDE_GLOBAL_CURRENCY_IDS.has(r.typeId)) monsterItemIds.add(r.typeId)
      })
    })
    ;(m.forms || []).forEach(f => {
      ;(f.collectRewards || []).forEach(cr => {
        if (cr.typeId && !EXCLUDE_GLOBAL_CURRENCY_IDS.has(cr.typeId)) monsterItemIds.add(cr.typeId)
      })
    })
    for (const itId of monsterItemIds) {
      addRelation(itId, {
        relationType: 'monster_drop',
        relationLabel: '掉落怪物',
        extra: m.label || '魔物',
        targetType: 'monster',
        id: m.id,
        name: m.name,
        icon: m.icon,
        quality: Number(m.quality) || 3
      })
    }
  }

  // 从 itemSources 中补充标注的怪物掉落
  if (itemSources && typeof itemSources === 'object') {
    for (const [itId, sources] of Object.entries(itemSources)) {
      if (EXCLUDE_GLOBAL_CURRENCY_IDS.has(itId)) continue
      if (!Array.isArray(sources)) continue
      for (const s of sources) {
        if (s.type === 'monster' && monsterMap.has(s.id)) {
          const m = monsterMap.get(s.id)
          addRelation(itId, {
            relationType: 'monster_drop',
            relationLabel: '掉落怪物',
            extra: m.label || '魔物',
            targetType: 'monster',
            id: m.id,
            name: m.name,
            icon: m.icon,
            quality: Number(m.quality) || 3
          })
        }
      }
    }
  }

  // 6. 角色碎片 / 信物 / 招募契约 -> 角色
  for (const it of itemList) {
    if (it.hide) continue
    let heroId = it.heroUnlock?.heroTypeId || it.heroStarUsage?.heroTypeId
    if (!heroId && it.useActionPara?.heros?.[0]?.heroTypeId) {
      heroId = it.useActionPara.heros[0].heroTypeId
    }
    if (!heroId && (it.name?.endsWith('碎片') || it.name?.includes('碎片x'))) {
      const heroName = it.name.replace(/碎片(x\d+)?$/, '').trim()
      const found = heroList.find(h => h.name === heroName)
      if (found) heroId = found.id
    }
    if (heroId && heroMap.has(heroId)) {
      const hero = heroMap.get(heroId)
      const isFragment = it.name.includes('碎片')
      addRelation(it.typeId, {
        relationType: 'hero_link',
        relationLabel: isFragment ? '角色碎片' : '关联角色',
        extra: hero.jobName || '',
        targetType: 'hero',
        id: hero.id,
        name: hero.name,
        icon: hero.icon,
        quality: Number(hero.rare) || 3
      })
    }
  }

  // 7. 宠物蛋 -> 宠物
  for (const it of itemList) {
    if (it.petEggInfo || (it.category && it.category.includes(15))) {
      const pet = petList.find(
        p => p.id === it.typeId || p.eggId === it.typeId || (it.petEggInfo && it.petEggInfo.petName === p.name)
      )
      if (pet) {
        addRelation(it.typeId, {
          relationType: 'pet_link',
          relationLabel: '孵化魔物',
          targetType: 'pet',
          id: pet.id,
          name: pet.name,
          icon: pet.monImg || it.img,
          quality: Number(pet.starDisplay) || Number(pet.quality) || 1
        })
      }
    }
  }

  // 关系排序权重（让最重要的关系排在前面：角色与怪物第一梯队）
  const TYPE_ORDER = {
    hero_link: 1,
    monster_drop: 2,
    harvest_source: 3,
    harvest_product: 4,
    smithing_product: 5,
    smithing_material: 6,
    craft_product: 7,
    craft_material: 8,
    recipe_product: 9,
    recipe_material: 10,
    pet_link: 11
  }

  for (const itemId of Object.keys(relations)) {
    relations[itemId].sort((a, b) => {
      const orderA = TYPE_ORDER[a.relationType] || 99
      const orderB = TYPE_ORDER[b.relationType] || 99
      if (orderA !== orderB) return orderA - orderB
      return (Number(b.quality) || 0) - (Number(a.quality) || 0)
    })
  }

  return relations
}

/**
 * 构建同类/同系列物品索引字典 (itemId -> Array<SimilarItem>)
 * 涵盖：宝箱系列、好感礼物、同功能药水阶梯、同技能符石阶梯、农耕种子、魔物蛋、加工材料阶梯
 */
export function buildSimilarItemsMap(items = []) {
  const itemList = Array.isArray(items) ? items : (items.items || [])
  const validItemList = itemList.filter(it => isValidRelationItem(it))
  const itemMap = new Map()
  for (const it of validItemList) {
    if (it && it.typeId) itemMap.set(it.typeId, it)
  }

  const similarMap = {}

  const registerGroup = (groupItems, labelFn) => {
    if (!groupItems || groupItems.length <= 1) return
    for (const current of groupItems) {
      similarMap[current.typeId] = groupItems.map(it => ({
        id: it.typeId,
        name: it.name,
        icon: it.img,
        quality: Number(it.quality) || 1,
        label: typeof labelFn === 'function' ? labelFn(it) : (labelFn || '同类'),
        isCurrent: it.typeId === current.typeId
      }))
    }
  }

  // 1. 宝箱系列（破旧 -> 木制 -> 铜制 -> 精制 -> 华丽）
  const validChests = validItemList
    .filter(it => (it.category && it.category.includes(25)) || it.name?.includes('宝箱') || it.name?.includes('宝匣'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(validChests, () => '宝箱')

  // 2. 好感礼物系列（全 9 款礼物按好感梯度）
  const validFavs = validItemList
    .filter(it => it.favOpen)
    .sort((a, b) => (Number(a.favValue) || 0) - (Number(b.favValue) || 0) || (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(validFavs, it => (it.favValue ? `+${it.favValue}` : '礼物'))

  // 3. 药水细分系列（按具体功能，互不掺杂）
  const validPotions = validItemList.filter(
    it => it.category && (it.category.includes(31) || it.category.includes('31'))
  )
  // 生命药水
  const hpPotions = validPotions
    .filter(p => p.name?.includes('生命药水'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(hpPotions, () => '生命药')

  // 法力药水
  const mpPotions = validPotions
    .filter(p => p.name?.includes('法力药水'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(mpPotions, () => '法力药')

  // 强化丸
  const pillPotions = validPotions
    .filter(p => p.name?.includes('丸'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(pillPotions, () => '强化丸')

  // 4. 符石系列（同技能 1~6 阶进阶）
  const validRunes = validItemList.filter(
    it => it.category && it.category[0] == 7
  )
  const runeGroups = new Map()
  for (const r of validRunes) {
    const baseName = r.name?.replace(/[ⅠⅡⅢⅣⅤⅥ\d]+$/, '').trim()
    if (!baseName) continue
    if (!runeGroups.has(baseName)) runeGroups.set(baseName, [])
    runeGroups.get(baseName).push(r)
  }
  for (const [, rList] of runeGroups.entries()) {
    const sorted = rList.sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
    registerGroup(sorted, it => {
      const match = it.name?.match(/[ⅠⅡⅢⅣⅤⅥ]+$/)
      return match ? match[0] : `${it.quality || 1}阶`
    })
  }

  // 5. 农耕种子系列
  const validSeeds = validItemList
    .filter(it => it.category?.includes(16) || it.category?.includes('16') || it.seedInfo)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1) || String(a.name).localeCompare(String(b.name)))
  registerGroup(validSeeds, () => '种子')

  // 6. 纪念币系列（各区域委托及挑战赛纪念币）
  const validCoins = validItemList
    .filter(it => it.name?.endsWith('纪念币'))
    .sort((a, b) => {
      const qDiff = (Number(b.quality) || 1) - (Number(a.quality) || 1)
      if (qDiff !== 0) return qDiff
      return String(a.typeId).localeCompare(String(b.typeId))
    })
  registerGroup(validCoins, () => '纪念币')

  // 7. 装备分解板材系列（普通的板材、结实的板材）
  const dismantlePlates = ['item_10074', 'item_10075']
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(dismantlePlates, it => (it.name?.includes('结实') ? '结实' : '普通'))

  // 8. 装备经验道具（铸晶石系列：破碎 -> 稳定 -> 完整）
  const validForgingStones = validItemList
    .filter(it => it.name?.includes('铸晶石'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(validForgingStones, it => {
    if (it.name?.includes('破碎')) return '破碎'
    if (it.name?.includes('稳定')) return '稳定'
    if (it.name?.includes('完整')) return '完整'
    return '铸晶'
  })

  // 9. 角色经验道具（冒险家手记系列：前辈 -> 精英 -> 传说）
  const validExpNotes = validItemList
    .filter(it => it.name?.endsWith('冒险家手记'))
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(validExpNotes, it => {
    if (it.name?.includes('前辈')) return '前辈'
    if (it.name?.includes('精英')) return '精英'
    if (it.name?.includes('传说')) return '传说'
    return '手记'
  })

  // 10. 角色突破材料系列（水、火、风、地等元素碎片与结晶）
  const ELEMENT_ORDER = { 水: 1, 火: 2, 风: 3, 地: 4 }
  const validBreakthroughItems = validItemList
    .filter(it => it.desc?.includes('角色的极限'))
    .sort((a, b) => {
      const qDiff = (Number(a.quality) || 1) - (Number(b.quality) || 1)
      if (qDiff !== 0) return qDiff
      const elA = Object.keys(ELEMENT_ORDER).find(el => a.name?.includes(el)) || ''
      const elB = Object.keys(ELEMENT_ORDER).find(el => b.name?.includes(el)) || ''
      return (ELEMENT_ORDER[elA] || 99) - (ELEMENT_ORDER[elB] || 99)
    })
  registerGroup(validBreakthroughItems, it => {
    const el = Object.keys(ELEMENT_ORDER).find(e => it.name?.includes(e)) || ''
    const stage = it.name?.includes('结晶') ? '结晶' : '碎片'
    return el ? `${el}·${stage}` : '突破'
  })

  // 11. 钱袋系列（直接开启获取银币：小钱袋 -> 大钱袋 -> 快撑破的钱袋）
  const validCoinBags = ['item_20010', 'item_20011', 'item_20012']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(validCoinBags, it => {
    if (it.name?.includes('小')) return '小袋'
    if (it.name?.includes('快撑破')) return '特大'
    return '大袋'
  })

  // 12. 招募契约书与招待券系列
  // 角色招募券
  const heroContracts = ['item_20004', 'item_20004_Y']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(heroContracts, it => (it.typeId === 'item_20004_Y' ? '限定' : '常驻'))

  // 魔物招待券
  const petTickets = ['item_20025', 'item_20023']
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(petTickets, it => (it.name?.includes('特别') ? '特别' : '普通'))

  // 招募副产物徽印
  const gachaSeals = ['item_10081', 'item_20024']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(gachaSeals, it => (it.name?.includes('星型') ? '星型' : '翼型'))

  // 13. 未鉴定符石系列
  // 基础未鉴定符石（小型 -> 中型 -> 大型）
  const basicUnidentifiedRunes = ['item_19300', 'item_19302', 'item_19303']
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(basicUnidentifiedRunes, it => {
    if (it.name?.includes('小型')) return '小型'
    if (it.name?.includes('中型')) return '中型'
    return '大型'
  })

  // 水火未鉴定符石（Ⅰ -> Ⅱ -> Ⅲ）
  const waterFireRunes = ['item_19304', 'item_19305', 'item_19306']
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(waterFireRunes, it => (it.name?.endsWith('Ⅰ') ? 'Ⅰ阶' : it.name?.endsWith('Ⅱ') ? 'Ⅱ阶' : 'Ⅲ阶'))

  // 风地未鉴定符石（Ⅰ -> Ⅱ -> Ⅲ）
  const windEarthRunes = ['item_19307', 'item_19308', 'item_19309']
    .map(id => itemMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1))
  registerGroup(windEarthRunes, it => (it.name?.endsWith('Ⅰ') ? 'Ⅰ阶' : it.name?.endsWith('Ⅱ') ? 'Ⅱ阶' : 'Ⅲ阶'))

  // 14. 战斗投掷与消耗战术道具系列
  // 炼金炸弹
  const alchemyBombs = ['item_31003', 'item_31011']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(alchemyBombs, it => (it.name?.includes('简易') ? '简易' : '燃烧'))

  // 元素爆桶
  const elementBarrels = ['item_31005', 'item_31006']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(elementBarrels, it => (it.name?.includes('黏液') ? '黏液' : '魔焰'))

  // 15. 成长礼包 / 自选包系列
  // 新人成长礼包（一 -> 二 -> 三）
  const rookiePacks = ['item_26003', 'item_26004', 'item_26005']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(rookiePacks, it => it.name?.replace('新人礼包', '礼包') || '新人')

  // 符石自选包与随机礼包
  const runePacks = ['item_26008', 'item_26009', 'item_26010', 'item_26011']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(runePacks, it => {
    if (it.typeId === 'item_26008') return '基础自选'
    if (it.typeId === 'item_26009') return '属性自选'
    if (it.typeId === 'item_26010') return '基础随机'
    return '属性随机'
  })

  // 好感度礼物自选包
  const favPacks = ['item_26012', 'item_26013']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(favPacks, it => (it.name?.includes('初级') ? '初级' : '高级'))

  // 元素碎片礼包
  const elementPacks = ['item_26006', 'item_26007']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(elementPacks, it => (it.name?.includes('自选') ? '自选包' : '随机包'))

  // 16. 指名契约书系列（各 5 星角色专属契约书 + 自选契约书）
  const designatedBooks = validItemList
    .filter(it => it.name?.includes('指名契约书'))
    .sort((a, b) => {
      if (a.typeId === 'item_5Xchoice') return -1
      if (b.typeId === 'item_5Xchoice') return 1
      return String(a.name).localeCompare(String(b.name))
    })
  registerGroup(designatedBooks, it => {
    if (it.typeId === 'item_5Xchoice' || it.name?.includes('自选')) return '自选'
    const match = it.name?.match(/指名契约书[：:](.+)/)
    return match ? match[1].trim() : '指名'
  })

  // 17. 稀有采集特产/高价换金物（密银原石、晶化肉块、黄金枯叶）
  const rareSaleItems = ['item_10095', 'item_10072', 'item_10073']
    .map(id => itemMap.get(id))
    .filter(Boolean)
  registerGroup(rareSaleItems, () => '珍品')

  // 18. 料理系列（按游戏官方三级分类：恢复类、强化类、抗性类）
  const validFoods = validItemList.filter(
    it => it.category && (it.category.includes(32) || it.category.includes('32'))
  )
  const FOOD_SUBCATS = [
    { code: 321, name: '恢复类' },
    { code: 322, name: '强化类' },
    { code: 323, name: '抗性类' }
  ]
  for (const sub of FOOD_SUBCATS) {
    const subFoods = validFoods
      .filter(it => it.category.includes(sub.code) || it.category.includes(String(sub.code)))
      .sort((a, b) => (Number(a.quality) || 1) - (Number(b.quality) || 1) || String(a.name).localeCompare(String(b.name)))
    registerGroup(subFoods, () => sub.name)
  }

  return similarMap
}

/**
 * 针对单个物品获取其关联列表
 */
export function resolveItemRelations(item, relationsMap = null) {
  if (!item || !item.typeId) return []
  const rels = relationsMap?.relations || relationsMap
  if (rels && rels[item.typeId]) {
    return rels[item.typeId]
  }

  // 运行时单项简单兜底
  const fallback = []
  if (item.seedInfo?.harvest) {
    fallback.push({
      relationType: 'harvest_product',
      relationLabel: '种植收获',
      targetType: 'item',
      id: item.seedInfo.harvest.typeId,
      name: item.seedInfo.harvest.name,
      icon: item.seedInfo.harvest.typeId,
      quality: 1
    })
  }
  if (item.heroUnlock?.heroTypeId || item.heroStarUsage?.heroTypeId) {
    const heroId = item.heroUnlock?.heroTypeId || item.heroStarUsage?.heroTypeId
    const heroName = item.heroUnlock?.heroName || item.heroStarUsage?.heroName || '角色'
    fallback.push({
      relationType: 'hero_link',
      relationLabel: item.name?.includes('碎片') ? '角色碎片' : '关联角色',
      targetType: 'hero',
      id: heroId,
      name: heroName,
      icon: item.heroUnlock?.heroIcon || '',
      quality: Number(item.heroStarUsage?.rarity) || 3
    })
  }
  return fallback
}

/**
 * 针对单个物品获取其同类物品列表
 */
export function resolveSimilarItems(item, similarMap = null) {
  if (!item || !item.typeId) return []
  const sim = similarMap?.similar || similarMap
  if (sim && sim[item.typeId]) {
    return sim[item.typeId]
  }
  return []
}
