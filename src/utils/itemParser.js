import { getResourceBaseUrl } from './env'

// 缓存数据，避免重复请求
let cachedItems = null
let cachedCategoryTree = null
let lanDict = null
let cachedAvatars = null
let cachedRewards = null

/**
 * 统一加载核心数据
 */
export async function fetchItemData() {
  if (cachedItems && cachedCategoryTree) {
    return { items: cachedItems, categoryTree: cachedCategoryTree, lanDict, avatars: cachedAvatars, rewards: cachedRewards }
  }

  const baseUrl = getResourceBaseUrl()

  try {
    // 采用原生 fetch 或封装好的 request
    const [itemRes, settingRes, lanRes, avatarRes, rewardRes] = await Promise.all([
      fetch(`${baseUrl}/data/item.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/gameSetting.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/lan.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/avatars.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/reward.json`).then(r => r.json())
    ])

    // 1. 解析字典 lan.json
    lanDict = {}
    if (lanRes && lanRes.data) {
      lanRes.data.forEach(item => {
        lanDict[item.name] = item.desc_cn || item.desc_en || item.name
      })
    }

    // 1.5 缓存角色和奖励字典
    cachedAvatars = avatarRes?.datas || []
    cachedRewards = rewardRes?.datas || {}

    // 2. 解析分类树 gameSetting.json -> typeSetting.item_type
    cachedCategoryTree = []
    if (settingRes?.data?.typeSetting?.item_type) {
      cachedCategoryTree = settingRes.data.typeSetting.item_type
    }

    // 3. 解析物品列表并处理碎片名称
    const rawItems = itemRes.datas || {}
    cachedItems = Object.values(rawItems)

    cachedItems.forEach(item => {
      if (item.useActionPara && item.useActionPara.heros && item.useActionPara.heros.length > 0) {
        const heroId = item.useActionPara.heros[0].heroTypeId
        const avatar = cachedAvatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
        if (avatar && item.name && item.name.includes('碎片')) {
          const oldName = item.name
          const numMatch = oldName.match(/(\d+)碎片/)
          if (numMatch) {
            const numStr = numMatch[1]
            item.name = `${avatar.name}碎片`
            if (item.desc) {
              item.desc = item.desc.replace(new RegExp(oldName, 'g'), item.name)
              item.desc = item.desc.replace(new RegExp(numStr, 'g'), avatar.name)
            }
          } else {
            item.name = `${avatar.name}碎片`
          }
        }
      }
    })

    return { items: cachedItems, categoryTree: cachedCategoryTree, lanDict, avatars: cachedAvatars, rewards: cachedRewards }
  } catch (error) {
    console.error('Failed to load item data:', error)
    return { items: [], categoryTree: [], lanDict: {} }
  }
}

/**
 * 将职业索引数组转换为中文名
 * @param {number[]} jobIndices 
 */
export function translateJob(jobIndices) {
  if (!jobIndices || jobIndices.length === 0) return '无'
  const jobString = lanDict?.['hero_job']
  if (!jobString) return jobIndices.join(',') // Fallback 保护
  
  const jobs = jobString.split(',')
  return jobIndices.map(idx => jobs[idx] || idx).join(' / ')
}

/**
 * 翻译战斗属性Key
 * @param {string} attrKey 
 */
export function translateAttr(attrKey) {
  return lanDict?.[attrKey] || attrKey
}

/**
 * 解析分类描述名称
 * @param {number[]} categoryArray [1, 13, 134]
 * @param {object[]} categoryTree 
 */
export function translateCategory(categoryArray, categoryTree) {
  if (!categoryArray || !categoryArray.length || !categoryTree) return ''
  let currentTree = categoryTree
  const names = []
  
  for (let i = 0; i < categoryArray.length; i++) {
    const targetType = String(categoryArray[i])
    if (!currentTree) break
    const found = currentTree.find(node => String(node.type) === targetType)
    if (found) {
      names.push(found.name)
      currentTree = found.info
    } else {
      break
    }
  }
  return names.join(' > ')
}

/**
 * 解析使用效果 (解锁皮肤/角色)
 * @param {object} item 
 */
