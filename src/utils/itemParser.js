import { getResourceBaseUrl } from './env.js'
import { fetchWithFallback } from './request.js'
import { REWARD_MODE_INFO, buildFullCategoryTree, getCategoryName } from './gameMappings.js'

// 缓存数据，避免重复请求
let cachedItems = null
let cachedCategoryTree = null
let lanDict = null
let cachedAvatars = null
let cachedRewards = null
let cachedEquipEnchants = null
let cachedSkillTriggers = null
let cachedEquipGroups = null
let cachedEquipSuits = null
let cachedItemAffixes = null

/**
 * 构建期纯函数：由原始 JSON 响应对象生成物品/装备核心数据。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildItemData(maps) {
  const {
    itemRes, settingRes, lanRes, avatarRes, rewardRes,
    enchantRes, triggerRes, equipGroupRes, equipSuitRes, itemAffixesRes
  } = maps

  // 1. 解析字典 lan.json
  const lanDict = {}
  if (lanRes && lanRes.data) {
    lanRes.data.forEach(item => {
      lanDict[item.name] = item.desc_cn || item.desc_en || item.name
    })
  }

  // 1.5 缓存角色和奖励字典
  const avatars = avatarRes?.datas || []
  const rewards = rewardRes?.datas || {}
  const equipEnchants = enchantRes?.datas || {}
  const skillTriggers = triggerRes || {}
  const equipGroups = equipGroupRes?.equipGroups || {}
  const equipSuits = equipSuitRes || {}
  const itemAffixes = itemAffixesRes || {}

  // 2. 解析分类树 gameSetting.json -> typeSetting.item_type（完整补全中类/小类）
  const rawCategoryTree = settingRes?.data?.typeSetting?.item_type || []
  const categoryTree = buildFullCategoryTree(rawCategoryTree)

  // 3. 解析物品列表并处理碎片名称
  const rawItems = itemRes.datas || {}
  const items = Object.values(rawItems)

  items.forEach(item => {
    if (item.useActionPara && item.useActionPara.heros && item.useActionPara.heros.length > 0) {
      const heroId = item.useActionPara.heros[0].heroTypeId
      const avatar = avatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
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

  return {
    items,
    categoryTree,
    lanDict,
    avatars,
    rewards,
    equipEnchants,
    skillTriggers,
    equipGroups,
    equipSuits,
    itemAffixes
  }
}

function setItemCache(data) {
  cachedItems = data.items
  cachedCategoryTree = data.categoryTree
  lanDict = data.lanDict
  cachedAvatars = data.avatars
  cachedRewards = data.rewards
  cachedEquipEnchants = data.equipEnchants
  cachedSkillTriggers = data.skillTriggers
  cachedEquipGroups = data.equipGroups
  cachedEquipSuits = data.equipSuits
  cachedItemAffixes = data.itemAffixes
}

async function loadRawItemMaps() {
  const baseUrl = getResourceBaseUrl()
  const [itemRes, settingRes, lanRes, avatarRes, rewardRes, enchantRes, triggerRes, equipGroupRes, equipSuitRes, itemAffixesRes] = await Promise.all([
    fetch(`${baseUrl}/data/item.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/gameSetting.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/lan.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/avatars.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/reward.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/equip/equipEnchant.json`).then(r => r.json()).catch(() => ({})),
    fetch(`${baseUrl}/data/skillTrigger.json`).then(r => r.json()).catch(() => ({})),
    fetch(`${baseUrl}/data/equip/equipGroup.json`).then(r => r.json()).catch(() => ({})),
    fetch(`${baseUrl}/data/equip/equipSuit.json`).then(r => r.json()).catch(() => ({})),
    fetch(`${baseUrl}/data/parsed/itemAffixes.json`).then(r => r.json()).catch(() => ({}))
  ])
  return { itemRes, settingRes, lanRes, avatarRes, rewardRes, enchantRes, triggerRes, equipGroupRes, equipSuitRes, itemAffixesRes }
}

/**
 * 统一加载核心数据（优先读取构建期预解析的 items.json）
 */
