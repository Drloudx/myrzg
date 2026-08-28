/**
 * 魔物蛋图鉴构建期纯函数：由 pet.json 原始 JSON 生成魔物蛋列表。
 * 与 PetsEggsView.vue 的处理逻辑保持一致（eggImg 为相对 key，渲染时由视图包 getImageUrl）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildPetEggsData(maps) {
  const { petJson } = maps
  const rawList = Object.values(petJson.datas || {})

  const formatEggTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (mins === 0) return `${secs}秒`
    return secs > 0 ? `${mins}分钟${secs}秒` : `${mins}分钟`
  }

  const calcRecommendation = (sellPrice, exp) => {
    if (!exp || exp === 0) return { key: 'sell', text: '卖' }
    const ratio = sellPrice / exp
    if (ratio > 3.0) {
      return { key: 'sell', text: '卖' }
    } else if (ratio < 2.2) {
      return { key: 'feed', text: '喂' }
    } else {
      return { key: 'optional', text: '按需选择' }
    }
  }

  const pets = rawList.map(p => {
    const eggTimeMin = p.eggTime > 0 ? p.eggTime / 60 : 1
    const goldPerMin = p.sellPrice / eggTimeMin
    const expPerMin = p.exp / eggTimeMin
    const goldEff = p.exp > 0 ? (p.sellPrice / p.exp) : 0
    const expEff = p.sellPrice > 0 ? (p.exp / p.sellPrice) : 0
    const rec = calcRecommendation(p.sellPrice, p.exp)

    // Star Mapping: In game minimum star is 3 (1->3星, 2->4星, 3->5星)
    const displayStar = p.star + 2

    return {
      id: p.monId || p.typeId,
      eggImg: p.eggImg || p.typeId,
      name: p.name,
      star: p.star,
      displayStar,
      quality: displayStar >= 5 ? 5 : (displayStar === 4 ? 4 : 3),
      des: p.des,
      eggTime: p.eggTime,
      eggTimeMin: Math.round(eggTimeMin * 10) / 10,
      formattedTime: formatEggTime(p.eggTime),
      sellPrice: p.sellPrice,
      exp: p.exp,
      goldPerMin,
      expPerMin,
      goldEff,
      expEff,
      recommendationKey: rec.key,
      recommendationText: rec.text,
      hp: p.hp,
      atk: p.atk,
      def: p.def,
      dex: p.dex
    }
  })

  return { pets }
}
