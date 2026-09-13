import { defineStore } from 'pinia'

/** 模拟记录保留条数，避免 localStorage 无限增长。 */
const RECORD_LIMIT = 300

/**
 * 模拟招募的本地状态。
 *
 * 这里保存的是**模拟数据**，不是账号数据：保底计数、已拥有角色、记忆碎片、模拟钱包余额
 * 都由本地抽屉推演得到，页面必须明确标注「模拟」。真实抽取在服务端完成，客户端只接收结果。
 *
 * 持久化键：`localStorage['gachaState']`（pinia-plugin-persistedstate）。
 */
export const useGachaStateStore = defineStore('gachaState', {
  state: () => ({
    /** 各卡池的模拟运行时（保底计数）。 */
    runtimeByPool: {},
    /** 模拟抽取记录（倒序，最新在前）。 */
    records: [],
    /** 模拟「已拥有」的角色/魔物蛋 typeId，用于判定 新 / 重复。 */
    owned: [],
    /** 模拟持有的记忆碎片数，按角色 typeId 累计。 */
    fragmentsByHero: {},
    /** 模拟累计获得的记忆结晶。 */
    crystals: 0,
    /** 模拟钱包：typeId → 持有量（货币与卡池消耗券共用一张表）。未初始化时为 null。 */
    wallet: null,
    /** 模拟钱包的起算值（原表初始配置量 + 模拟额度），重置时恢复到这里。 */
    walletSeed: null,
    /** 揭晓演出音效开关。 */
    soundOn: true
  }),
  getters: {
    runtimeOf: state => poolId => state.runtimeByPool[poolId] ?? null,
    pullCountOf: state => poolId => state.records.filter(item => item.poolId === poolId).length,
    fragmentsOf: state => typeId => state.fragmentsByHero[typeId] ?? 0,
    /** 指定 typeId 的模拟持有量（货币或道具）。 */
    holdingsOf: state => typeId => Number(state.wallet?.[typeId]) || 0
  },
  actions: {
    isOwned(typeId) {
      return this.owned.includes(typeId)
    },
    /**
     * 首次进入时按 `seed`（原表初始配置量与模拟额度取较大值）建立钱包；已存在则不覆盖。
     * `walletSeed` 基线每次都刷新到最新计算值：模拟额度常量或原表初始配置调整后，
     * 「重置」应回到新的默认值。若现有钱包与旧基线完全一致、且新旧基线的**键集合一致**
     * （只是数值随常量调整，如招待券 101→100），说明钱包只是旧基线的未动镜像，一并刷新；
     * 键集合不同意味着是人工/异构存档（如测试预置的空钱包），保持原值不注入。
     */
    ensureWallet(seed) {
      const next = { ...seed }
      if (!this.wallet) {
        this.walletSeed = next
        this.wallet = { ...next }
        return
      }
      const oldSeed = this.walletSeed
      const untouched = Boolean(oldSeed)
        && Object.keys(oldSeed).length === Object.keys(this.wallet).length
        && Object.keys(oldSeed).every(key => this.wallet[key] === oldSeed[key])
      const sameShape = Boolean(oldSeed)
        && Object.keys(oldSeed).length === Object.keys(next).length
        && Object.keys(next).every(key => key in oldSeed)
      this.walletSeed = next
      if (untouched && sameShape) this.wallet = { ...next }
    },
    /** 是否付得起一组消耗（`[{ typeId, count }]`）。 */
    canAfford(costs) {
      return (costs ?? []).every(item => this.holdingsOf(item.typeId) >= (Number(item.count) || 0))
    },
    /** 扣除一组消耗；余额不足时整体不扣并返回 false。 */
    spend(costs) {
      if (!this.canAfford(costs)) return false
      const next = { ...this.wallet }
      for (const item of costs ?? []) {
        next[item.typeId] = this.holdingsOf(item.typeId) - (Number(item.count) || 0)
      }
      this.wallet = next
      return true
    },
    /** 补充模拟额度（对应游戏货币条的「+」入口，本页为模拟补充）。 */
    topUp(allowance) {
      const next = { ...(this.wallet ?? {}) }
      for (const [typeId, amount] of Object.entries(allowance ?? {})) {
        next[typeId] = (Number(next[typeId]) || 0) + (Number(amount) || 0)
      }
      this.wallet = next
    },
    setRuntime(poolId, runtime) {
      this.runtimeByPool = { ...this.runtimeByPool, [poolId]: runtime }
    },
    /** 写入一次抽取结果：保底计数、模拟记录、已拥有、碎片与结晶。 */
    commitDraw(pool, entry, runtime) {
      this.setRuntime(pool.id, runtime)

      if (entry.typeId && !this.owned.includes(entry.typeId)) this.owned.push(entry.typeId)
      if (entry.typeId && entry.fragments) {
        this.fragmentsByHero = {
          ...this.fragmentsByHero,
          [entry.typeId]: (this.fragmentsByHero[entry.typeId] ?? 0) + entry.fragments
        }
      }
      if (entry.overflow?.count) this.crystals += entry.overflow.count

      const record = {
        id: `${Date.now().toString(36)}-${this.records.length}-${Math.random().toString(36).slice(2, 6)}`,
        poolId: pool.id,
        poolName: pool.name,
        kind: pool.kind,
        typeId: entry.typeId,
        name: entry.name,
        quality: entry.quality,
        rank: entry.rank,
        icon: entry.icon,
        isNew: entry.isNew,
        converted: entry.converted,
        at: Date.now()
      }
      this.records = [record, ...this.records].slice(0, RECORD_LIMIT)
      return record
    },
    /** 清空指定卡池的模拟进度（保底计数 + 该池记录），并把模拟钱包还原为默认额度。 */
    resetPool(poolId) {
      const next = { ...this.runtimeByPool }
      delete next[poolId]
      this.runtimeByPool = next
      this.records = this.records.filter(item => item.poolId !== poolId)
      this.wallet = this.walletSeed ? { ...this.walletSeed } : null
    },
    /** 清空全部模拟数据（保底、记录、拥有状态、碎片、结晶与钱包）。 */
    resetAll() {
      this.runtimeByPool = {}
      this.records = []
      this.owned = []
      this.fragmentsByHero = {}
      this.crystals = 0
      this.wallet = this.walletSeed ? { ...this.walletSeed } : null
    },
    toggleSound() {
      this.soundOn = !this.soundOn
    }
  },
  persist: true
})