export async function fetchItemData() {
  if (cachedItems && cachedCategoryTree) {
    return {
      items: cachedItems,
      categoryTree: cachedCategoryTree,
      lanDict,
      avatars: cachedAvatars,
      rewards: cachedRewards,
      equipEnchants: cachedEquipEnchants,
      skillTriggers: cachedSkillTriggers,
      equipGroups: cachedEquipGroups,
      equipSuits: cachedEquipSuits,
      itemAffixes: cachedItemAffixes
    }
  }

  // 优先读取构建期预解析单文件（体积更小、无需运行时解析）
  try {
    const parsed = await fetchWithFallback('data/parsed/items.json')
    setItemCache(parsed)
    return parsed
  } catch (e) {
    console.warn('parsed/items.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  try {
    const maps = await loadRawItemMaps()
    const data = buildItemData(maps)
    setItemCache(data)
    return data
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

export function translateJobArray(jobIndices) {
  if (!jobIndices || jobIndices.length === 0) return []
  const jobString = lanDict?.['hero_job']
  if (!jobString) return jobIndices 
  
  const jobs = jobString.split(',')
  return jobIndices.map(idx => jobs[idx] || idx)
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
  if (!categoryArray || !categoryArray.length) return ''
  let currentTree = categoryTree || []
  const names = []
  
  for (let i = 0; i < categoryArray.length; i++) {
    const targetType = String(categoryArray[i])
    const found = currentTree ? currentTree.find(node => String(node.type) === targetType) : null
    if (found) {
      names.push(found.name)
      currentTree = found.info
    } else {
      const fallbackName = getCategoryName(targetType)
      if (fallbackName && fallbackName !== targetType) {
        names.push(fallbackName)
      }
      currentTree = null
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
  
  // 暂时处理 getReward 和 appraisal
  if ((item.useAction === 'getReward' || item.useAction === 'appraisal') && item.useActionPara.reward) {
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
            parsedRule.targetName = REWARD_MODE_INFO.money.name;
            parsedRule.typeId = REWARD_MODE_INFO.money.id;
            parsedRule.targetImg = REWARD_MODE_INFO.money.icon;
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
  } else if (item.useAction === 'getRewardSelect' && item.useActionPara && item.useActionPara.rewards) {
    const rules = item.useActionPara.rewards.map(r => {
      let parsedRule = {
        mode: 'item',
        typeId: r.itemTypeId,
        min: r.num,
        max: r.num,
        prob: 1,
        actualProb: 1
      };
      const targetItem = cachedItems?.find(i => i.typeId === r.itemTypeId);
      if (targetItem) {
        parsedRule.targetName = targetItem.name;
        parsedRule.targetImg = getItemImageUrl(targetItem);
        parsedRule.targetQuality = targetItem.quality || 1;
      } else {
        parsedRule.targetName = r.itemTypeId;
        parsedRule.targetImg = '';
        parsedRule.targetQuality = 1;
      }
      return parsedRule;
    });

    return [{
      isSelect: true,
      rate: 1,
      num: 1,
      rules: rules
    }];
  }
  
  return null;
}

/**
 * 根据 ID 查找缓存的物品
 */
export function getCachedItem(typeId) {
  return cachedItems?.find(i => i.typeId === typeId) || null
}

/**
 * 获取缓存的物品字典（typeId -> item），供共用食材组装等场景使用
 */
export function getCachedItemDict() {
  if (!cachedItems) return {}
  return Object.fromEntries(cachedItems.map(i => [i.typeId, i]))
}

/**
 * 解析符石效果 (类别包含 7)
 */
export function parseRuneEffect(item) {
  if (!item || !item.category || (!item.category.includes(7) && !item.category.includes('7'))) return null;
  
  const typeId = item.typeId;
  const enchantData = cachedEquipEnchants?.[typeId];
  if (!enchantData || !enchantData.skillTriggerId) return null;
  
  const skillTriggerId = enchantData.skillTriggerId;
  const skillTriggerLevel = enchantData.skillTriggerLevel || 1;
  
  const skillData = cachedSkillTriggers?.[skillTriggerId];
  if (!skillData || !skillData.levelData) return null;
  
  const levelData = skillData.levelData[String(skillTriggerLevel)];
  if (!levelData || !levelData.des) return null;
  
  // Format des: "血量上限增加 {240} 。" -> "血量上限增加 <span class='rune-val'>240</span> 。"
  const formattedDes = levelData.des.replace(/\{([^}]+)\}/g, "<span class='rune-val' style='color: #3b82f6;'>$1</span>");
  
  return {
    skillName: levelData.skillName || '',
    desHtml: formattedDes
  };
}

/**
 * 解析装备组包含的装备
 */
export function parseEquipGroup(item) {
  if (!item || !item.category || item.category.length !== 1 || (item.category[0] !== 4 && item.category[0] !== '4')) return null;

  if (!cachedEquipGroups) return null;

  // 根据 showItemTypeId 匹配对应的装备组 (例如 item.typeId 是 show_01head)
  const groupData = Object.values(cachedEquipGroups).find(g => g.showItemTypeId === item.typeId);
  
  if (!groupData || !groupData.type || !Array.isArray(groupData.type)) return null;

  const items = groupData.type.map(entry => {
    const targetItem = getCachedItem(entry.typeId);
    if (targetItem) {
      return {
        typeId: entry.typeId,
        targetName: targetItem.name,
        targetImg: getItemImageUrl(targetItem),
        targetQuality: targetItem.quality || 1
      };
    }
    return {
      typeId: entry.typeId,
      targetName: entry.typeId,
      targetImg: '',
      targetQuality: 1
    };
  });

  return items;
}

/**
 * 解析装备套装效果
 */
export function parseEquipSuit(item) {
  if (!item || !item.equip || !item.equip.suitTypeId || !cachedEquipSuits) return null;

  const suitData = cachedEquipSuits[item.equip.suitTypeId];
  if (!suitData) return null;

  const suitItems = (suitData.equipTypeId || []).map(typeId => {
    const targetItem = getCachedItem(typeId);
    if (targetItem) {
      return {
        typeId,
        targetName: targetItem.name,
        targetImg: getItemImageUrl(targetItem),
        targetQuality: targetItem.quality || 1
      };
    }
    return {
      typeId,
      targetName: typeId,
      targetImg: '',
      targetQuality: 1
    };
  });

  const suitEffects = (suitData.suitData || []).map(effect => {
    let des = effect.suitDes || '';
    const formattedDes = des.replace(/\{([^}]+)\}/g, "<span class='suit-val' style='color: #3b82f6;'>$1</span>");
    return {
      num: effect.suitNum,
      desHtml: formattedDes
    };
  });

  return {
    suitName: suitData.suitName || '未知套装',
    suitItems,
    suitEffects
  };
}

/**
 * 解析装备词条
 */
export function parseItemAffixes(item) {
  if (!item || !cachedItemAffixes) return null;

  const affixGroups = cachedItemAffixes[item.typeId];
  if (!affixGroups || !Array.isArray(affixGroups)) return null;

  const resultGroups = [];
  const seenPrefixes = new Set();
  
  for (const group of affixGroups) {
    if (!group.prefixes || !Array.isArray(group.prefixes)) continue;
    
    const parsedPrefixes = group.prefixes.filter(prefixId => {
      if (seenPrefixes.has(prefixId)) return false;
      seenPrefixes.add(prefixId);
      return true;
    }).map(prefixId => {
      const skillData = cachedSkillTriggers?.[prefixId];
      if (!skillData || !skillData.levelData) return null;
      
      const levelData = skillData.levelData['1'];
      if (!levelData || !levelData.des) return null;
      
      const formattedDes = levelData.des.replace(/\{([^}]+)\}/g, "<span class='affix-val' style='color: #3b82f6;'>$1</span>");
      
      return {
        id: prefixId,
        skillName: levelData.skillName || '',
        desHtml: formattedDes
      };
    }).filter(Boolean);

    if (parsedPrefixes.length > 0) {
      resultGroups.push({
        groupId: group.groupId,
        prefixes: parsedPrefixes
      });
    }
  }

  return resultGroups.length > 0 ? resultGroups : null;
}
