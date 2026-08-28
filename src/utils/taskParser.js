/**
 * 任务图鉴数据解析器
 * 规则来源：txt/任务提示词_完整版.txt（已按源码核实）
 */
import { fetchWithFallback } from './request.js'
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
  STEP_TYPE_NAMES,
  DIFFICULTY,
  BASE_REWARD_ICONS,
  BASE_REWARD_NAMES,
  BASE_REWARD_PATHS,
  TAG_LABELS,
  resolveDialogMeta,
  getMonsterIcon,
  getMapName,
  chapterSortKey,
  subSortKey,
  parseRewardEntries
} from './gameMappings.js'

// ---------- 工具 ----------
const arr = (v) => (v && Array.isArray(v) ? v : [])
const firstNonEmpty = (list) => list.find((x) => x && x.trim())

// ---------- 主解析 ----------
let cachedTaskData = null

/**
 * 构建期纯函数：由 17 个原始 JSON 对象生成任务图鉴最终数据。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildTaskData(maps) {
  const {
    taskJson,
    levelStageJson,
    levelRoomJson,
    areaJson,
    instanceJson,
    battleJson,
    roomJson,
    rewardJson,
    itemJson,
    monJson,
    conditionJson,
    roomCollectJson,
    roomCollectTypeJson,
    newOrderJson,
    heroJson,
    dialogIndexJson,
    dialogSegmentsJson
  } = maps

  const taskMap = taskJson.datas || {}
  const levelStageMap = levelStageJson.datas || {}
  const levelRoomMap = levelRoomJson.datas || {}
  const areaMap = areaJson.datas || {}
  const instanceMap = instanceJson.datas || {}
  const battleMap = battleJson.datas || {}
  const itemMap = itemJson.datas || {}
  const monMap = monJson.datas || {}
  const rewardMap = rewardJson.datas || {}
  const conditionMap = conditionJson.gameConditions || {}
  const collectMap = roomCollectJson.datas || {}
  const collectTypeMap = roomCollectTypeJson.datas || {}
  const heroMap = heroJson.datas || {}
  const newOrderGoods = (newOrderJson && newOrderJson.goods) || {}
  const dialogIndex = dialogIndexJson || {}
  const dialogSegments = dialogSegmentsJson || {}

  // 预构建索引
  const npcUidName = {}
  const roomMonIdType = {}
  for (const scene of Object.values(roomJson)) {
    for (const n of arr(scene && scene.battleData && scene.battleData.npcList)) {
      if (n && n.uid && !npcUidName[n.uid]) {
        const nm = firstNonEmpty([n.npcName, n.npcDes])
        if (nm) npcUidName[n.uid] = nm
      }
    }
    // hunterUid 的 uid（如 mon_s_4_6）在 monRounds.mons 里，monId -> typeId 才是怪的真实 id
    for (const round of arr(scene && scene.battleData && scene.battleData.monRounds)) {
      for (const mn of arr(round && round.mons)) {
        if (mn && mn.monId && !roomMonIdType[mn.monId]) roomMonIdType[mn.monId] = mn.typeId
      }
    }
  }

  const newOrderNpc = {}
  for (const g of Object.values(newOrderGoods)) {
    if (g && g.charaImg && g.tip) {
      newOrderNpc[g.charaImg] = String(g.tip).split(/[,，]/)[0].trim()
    }
  }

  const instBattleIndex = {}
  for (const [instId, inst] of Object.entries(instanceMap)) {
    for (const b of arr(inst && inst.battles)) {
      if (b && b.dungeonBattle) {
        instBattleIndex[b.dungeonBattle] = {
          battleName: b.name,
          instanceId: instId,
          instanceName: inst.name
        }
      }
    }
  }

  const taskNameMap = {}
  for (const [id, t] of Object.entries(taskMap)) taskNameMap[id] = t && t.name

  // ---------- 位置多表回退 ----------
  const resolveLocation = (id) => {
    if (!id) return null
    if (levelStageMap[id]) {
      const s = levelStageMap[id]
      return { type: 'stage', label: `${s.shortName} ${s.name}`.trim(), id }
    }
    if (levelRoomMap[id]) {
      const r = levelRoomMap[id]
      const area = areaMap[r.areaId]
      const mapArea = areaMap[`${r.areaId}_map`] || (area && area.chapter ? areaMap[`${area.chapter}_map`] : null)
      const parts = []
      if (mapArea && mapArea.name) parts.push(mapArea.name)
      if (area && area.name) parts.push(area.name)
      return { type: 'room', label: r.name, sub: parts.join(' > ') || undefined, id }
    }
    if (areaMap[id]) {
      return { type: 'area', label: areaMap[id].name, id }
    }
    if (instanceMap[id]) {
      return { type: 'instance', label: instanceMap[id].name, id }
    }
    if (instBattleIndex[id]) {
      const ib = instBattleIndex[id]
      return { type: 'instanceBattle', label: `${ib.instanceName} · ${ib.battleName}`, id }
    }
    if (battleMap[id]) {
      return { type: 'battle', label: battleMap[id].name, id }
    }
    // 章节代码归一化：c0/c1...C5（不带 _map）→ 该章大地图，如 c0 -> c0_map -> 求生者草原
    const lowId = String(id).toLowerCase()
    if (/^c\d+$/.test(lowId) && areaMap[`${lowId}_map`]) {
      return { type: 'area', label: areaMap[`${lowId}_map`].name, id }
    }
    if (areaMap[lowId]) {
      return { type: 'area', label: areaMap[lowId].name, id }
    }
    // 旧版遗留 id：前缀匹配区域（sldsd → 索利德山地）
    if (id.includes('_')) {
      const prefix = id.split('_')[0]
      if (areaMap[prefix] && areaMap[prefix].name) {
        return { type: 'areaLegacy', label: areaMap[prefix].name, id }
      }
    }
    return { type: 'raw', label: id, id }
  }

  // ---------- NPC 解析 ----------
  const heroNpcName = (id) => {
    if (!id) return null
    const key = id.startsWith('fav_') ? id.slice(4) : id
    return (heroMap[key] && heroMap[key].name) || null
  }

  const extractNameFromStep = (stepName, npcId) => {
    if (!stepName) return null
    const m = /(?:与|向|找|把|替|给|同)([^，。！？\s「」“”【】、]+?)(?:对话|聊聊|交谈|回报|提交|交付|谈谈|商量|商量一下|汇合|告别)/.exec(stepName)
    if (m) {
      const nm = m[1].replace(/["“”]/g, '').trim()
      if (nm && nm !== npcId) return nm
    }
    return null
  }

  const resolveNpc = (id, stepName) => {
    if (!id) return null
    if (npcUidName[id]) return { name: npcUidName[id], id }
    if (newOrderNpc[id]) return { name: newOrderNpc[id], id }
    const hn = heroNpcName(id)
    if (hn) return { name: hn, id }
    const extracted = extractNameFromStep(stepName, id)
    if (extracted) return { name: extracted, id }
    return { name: '未知', id }
  }

  // ---------- 奖励解析（统一走 gameMappings.parseRewardEntries） ----------

  // ---------- 条件解析 ----------
  const parseCondition = (condId) => {
    if (!condId) return '无'
    const c = conditionMap[condId]
    if (!c) return condId
    const desc = (c.desc || '').trim()
    if (desc) {
      // 描述里可能直接写任务 id（如“完成 m_2_6 步骤1后可接取”），把任务 id 替换成任务名
      return desc.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (tok) => {
        if (taskNameMap[tok] && tok !== condId) return `《${taskNameMap[tok]}》`
        return tok
      })
    }
    const parts = []
    for (const rule of arr(c.rules)) {
      if (rule.type === 'passTask' && rule.para && rule.para.typeId) {
        const tname = taskNameMap[rule.para.typeId] || rule.para.typeId
        const step = rule.para.step
        parts.push(step > 0 ? `完成《${tname}》第${step}步` : `完成《${tname}》`)
      } else if (rule.type === 'passStage' && rule.para && rule.para.stages) {
        const names = arr(rule.para.stages).map((s) => {
          const loc = resolveLocation(s)
          return loc ? loc.label : s
        })
        parts.push(`通关 ${names.join('、')}`)
      }
    }
    return parts.length ? parts.join('；') : condId
  }

  // ---------- 条件步骤：解锁关卡 ----------
  const parseUnlockStages = (ids) => arr(ids).map((id) => resolveLocation(id)).filter(Boolean)

  // ---------- 步骤解析 ----------
  const parseStep = (s, index) => {
    const p = s.stepPara || {}
    const type = s.stepType || 'unknown'
    const pos = s.stepPosition || []
    const detail = []
    let dialogs = []
    let monsters = []
    let submitItems = []

    const cleanName = (raw) => (dialogIndex[raw] || s.stepName || '').replace(/\s+/g, ' ').trim()
    const dlgMeta = (raw) => resolveDialogMeta(raw, cleanName(raw))
    // NPC：匹配成功只显示名字；匹配失败显示“未知（id）”
    const npcText = (npc) => (npc && (npc.name === '未知' ? `${npc.name}（${npc.id}）` : npc.name)) || null

    const push = (label, value) => {
      if (value !== null && value !== undefined && value !== '' && value !== '—') {
        detail.push({ label, value })
      }
    }

    switch (type) {
      case 'talk': {
        const npc = resolveNpc(p.npc, s.stepName)
        push('NPC', npcText(npc))
        if (pos[0] === 'room') {
          const loc = resolveLocation(pos[1])
          if (loc) push('房间', loc.sub ? `${loc.label}（${loc.sub}）` : loc.label)
        }
        push('交互对话', p.title)
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'npcTalkBattle': {
        const hn = heroNpcName(p.npc)
        const npc = hn ? { name: hn, id: p.npc } : resolveNpc(p.npc, s.stepName)
        push('NPC', npcText(npc))
        const b = battleMap[p.battleId]
        if (b) {
          const layerNames = []
          for (const lay of arr(b.layers)) {
            for (const ld of arr(lay && lay.layerDatas)) {
              if (ld && ld.name) layerNames.push(ld.name)
            }
          }
          push('事件', b.name)
          if (layerNames.length) push('事件关卡', layerNames.join(' / '))
        } else if (p.battleId) {
          push('事件', p.battleId)
        }
        // 好感度事件（movieMode 电影式战斗）：营地对话 / 战斗剧情 是同一事件的不同段，
        // 展示时按段拆开，每段一个独立剧情入口（各自带名字）
        const movieBattle = !!(battleMap[p.battleId] && battleMap[p.battleId].para && battleMap[p.battleId].para.movieMode)
        if (p.dialog) {
          const segBase = /^(.*)_\d+$/.exec(p.dialog)
          const family = segBase ? (dialogSegments[segBase[1]] || []) : []
          if (movieBattle && family.length >= 2) {
            for (const seg of family) {
              dialogs.push({ label: '剧情', meta: dlgMeta(seg) })
            }
          } else {
            dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
          }
        }
        break
      }
      case 'passInstance': {
        const pos0 = pos[0]
        if (pos0 === 'battle') {
          const inst = instanceMap[pos[1]]
          push('副本', inst ? inst.name : pos[1])
          const ib = instBattleIndex[pos[2]]
          push('副本关卡', ib ? ib.battleName : pos[2])
        } else if (pos0 === 'stage') {
          const loc = resolveLocation(pos[1])
          push('关卡', loc ? loc.label : pos[1])
          if (pos[2] && DIFFICULTY[pos[2]]) push('难度', DIFFICULTY[pos[2]])
        } else if (pos0 === 'room') {
          const inst = instanceMap[p.instanceId]
          push('副本', inst ? inst.name : p.instanceId || null)
          const b = battleMap[p.battleId]
          push('事件关卡', b ? b.name : p.battleId || null)
          const loc = resolveLocation(pos[1])
          if (loc) push('房间', loc.sub ? `${loc.label}（${loc.sub}）` : loc.label)
        }
        if (!detail.length) {
          const inst = instanceMap[p.instanceId]
          push('副本', inst ? inst.name : p.instanceId || null)
          const b = battleMap[p.battleId]
          push('事件关卡', b ? b.name : p.battleId || null)
        }
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'passStage': {
        // 特殊：只显示名称、类型、剧情与描述，不显示关卡/位置/解锁
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'hunter': {
        const monIds = p.monTypeIds || (p.monTypeId ? [p.monTypeId] : [])
        monsters = monIds.map((id) => {
          const mm = monMap[id]
          return {
            id,
            name: (mm && mm.name) || id,
            icon: mm ? getMonsterIcon(mm.icon, mm.viewData && mm.viewData.skinName) : ''
          }
        })
        if (p.num) push('数量', `${p.num} 只`)
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'hunterUid': {
        // uid 可能是怪 id 直查，也可能是房间 npc uid（mon_s_4_6 这种），经 room.json monRounds 反查真实 typeId
        const typeId = monMap[p.uid] ? p.uid : (roomMonIdType[p.uid] || p.uid)
        const mm = monMap[typeId]
        if (mm) {
          monsters = [{
            id: typeId,
            uid: p.uid,
            name: mm.name || p.uid,
            icon: getMonsterIcon(mm.icon, mm.viewData && mm.viewData.skinName)
          }]
          if (mm.monDes) push('说明', mm.monDes)
        } else if (p.uid) {
          // 极少数遗留 uid（如 main_002_jiazhu）查不到，从步骤名里提取怪名兜底
          const nameMatch = /(?:击败|狩猎|讨伐|解决|消灭|干掉)(.+)/.exec(s.stepName || '')
          monsters = [{ id: p.uid, name: (nameMatch && nameMatch[1].trim()) || p.uid, icon: '' }]
        }
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'getItemNpc': {
        const rawItems = p.items && p.items.length
          ? p.items
          : (p.itemTypeId ? [{ itemTypeId: p.itemTypeId, num: p.num }] : [])
        submitItems = rawItems.map((i) => {
          const it = itemMap[i.itemTypeId]
          return {
            typeId: i.itemTypeId,
            name: (it && it.name) || i.itemTypeId,
            count: i.num,
            icon: `/Common_ItemIcon/${(it && it.img) || i.itemTypeId}.png`
          }
        })
        if (p.removeItem) push('说明', '提交后扣除道具')
        const npc = resolveNpc(p.npc, s.stepName)
        push('NPC', npcText(npc))
        if (p.dialog0) dialogs.push({ label: '不满足条件', meta: resolveDialogMeta(p.dialog0) })
        if (p.dialog1) dialogs.push({ label: '满足条件', meta: resolveDialogMeta(p.dialog1) })
        break
      }
      case 'getItem': {
        const item = itemMap[p.itemTypeId]
        if (p.itemTypeId) {
          submitItems = [{
            typeId: p.itemTypeId,
            name: (item && item.name) || p.itemTypeId,
            count: p.num,
            icon: `/Common_ItemIcon/${(item && item.img) || p.itemTypeId}.png`
          }]
        }
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'collect': {
        // roomCollect.json 的 name 多为策划备注（如“主线main_0_02，绿榛菇采集”），
        // 干净名称在 roomCollectType.json（collectTypeId -> name），优先用它并去重
        const names = []
        for (const id of arr(p.collectIds)) {
          const c = collectMap[id]
          if (!c) { names.push(id); continue }
          const ct = c.collectTypeId ? collectTypeMap[c.collectTypeId] : null
          if (ct && ct.name) { names.push(ct.name); continue }
          // 无类型名时，仅当 roomCollect.name 不含备注特征（逗号/任务id）才使用
          const rawName = c.name || ''
          if (rawName && !/[,，]/.test(rawName) && !/[A-Za-z_]\w*\d/.test(rawName)) names.push(rawName)
          else names.push(id)
        }
        const uniqueNames = [...new Set(names)]
        push('采集点', uniqueNames.length ? uniqueNames.join('、') : null)
        if (p.num) push('数量', `${p.num} 次`)
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'gotoStage': {
        const loc = resolveLocation(p.stageId)
        push('场景', loc ? loc.label : p.stageId || null)
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'gotoCamp': {
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      case 'tag': {
        push('目标', TAG_LABELS[p.tag] ? TAG_LABELS[p.tag] : p.tag)
        break
      }
      case 'openAreaShow': {
        // areaTypeId 可能是区域、副本（dungeonaseyj 等）或关卡，走多表回退
        const areaLoc = resolveLocation(p.areaTypeId)
        push('解锁区域', areaLoc ? areaLoc.label : p.areaTypeId || null)
        const fatherLoc = resolveLocation(p.fatherAreaTypeId)
        if (fatherLoc) push('所属大地图', fatherLoc.label)
        break
      }
      case 'level': {
        push('目标', p.level ? `达到 Lv.${p.level}` : null)
        break
      }
      case 'sellPet': {
        push('目标', p.num ? `在培育室卖出 ${p.num} 只魔物` : null)
        if (p.dialog) dialogs.push({ label: '剧情', meta: dlgMeta(p.dialog) })
        break
      }
      default: {
        push('stepType', type)
        push('原始数据', JSON.stringify(p))
      }
    }

    const suppressUnlock = type === 'passStage'
    return {
      index,
      name: s.stepName || '',
      des: s.stepDes || '',
      type,
      typeName: STEP_TYPE_NAMES[type] || '未知步骤类型',
      reward: parseRewardEntries(rewardMap, itemMap, s.stepReward),
      unlockStages: suppressUnlock ? [] : parseUnlockStages(s.stepUnlockStage),
      unlockSuppressed: suppressUnlock && arr(s.stepUnlockStage).length > 0,
      detail,
      dialogs,
      monsters,
      submitItems,
      position: pos
    }
  }

  // ---------- 任务解析 ----------
  const rawTasks = []
  for (const [typeId, t] of Object.entries(taskMap)) {
    const cat = arr(t.category)
    const isDemo = cat.includes('demo') || cat.includes('demo支线') || typeId.startsWith('demo_')
    const isPartnerArchive = cat.length === 1 && cat[0] === '伙伴档案'
    if (isDemo || isPartnerArchive) continue

    const type = t.taskType
    const typeLabel = TASK_TYPE_LABELS[type] || `类型${type}`
    const subRaw = cat[1] || ''
    const subLabel = type === 3 && subRaw ? formatEntrustLabel(subRaw, areaMap) : subRaw || '其他'

    const getTask = t.getTask || {}
    const getTaskDialog = getTask.dialog ? resolveDialogMeta(getTask.dialog, (dialogIndex[getTask.dialog] || '').replace(/\s+/g, ' ').trim()) : null

    rawTasks.push({
      id: typeId,
      name: t.name || typeId,
      des: t.des || '',
      des2: t.des2 || '',
      type,
      typeLabel,
      typeOrder: TASK_TYPE_ORDER[type] !== undefined ? TASK_TYPE_ORDER[type] : 9,
      subRaw,
      subLabel,
      subKey: type === 3 ? subRaw : (subRaw || '其他'),
      close: !!t.close,
      reward: parseRewardEntries(rewardMap, itemMap, t.reward),
      getTask: {
        npc: getTask.npc ? resolveNpc(getTask.npc) : null,
        title: getTask.title || '',
        dialog: getTaskDialog,
        condition: parseCondition(getTask.condition)
      },
      unlockTasks: arr(t.unlockTask).map((id) => ({ id, name: taskNameMap[id] || id })).filter(Boolean),
      unlockStages: parseUnlockStages(t.unlockStage),
      steps: arr(t.steps).map((s, i) => parseStep(s, i + 1)),
      raw: t
    })
  }

  rawTasks.sort((a, b) => a.typeOrder - b.typeOrder || subSortKey(a.type, a.subKey) - subSortKey(b.type, b.subKey) || a.id.localeCompare(b.id))

  // 二级分类选项（数据驱动）
  const subOptions = {}
  for (const t of rawTasks) {
    if (!subOptions[t.type]) subOptions[t.type] = []
    const existing = subOptions[t.type].find((x) => x.key === t.subKey)
    if (!existing) {
      subOptions[t.type].push({ key: t.subKey, label: t.subLabel })
    }
  }
  for (const type of Object.keys(subOptions)) {
    subOptions[type].sort((a, b) => subSortKey(Number(type), a.key) - subSortKey(Number(type), b.key))
  }

  const stats = {
    total: rawTasks.length,
    closed: rawTasks.filter((t) => t.close).length,
    byType: {}
  }
  for (const t of rawTasks) {
    stats.byType[t.type] = (stats.byType[t.type] || 0) + 1
  }

  return { tasks: rawTasks, subOptions, stats, TYPE_LABELS: TASK_TYPE_LABELS }
}

async function loadRawTaskMaps() {
  const [
    taskJson,
    levelStageJson,
    levelRoomJson,
    areaJson,
    instanceJson,
    battleJson,
    roomJson,
    rewardJson,
    itemJson,
    monJson,
    conditionJson,
    roomCollectJson,
    roomCollectTypeJson,
    newOrderJson,
    heroJson,
    dialogIndexJson,
    dialogSegmentsJson
  ] = await Promise.all([
    fetchWithFallback('data/task.json'),
    fetchWithFallback('data/levelStage.json'),
    fetchWithFallback('data/levelRoom.json'),
    fetchWithFallback('data/area.json'),
    fetchWithFallback('data/instance.json'),
    fetchWithFallback('data/battle.json'),
    fetchWithFallback('data/room.json'),
    fetchWithFallback('data/reward.json'),
    fetchWithFallback('data/item.json'),
    fetchWithFallback('data/mon.json'),
    fetchWithFallback('data/condition.json'),
    fetchWithFallback('data/roomCollect.json'),
    fetchWithFallback('data/roomCollectType.json'),
    fetchWithFallback('data/委托订单newOrder.json'),
    fetchWithFallback('data/hero/hero.json'),
    fetchWithFallback('data/parsed/dialogIndex.json'),
    fetchWithFallback('data/parsed/dialogSegments.json')
  ])
  return {
    taskJson,
    levelStageJson,
    levelRoomJson,
    areaJson,
    instanceJson,
    battleJson,
    roomJson,
    rewardJson,
    itemJson,
    monJson,
    conditionJson,
    roomCollectJson,
    roomCollectTypeJson,
    newOrderJson,
    heroJson,
    dialogIndexJson,
    dialogSegmentsJson
  }
}

/**
 * 任务图鉴数据加载：优先读取构建期预解析的 parsed/tasks.json（单文件、免运行时解析），
 * 预解析文件缺失时回退到原始 17 文件加载 + 运行时解析。
 */
export async function loadTaskData() {
  if (cachedTaskData) return cachedTaskData

  try {
    const parsed = await fetchWithFallback('data/parsed/tasks.json')
    cachedTaskData = parsed
    return parsed
  } catch (e) {
    console.warn('parsed/tasks.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  const maps = await loadRawTaskMaps()
  const data = buildTaskData(maps)
  cachedTaskData = data
  return data
}

function formatEntrustLabel(cKey, areaMap) {
  // 委托分类 C0~C5 -> 统一使用全局地图映射，页面不再各自读取/维护名称。
  return getMapName(cKey)
}
