import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGachaStateStore } from '../../src/stores/gachaState.js'
import { BASE_REWARD_ICONS } from '../../src/utils/gameMappings.js'

const gacha = JSON.parse(readFileSync(new URL('../../public/data/parsed/gacha.json', import.meta.url), 'utf8'))
const playerInit = JSON.parse(readFileSync(new URL('../../raw/playerInit.json', import.meta.url), 'utf8'))

/** 每个用例用独立 pinia 实例，避免相互污染。 */
function freshStore() {
  setActivePinia(createPinia())
  return useGachaStateStore()
}

test('模拟钱包起算值来自原表初始配置量', () => {
  assert.deepEqual(gacha.initialWallet, {
    money: playerInit.money,
    ke: playerInit.ke,
    payKe: playerInit.payKe,
    ti: playerInit.ti,
    items: playerInit.initItems.map(entry => ({ typeId: entry.itemTypeId, count: entry.num }))
  })
  // 新号只带 1 张普通招待券，因此蛋池「常规贩售」可抽一次而角色池不可抽
  assert.deepEqual(gacha.initialWallet.items, [
    { typeId: 'item_30014', count: 2 },
    { typeId: 'item_20025', count: 1 }
  ])
})

test('ensureWallet 首次建立、之后不覆盖既有余额', () => {
  const store = freshStore()
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 100, ticket: 3 })
  assert.equal(store.holdingsOf(BASE_REWARD_ICONS.money), 100)

  store.spend([{ typeId: 'ticket', count: 2 }])
  assert.equal(store.holdingsOf('ticket'), 1)

  // 二次调用不得把余额重置回 seed
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 100, ticket: 3 })
  assert.equal(store.holdingsOf('ticket'), 1)
})

test('基线随常量刷新：未动过的旧镜像钱包一并迁移（招待券 101→100），动过的只刷基线', () => {
  const store = freshStore()
  // 旧版双重叠加的存档：种子与钱包完全一致（用户从未抽取/补充）
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 0, ticket: 101 })
  assert.equal(store.holdingsOf('ticket'), 101)

  // 新常量下种子变为 100：未动过的钱包应一并迁移；之后重置也回到 100
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 0, ticket: 100 })
  assert.equal(store.holdingsOf('ticket'), 100)
  store.resetAll()
  assert.equal(store.holdingsOf('ticket'), 100)

  // 动过的钱包：余额保留，仅基线跟随新常量
  store.spend([{ typeId: 'ticket', count: 40 }])
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 0, ticket: 100 })
  assert.equal(store.holdingsOf('ticket'), 60)
  store.resetAll()
  assert.equal(store.holdingsOf('ticket'), 100)
})

test('键集合不同的异构存档（如预置空钱包）不被注入新种子', () => {
  const store = freshStore()
  store.ensureWallet({ ticket: 0 })
  store.ensureWallet({ [BASE_REWARD_ICONS.money]: 300000, [BASE_REWARD_ICONS.ke]: 2000, ticket: 100 })
  assert.equal(store.holdingsOf('ticket'), 0, '异构存档保持原值')
  assert.equal(store.holdingsOf(BASE_REWARD_ICONS.money), 0)
  // 但基线已刷新到新常量，重置回到新默认值
  store.resetAll()
  assert.equal(store.holdingsOf('ticket'), 100)
})

test('spend 足额扣除、不足时整体不扣', () => {
  const store = freshStore()
  store.ensureWallet({ ticket: 10 })

  assert.equal(store.canAfford([{ typeId: 'ticket', count: 10 }]), true)
  assert.equal(store.spend([{ typeId: 'ticket', count: 10 }]), true)
  assert.equal(store.holdingsOf('ticket'), 0)

  assert.equal(store.canAfford([{ typeId: 'ticket', count: 1 }]), false)
  assert.equal(store.spend([{ typeId: 'ticket', count: 1 }]), false)
  assert.equal(store.holdingsOf('ticket'), 0, '不足时不得出现负数余额')
})

test('topUp 累加模拟额度，resetAll 回到起算值', () => {
  const store = freshStore()
  store.ensureWallet({ ticket: 5, [BASE_REWARD_ICONS.ke]: 0 })

  store.topUp({ ticket: 100, [BASE_REWARD_ICONS.ke]: 2000 })
  assert.equal(store.holdingsOf('ticket'), 105)
  assert.equal(store.holdingsOf(BASE_REWARD_ICONS.ke), 2000)

  store.spend([{ typeId: 'ticket', count: 105 }])
  assert.equal(store.holdingsOf('ticket'), 0)

  store.resetAll()
  assert.equal(store.holdingsOf('ticket'), 5, '重置应回到 ensureWallet 的起算值')
  assert.equal(store.holdingsOf(BASE_REWARD_ICONS.ke), 0)
})

test('钱包与保底/记录一起持久化在同一个 store', () => {
  const store = freshStore()
  store.ensureWallet({ ticket: 3 })
  store.setRuntime('hero:1:1:0', { poolId: 'hero:1:1:0', totalPulls: 7, pity: { 3: 0, 4: 7, 5: 7 }, guarantyCount: 0, firstGuarantyUsed: false })
  assert.equal(store.runtimeOf('hero:1:1:0').totalPulls, 7)
  assert.equal(store.holdingsOf('ticket'), 3)
})