export function parseItemUnlocks(item) {
  if (!item || !item.useActionPara) return null

  // 1. 角色碎片 heros
  if (item.useActionPara.heros && item.useActionPara.heros.length > 0) {
    const heroId = item.useActionPara.heros[0].heroTypeId
    const avatar = cachedAvatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
    const name = avatar ? avatar.name : heroId
    return `用于角色：${name}`
  }

  // 2. 解锁皮肤 unlockHeroSkin
  if (item.useActionPara.unlockHeroSkin && item.useActionPara.unlockHeroSkin.skinTypeId) {
    const skinId = item.useActionPara.unlockHeroSkin.skinTypeId
    // Try to find the skin item in item.json (cachedItems)
    const skinItem = cachedItems?.find(i => i.typeId === skinId)
    if (skinItem && skinItem.name) {
      return `解锁皮肤：${skinItem.name}`
    } else {
      // Fallback: 如果匹配不上就显示为角色名 skinSuffix
      const heroIdMatch = skinId.match(/^(hero_\d+)_skin/)
      if (heroIdMatch) {
        const hId = heroIdMatch[1] // hero_002
        const avatar = cachedAvatars?.find(a => a.typeId === hId || a.heroTypeId === hId)
        const roleName = avatar ? avatar.name : hId
        const skinSuffix = skinId.split('_').pop() // skin01
        return `解锁皮肤：${roleName} ${skinSuffix}`
      }
      return `解锁皮肤：${skinId}`
    }
  }

  return null
}

/**
 * 智能获取物品图标
 */
export function getItemImageUrl(item) {
  if (!item) return ''
  
  // 处理角色碎片专属头像
  if (item.useActionPara && item.useActionPara.heros && item.useActionPara.heros.length > 0) {
    const heroId = item.useActionPara.heros[0].heroTypeId
    const avatar = cachedAvatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
    if (avatar && avatar.img) {
      // e.g. at001_0 -> chara001_0
      const imgName = avatar.img.replace(/^at/, 'chara')
      return `/images/HeroInfoPanel/${imgName}_p.png`
    }
  }

// 默认物品图标
  return `/images/Common_ItemIcon/${item.img}.png`
}

/**
 * 解析物品使用效果（主要针对 getReward 和消耗效果）
 * 返回结构化的掉落/获取信息数组
 */
export function parseItemRewards(item) {
  if (!item || !item.useActionPara) return null;
  
  // 暂时只处理 getReward，后续可扩展
  if (item.useAction === 'getReward' && item.useActionPara.reward) {
    const rewardId = item.useActionPara.reward;
    const rewardData = cachedRewards?.[rewardId];
    if (rewardData && rewardData.items && rewardData.items.length > 0) {
      
      const parsedGroups = rewardData.items.map(group => {
        // 计算当前组内所有规则的总权重，用于计算真实概率
        const totalChance = group.rules.reduce((sum, r) => sum + (r.chance || 0), 0);
        
        const parsedRules = group.rules.map(rule => {
          let parsedRule = { ...rule };
          // 组内概率
          parsedRule.prob = totalChance > 0 ? (rule.chance / totalChance) : 0;
          // 最终真实概率 = 组内概率 * 组触发率
          parsedRule.actualProb = parsedRule.prob * (group.rate || 1);
          
          if (rule.mode === 'item') {
            const targetItem = cachedItems?.find(i => i.typeId === rule.typeId);
            if (targetItem) {
              parsedRule.targetName = targetItem.name;
              parsedRule.targetImg = getItemImageUrl(targetItem);
              parsedRule.targetQuality = targetItem.quality || 1;
            } else {
              parsedRule.targetName = rule.typeId;
              parsedRule.targetImg = '';
              parsedRule.targetQuality = 1;
            }
          } else if (rule.mode === 'randomMoney' || rule.mode === 'money') {
            parsedRule.targetName = '银币';
            parsedRule.typeId = 'item_00001';
            parsedRule.targetImg = '/images/Common_ItemIcon/item_00001.png';
            parsedRule.targetQuality = 3;
          } else {
            parsedRule.targetName = rule.mode;
            parsedRule.targetImg = '';
            parsedRule.targetQuality = 1;
          }
          return parsedRule;
        });
        
        return {
          rate: group.rate || 1,
          num: group.num || 1,
          rules: parsedRules
        };
      });
      return parsedGroups;
    }
  }
  return null;
}

/**
 * 根据 ID 查找缓存的物品
 */
export function getCachedItem(typeId) {
  return cachedItems?.find(i => i.typeId === typeId) || null
}
