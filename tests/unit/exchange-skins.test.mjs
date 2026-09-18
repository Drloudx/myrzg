import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildExchangeData, buildOfficialExchangeIndex, getExchangeSourceMeta, isVisibleExchange } from '../../src/utils/exchangeData.js'

const maps = {
  packDisplayRes: {
    currency: { packType: 2, shopTypeId: 'coins', name: '氪金商店' },
    costumes: { packType: 5, shopTypeId: 'costumes', name: '时装' },
    hidden: { packType: 5, shopTypeId: 'hidden', name: '隐藏', hide: true }
  },
  shopRes: { datas: {
    coins: { shopList: [{ exchangeIds: ['currency'] }] },
    costumes: { shopList: [{ skins: [{ exchangeId: 'costume', heroSkin: 'skinRef', img: 'shop_portrait' }] }] },
    hidden: { shopList: [{ skins: [{ exchangeId: 'hidden', heroSkin: 'skinRef' }] }] }
  } },
  exchangeRes: { itemExchange: {
    currency: { id: 'currency', team: 'bke', reward: 'gift' },
    costume: { id: 'costume', name: '同名商品', team: 'fuZhuang', reward: 'gift', consume: 'price' },
    hidden: { id: 'hidden', team: 'fuZhuang', reward: 'gift' },
    orphan: { id: 'orphan', team: 'fuZhuang', reward: 'gift' }
  } },
  skinRes: { datas: {
    skinRef: { heroTypeId: 'heroRef', name: '真实时装', quality: 3 },
    wrong: { heroTypeId: 'wrongHero', name: '同名商品', quality: 5 }
  } },
  heroRes: { datas: { heroRef: { name: '真实角色' }, wrongHero: { name: '无关角色' } } },
  rewardRes: { datas: { gift: { items: [{ rules: [{ mode: 'item', typeId: 'costumeItem', num: 1 }] }] } } },
  consumeRes: { datas: { price: { ke: 100 } } },
  itemRes: { datas: { costumeItem: { name: '时装道具', img: 'costume_icon', quality: 3 }, item_00002: { name: '氪金', img: 'item_00002' } } }
}

test('fashion shares the visible shop category and source links, while hidden and orphan entries stay hidden', () => {
  const index = buildOfficialExchangeIndex(maps)
  const categories = buildExchangeData(maps)
  assert.deepEqual(categories.map(category => category.key), ['shop'])
  assert.deepEqual(categories[0].subs.map(sub => sub.key), ['coins', 'costumes'])
  assert.equal(isVisibleExchange(maps.exchangeRes.itemExchange.hidden, index), false)
  assert.equal(isVisibleExchange(maps.exchangeRes.itemExchange.orphan, index), false)
  assert.deepEqual(getExchangeSourceMeta(maps.exchangeRes.itemExchange.costume, index), {
    category: 'shop', categoryLabel: '商店积分', sub: 'costumes', subLabel: '时装'
  })
})

test('skin cards follow shop foreign keys and the configured price without inventing account ownership', () => {
  const card = buildExchangeData(maps)[0].subs[1].list[0]
  assert.deepEqual(card.skin, {
    id: 'skinRef', heroId: 'heroRef', heroName: '真实角色', name: '真实时装',
    quality: 3, image: '/images/PackPane/shop_portrait.webp'
  })
  assert.equal(card.consumeItems[0].num, 100)
  assert.equal(card.consumeItems[0].typeId, 'item_00002')
  assert.equal(card.rewardItems[0].typeId, 'costumeItem')
  assert.equal('owned' in card, false)
  const changed = structuredClone(maps)
  changed.consumeRes.datas.price.ke = 160
  assert.equal(buildExchangeData(changed)[0].subs[1].list[0].consumeItems[0].num, 160)
})
