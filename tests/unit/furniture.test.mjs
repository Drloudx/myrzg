import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  buildFurnitureData,
  formatFurnitureCondition,
  isFurnitureCatalogEntry,
  resolveDefaultHomeItemSkin,
  resolveHomeItemUnlocks
} from '../../src/utils/furnitureData.js'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const readRaw = name => JSON.parse(readFileSync(join(projectRoot, 'raw', `${name}.json`), 'utf8'))

const buildFixture = overrides => buildFurnitureData({
  homeItemRes: { furniture: {} },
  itemRes: { datas: {} },
  settingRes: { data: { typeSetting: { homeItem_type: [] } } },
  consumeRes: { datas: {} },
  playerInitRes: { homeItems: [] },
  conditionRes: { gameConditions: {} },
  taskRes: { datas: {} },
  ...overrides
})

test('catalog excludes explicit drafts and non-catalog room objects', () => {
  assert.equal(isFurnitureCatalogEntry({ typeId: 'chair', name: '木椅', category: ['c1'] }), true)
  assert.equal(isFurnitureCatalogEntry({ typeId: 'draft', name: '【废稿】木椅', category: [] }), false)
  assert.equal(isFurnitureCatalogEntry({ typeId: 'draft', name: '木椅', category: ['未启用废稿'] }), false)
  assert.equal(isFurnitureCatalogEntry({ typeId: 'cultivation001', name: '培育室', category: ['功能'] }), false)
  assert.equal(isFurnitureCatalogEntry({ typeId: 'petRoom01', name: '宠物小屋', category: ['功能'] }), false)
  assert.equal(isFurnitureCatalogEntry({ typeId: 'petHouse', name: '宠物小屋', category: ['功能'] }), true)
})

test('default skin selection follows saved/config order without changing source skin data', () => {
  const homeItem = {
    icon: 'base-icon',
    skin: [
      { type: 'normal', homeLevel: '', unlock: true, icon: 'normal-icon' },
      { type: 'same-level-later', homeLevel: '', unlock: true, icon: '' },
      { type: 'level-two', homeLevel: 2, unlock: false, icon: 'level-two-icon' }
    ]
  }

  assert.deepEqual(resolveDefaultHomeItemSkin(homeItem), {
    ...homeItem.skin[1],
    icon: ''
  })
  assert.equal(resolveDefaultHomeItemSkin(homeItem, { allSkins: ['level-two'], homeLevel: 2 }).type, 'level-two')
  assert.equal(resolveDefaultHomeItemSkin({ icon: 'base-icon', skin: [] }), null)
})

test('blueprints bind only by useActionPara.homeItems typeId and keep exact skin icon semantics', () => {
  const homeItemRes = {
    furniture: {
      chair_a: {
        typeId: 'chair_a', name: '同名家具', icon: 'chair-a', quality: 3,
        skin: [{ type: 'plain', name: '素色', icon: '', unlock: false }]
      },
      chair_b: { typeId: 'chair_b', name: '同名家具', icon: 'chair-b', quality: 5, skin: [] }
    }
  }
  const item = {
    typeId: 'blueprint', name: '精确图纸', useAction: 'unlockHomeItemSkin',
    useActionPara: { homeItems: [{ typeId: 'chair_a', skin: ['plain', 'unknown'] }] }
  }

  assert.deepEqual(resolveHomeItemUnlocks(item, homeItemRes), [{
    typeId: 'chair_a',
    name: '同名家具',
    icon: '',
    quality: 3,
    action: 'unlockHomeItemSkin',
    skinIds: ['plain', 'unknown'],
    skinNames: ['素色', 'unknown'],
    catalogVisible: true
  }])
  assert.deepEqual(resolveHomeItemUnlocks({ ...item, useAction: 'unlockByName' }, homeItemRes), [])
  assert.deepEqual(resolveHomeItemUnlocks({ ...item, useActionPara: { homeItems: [{ typeId: 'missing' }] } }, homeItemRes), [])

  const furnitureBlueprint = {
    ...item,
    name: '测试字样仍不影响关系解析',
    useAction: 'unlockHomeItem'
  }
  assert.equal(resolveHomeItemUnlocks(furnitureBlueprint, homeItemRes)[0].icon, 'chair-a')
})

