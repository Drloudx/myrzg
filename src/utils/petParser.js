import { getResourceBaseUrl } from './env.js'
import { fetchWithFallback } from './request.js'
import { ELEMENT_NAMES, getCleanSkillName } from './gameMappings.js'

let cachedPets = null
let cachedPetLevel = null
let cachedPetSetting = null

/**
 * 构建期纯函数：由原始 JSON 对象生成魔物图鉴最终数据。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildPetData(maps) {
  const { petRes, petLevelRes, petSettingRes, skillRes, skillTriggerRes } = maps

  const petDatas = petRes.datas || petRes || {}
  const petLevelDatas = petLevelRes.petLevel || petLevelRes || {}
  const petSettingDatas = petSettingRes || {}
  const skillDatas = skillRes.datas || skillRes || {}
  const skillTriggerDatas = skillTriggerRes.datas || skillTriggerRes || {}

  const processedPets = Object.entries(petDatas).map(([key, pet]) => {
      if (pet.hide === true) return null

      const typeId = pet.typeId || key
      const star = pet.star || 1
      const starDisplay = star + 2 // 3, 4, or 5 star
      const element = pet.element || 1
      
      const elementName = ELEMENT_NAMES[element] || '无'

      // Process mutant variants
      const variantsList = (pet.variants || []).map(v => ({
        type: v.type || 'a',
        chance: v.chance || 0,
        name: v.name || '变异',
        des: v.des || '',
        lifeTimeAdd: v.lifeTimeAdd || 0,
        sellPriceAdd: v.sellPriceAdd || 0
      }))

      // Process Skills
      const skillsList = []
      // 0. Normal Attack (普攻)
      skillsList.push({
        id: `${typeId}_normal`,
        type: 'normal',
        name: `${pet.name}普攻`,
        icon: '', // No icon
        levelData: [
          {
            level: 1,
            name: `${pet.name}普攻`,
            des: `对单体目标造成 {100%攻击力} 加成的物理伤害。`
          }
        ],
        maxLevel: 1
      })

      // 1. Passive Feature / Trait (特性) - First
      if (pet.skillSp) {
        const trigger = skillTriggerDatas[pet.skillSp]
        if (trigger) {
          const levelData = []
          if (trigger.levelData) {
            Object.entries(trigger.levelData).forEach(([lvlKey, lvlVal]) => {
              levelData.push({
                level: parseInt(lvlKey),
                name: lvlVal.skillName || trigger.skillName || '特性',
                des: lvlVal.des || ''
              })
            })
          }
          const rawName = trigger.name || trigger.skillName || (levelData[0] && levelData[0].name) || '特性'
          skillsList.push({
            id: pet.skillSp,
            type: 'trait',
            name: getCleanSkillName(rawName),
            icon: `/images/PetPanel/pet_skill_${starDisplay}.png`, // Frame border
            innerIcon: `/images/PicHandBookPanel/${pet.monImg}.png`, // Cropped inner face
            levelData,
            maxLevel: levelData.length
          })
        }
      }

      // 2. Active Skills (Skill 1 and Skill 2)
      const activeSkillIds = [pet.skill1, pet.skill2]
      const activeSkillIcons = [pet.skill1Icon, pet.skill2Icon]
      activeSkillIds.forEach((skillId, index) => {
        if (skillId) {
          const s = skillDatas[skillId] || skillTriggerDatas[skillId]
          if (s) {
            const levelData = []
            if (s.levelData) {
              Object.entries(s.levelData).forEach(([lvlKey, lvlVal]) => {
                levelData.push({
                  level: parseInt(lvlKey),
                  name: lvlVal.skillName || s.name || '技能',
                  des: lvlVal.des || '',
                  cd: lvlVal.cd || 0,
                  cost: lvlVal.cost || 0
                })
              })
            }
            
            let iconName = activeSkillIcons[index] || `skill_${skillId}`
            if (!iconName.endsWith('.png')) {
              iconName += '.png'
            }

            const rawName = s.name || s.skillName || (levelData[0] && levelData[0].name) || '技能'
            skillsList.push({
              id: skillId,
              type: 'active',
              name: getCleanSkillName(rawName),
              icon: `/images/Common_SkillIcon/${iconName}`,
              levelData,
              maxLevel: levelData.length
            })
          }
        }
      })

      return {
        id: typeId,
        name: pet.name,
        des: pet.des || '',
        monImg: pet.monImg,
        eggImg: pet.eggImg,
        star,
        starDisplay,
        element,
        elementName,
        variants: variantsList,
        hasVariant: variantsList.length > 0,
        skills: skillsList,
        // Base stats
        atk: pet.atk || 0,
        atkMin: pet.atkMin || 0,
        atkMax: pet.atkMax || 0,
        def: pet.def || 0,
        defMin: pet.defMin || 0,
        defMax: pet.defMax || 0,
        hp: pet.hp || 0,
        hpMin: pet.hpMin || 0,
        hpMax: pet.hpMax || 0,
        dex: pet.dex || 0,
        dexMin: pet.dexMin || 0,
        dexMax: pet.dexMax || 0,
        // Hatching stats
        eggTime: pet.eggTime || 0,
        sellPrice: pet.sellPrice || 0,
        exp: pet.exp || 0,
        petCd: pet.petCd || 0,
        roomCd: pet.roomCd || 0,
        lifeTime: pet.lifeTime || 0,
        keywords: `${pet.name} ${elementName} ${pet.des || ''}`.toLowerCase()
      }
    }).filter(Boolean)

  return {
    pets: processedPets,
    petLevel: petLevelDatas,
    petSetting: petSettingDatas
  }
}

async function loadRawPetMaps() {
  const baseUrl = getResourceBaseUrl()
  const [
    petRes,
    petLevelRes,
    petSettingRes,
    skillRes,
    skillTriggerRes
  ] = await Promise.all([
    fetch(`${baseUrl}/data/pet/pet.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/pet/petLevel.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/pet/petSetting.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/skill.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/skillTrigger.json`).then(r => r.json())
  ])
  return { petRes, petLevelRes, petSettingRes, skillRes, skillTriggerRes }
}

/**
 * 魔物图鉴数据加载：优先读取构建期预解析的 parsed/pets.json（单文件、免运行时解析），
 * 预解析文件缺失时回退到原始多文件加载 + 运行时解析。
 */
export async function fetchPetData() {
  if (cachedPets) {
    return {
      pets: cachedPets,
      petLevel: cachedPetLevel,
      petSetting: cachedPetSetting
    }
  }

  try {
    const parsed = await fetchWithFallback('data/parsed/pets.json')
    cachedPets = parsed.pets
    cachedPetLevel = parsed.petLevel
    cachedPetSetting = parsed.petSetting
    return parsed
  } catch (e) {
    console.warn('parsed/pets.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  try {
    const maps = await loadRawPetMaps()
    const data = buildPetData(maps)
    cachedPets = data.pets
    cachedPetLevel = data.petLevel
    cachedPetSetting = data.petSetting
    return data
  } catch (err) {
    console.error('Failed to parse pet data:', err)
    throw err
  }
}