test('open conditions are derived from CheckResultConditions rules and task steps, not config notes', () => {
  const taskRes = { datas: {
    m_0_2: {
      name: '暴风般的复仇',
      steps: [
        { stepName: '第一步。' },
        { stepName: '第二步。' },
        { stepName: '通关关卡0-2。' }
      ]
    }
  } }

  assert.equal(formatFurnitureCondition({
    desc: '这只是策划备注',
    rules: [{ need: true, type: 'level', para: { min: 1 } }]
  }, taskRes), '玩家等级达到 1 级')
  assert.equal(formatFurnitureCondition({
    desc: '另一条备注',
    rules: [{ need: true, type: 'passTask', para: { typeId: 'm_0_2', step: 3 } }]
  }, taskRes), '完成《暴风般的复仇》第 3 步「通关关卡0-2」')
  assert.equal(formatFurnitureCondition({
    reverse: true,
    rules: [{ need: false, type: 'level', para: { min: 8 } }]
  }, taskRes), '不满足以下全部条件：玩家等级未达到 8 级')
})

test('derived furniture preserves source fields, crafting data, acquisition tags and reverse blueprint relation', () => {
  const homeItem = {
    typeId: 'chair_a', name: '木椅', quality: 4, objType: [2, 22], category: ['c4', 7],
    place: 'room', icon: 'base-icon', dec: 3, cntMax: 8, sellMoney: 10,
    consume: 'make-chair', condition: 'open-chair',
    skin: [{ type: 'normal', name: '默认', icon: '', desc: '皮肤说明', unlock: true, homeLevel: '' }]
  }
  const data = buildFixture({
    homeItemRes: { furniture: { chair_a: homeItem } },
    itemRes: { datas: {
      wood: { typeId: 'wood', name: '木板', img: 'wood', quality: 2 },
      plan: {
        typeId: 'plan', name: '木椅制作图', img: '', quality: 4, useAction: 'unlockHomeItem',
        useActionPara: { homeItems: [{ typeId: 'chair_a', skin: [] }] }
      }
    } },
    settingRes: { data: { typeSetting: { homeItem_type: [
      { type: '2', name: '家具', info: [{ type: '22', name: '椅子' }] }
    ] } } },
    consumeRes: { datas: { 'make-chair': { items: [{ typeId: 'wood', num: 5 }], money: 20 } } },
    playerInitRes: { homeItems: [{ typeId: 'chair_a', num: 2 }] },
    conditionRes: { gameConditions: { 'open-chair': {
      desc: '任务获得',
      rules: [{ need: true, type: 'level', para: { min: 4 } }]
    } } }
  })
  const furniture = data.furniture[0]

  assert.equal(furniture.id, 'chair_a')
  assert.equal(furniture.quality, 4)
  assert.deepEqual(furniture.categoryIds, ['2', '22'])
  assert.deepEqual(furniture.categoryNames, ['家具', '椅子'])
  assert.deepEqual(furniture.sourceTags, ['c4', 7])
  assert.deepEqual(furniture.sourceLabels, ['黑森林', 7])
  assert.equal(furniture.place, 'room')
  assert.equal(furniture.placeName, '房间')
  assert.equal(furniture.displayIcon, 'base-icon')
  assert.equal(furniture.initialNum, 2)
  assert.deepEqual(furniture.crafting, { available: true, note: '' })
  assert.deepEqual(furniture.skins.map(skin => [skin.type, skin.icon, skin.isDefault]), [['normal', '', true]])
  assert.deepEqual(furniture.consume.items, [{ typeId: 'wood', name: '木板', img: '/Common_ItemIcon/wood.png', quality: 2, num: 5 }])
  assert.deepEqual(furniture.consume.currencies.map(entry => [entry.typeId, entry.name, entry.num]), [['item_00001', '银币', 20]])
  assert.deepEqual(furniture.condition, {
    id: 'open-chair',
    label: '开放条件',
    summary: '玩家等级达到 4 级',
    configNote: '任务获得',
    reverse: false,
    rules: [{ need: true, type: 'level', para: { min: 4 } }]
  })
  assert.deepEqual(furniture.blueprints.map(entry => [entry.typeId, entry.icon, entry.action]), [['plan', 'base-icon', 'unlockHomeItem']])
})

test('current raw tables produce the formal catalog and only the four known missing UI icons', () => {
  const homeItemRes = readRaw('homeItem')
  const itemRes = readRaw('item')
  const data = buildFurnitureData({
    homeItemRes,
    itemRes,
    settingRes: readRaw('gameSetting'),
    consumeRes: readRaw('consume'),
    playerInitRes: readRaw('playerInit'),
    conditionRes: readRaw('condition'),
    taskRes: readRaw('task')
  })

  const formalIds = Object.values(homeItemRes.furniture)
    .filter(isFurnitureCatalogEntry)
    .map(entry => entry.typeId)
    .sort()
  assert.deepEqual(data.furniture.map(entry => entry.id).sort(), formalIds)
  assert.equal(data.stats.total, 141)
  assert.equal(data.stats.withBlueprint, 122)
  assert.equal(data.stats.withoutBlueprint, 19)
  assert.ok(data.furniture
    .filter(entry => entry.condition.id)
    .every(entry => entry.condition.summary && entry.condition.summary !== entry.condition.configNote))
  assert.equal(
    data.furniture.find(entry => entry.id === 'sysAlchemy')?.condition.summary,
    '完成《暴风般的复仇》第 3 步「通关关卡0-2」'
  )
  assert.equal(data.furniture.some(entry => entry.id === 'petRoom01'), false)
  assert.equal(data.furniture.filter(entry => entry.id === 'petHouse').length, 1)
  assert.equal(data.furniture.find(entry => entry.id === 'mailBox')?.displayIcon, 'build_psxw_tianlong')
  assert.equal(data.furniture.find(entry => entry.id === 'mailBox')?.displayImage, '/RoomObj/c001_ludeng001.png')
  assert.deepEqual(data.furniture.find(entry => entry.id === 'mailBox')?.crafting, {
    available: false,
    note: '营地固定设施，无需制作'
  })
  assert.deepEqual(data.furniture.find(entry => entry.id === 'sysCenter')?.crafting, {
    available: false,
    note: '初始拥有，无需制作'
  })
  assert.equal(data.furniture.find(entry => entry.id === 'tiandi001')?.crafting.available, true)
  assert.equal(data.furniture.find(entry => entry.id === 'petHouse')?.crafting.available, true)
  assert.equal(data.furniture.find(entry => entry.id === 'campfire')?.crafting.available, true)
  assert.equal(data.furniture.find(entry => entry.id === 'jiaju_muma')?.displayIcon, 'build_mzh_kuijia')
  assert.deepEqual(
    [
      data.furniture.find(entry => entry.id === 'jiaju_muma')?.condition.label,
      data.furniture.find(entry => entry.id === 'jiaju_muma')?.condition.summary
    ],
    ['获取方式', '活动 / 通行证14级']
  )
  assert.ok(data.furniture.every(entry => !/废稿/.test([entry.name, ...entry.sourceTags].join(' '))))

  const actualRelations = data.furniture.flatMap(furniture => furniture.blueprints.map(blueprint =>
    `${blueprint.typeId}|${furniture.id}|${blueprint.action}|${blueprint.skinIds.join(',')}`
  )).sort()
  const expectedRelations = Object.values(itemRes.datas).flatMap(item =>
    resolveHomeItemUnlocks(item, homeItemRes)
      .filter(unlock => unlock.catalogVisible)
      .map(unlock => `${item.typeId}|${unlock.typeId}|${unlock.action}|${unlock.skinIds.join(',')}`)
  ).sort()
  assert.deepEqual(actualRelations, expectedRelations)

  const imageDir = join(projectRoot, 'public', 'images', 'BuildItem')
  const iconIds = new Set(data.furniture.flatMap(furniture => [
    furniture.icon,
    furniture.displayIcon,
    ...furniture.skins.map(skin => skin.icon),
    ...furniture.blueprints.map(blueprint => blueprint.icon)
  ]).filter(Boolean))
  const missing = [...iconIds].filter(icon => !existsSync(join(imageDir, `${icon}.png`))).sort()
  assert.deepEqual(missing, [
    'build_roomLittle_yma7_2',
    'build_roomLittle_yma8_2',
    'build_roomLittle_yma8_3',
    'build_roomOther_xca4_1'
  ])
  assert.equal(readdirSync(imageDir).filter(file => file.endsWith('.png')).length, 143)
  assert.ok(data.furniture.flatMap(entry => entry.skins).every(skin => !Object.hasOwn(skin, 'roomObj')))
})
