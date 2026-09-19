<template>
  <UiModal :visible="visible" :title="currentForm?.name || monster?.name || '怪物详情'" max-width="860px" scroll-id="monsterModalScroll" :z-index="2000" @update:visible="handleClose">
    <UiEmptyState v-if="loading" type="loading" text="正在加载怪物详情..." />
    <UiEmptyState v-else-if="loadError" type="error" :text="loadError">
      <template #action><UiButton @click="loadMonster">重新加载</UiButton></template>
    </UiEmptyState>
    <div v-else-if="renderError" class="error-state">渲染错误: {{ renderError }}</div>
    <template v-else-if="monster && currentForm">
      <!-- 怪物 ID 按需求隐藏（保留代码，需要时取消注释即可恢复） -->
      <!-- <div class="id-line"><UiTag tone="wood" class="copy-tag" title="点击复制 ID" @click="copyId(currentForm.id)">ID: {{ currentForm.id }}</UiTag></div> -->

      <div class="portrait-section paper-panel corner-nails">
        <div class="portrait-box">
          <UiTag tone="accent" class="portrait-relation">{{ currentForm.relationType || currentForm.tabLabel || '本体' }}</UiTag>
          <img :src="portraitUrl" :alt="currentForm.name || monster.name" class="portrait-img" data-image-fallback="custom" @error="handlePortraitError" />
        </div>
        <div v-if="monster.place?.length" class="tags-row"><UiTag v-for="place in monster.place" :key="place" tone="default">{{ place }}</UiTag></div>
        <p v-if="monster.text" class="monster-desc">{{ monster.text }}</p>
      </div>

      <div v-if="allForms.length > 1" class="forms-tabs"><UiTabs v-model="currentFormIndex" :options="formTabOptions" /></div>

      <div v-if="currentForm.transform" class="variant-context variant-context--transform">
        <div class="variant-context__item"><span>变身前</span><strong>{{ currentForm.transform.fromName }}</strong></div>
        <div class="variant-context__item"><span>变身条件</span><strong>{{ currentForm.transform.condition }}</strong><small v-if="currentForm.transform.reverseCondition">恢复：{{ currentForm.transform.reverseCondition }}</small></div>
        <div class="variant-context__item variant-context__item--current"><span>当前状态</span><strong>{{ currentForm.transform.currentStage === 'after' ? '变身后' : '变身前' }}</strong></div>
        <div class="variant-context__item"><span>变身后</span><strong>{{ currentForm.transform.toName }}</strong></div>
      </div>

      <div v-if="towerAppearances.length" class="variant-context variant-context--tower">
        <template v-for="tower in towerAppearances" :key="tower.towerId">
          <div class="variant-context__item"><span>出现位置</span><strong>{{ tower.towerName }}</strong></div>
          <div class="variant-context__item"><span>出现楼层</span><strong>{{ formatTowerFloors(tower.floors) }}</strong></div>
        </template>
      </div>

      <div class="form-content">
        <UiSection title="等级属性估算">
          <div class="level-slider paper-panel-solid">
            <div class="level-slider__header">
              <span>当前等级</span>
              <strong>Lv.{{ currentLevel }}</strong>
            </div>
            <input v-model.number="currentLevel" class="level-slider__input" type="range" min="1" max="101" aria-label="等级属性估算" />
          </div>
          <UiStatGrid :items="growthStats" />
          <UiStatGrid v-if="fixedStats.length" class="fixed-stat-grid" :items="fixedStats" />
          <div v-if="currentForm.keyList?.length" class="tags-row tags-row--left"><UiTag v-for="tag in currentForm.keyList" :key="tag" tone="gold">{{ tag }}</UiTag></div>
        </UiSection>

        <UiSection v-if="currentForm.weakAttDes" title="弱点与抗性"><p class="text-desc" v-html="formatHighlightedText(currentForm.weakAttDes)"></p></UiSection>

        <UiSection v-if="currentForm.skills?.length" title="技能机制">
          <div class="mechanic-list">
            <article v-for="skill in currentForm.skills" :key="skill.id" class="mechanic-card">
              <header class="mechanic-head">
                <div class="mechanic-title"><UiTag :tone="skill.kind === '普攻' ? 'default' : 'accent'">{{ skill.kind }}</UiTag><strong>{{ skill.name }}</strong></div>
                <span v-if="skill.cooldown > 0" class="mechanic-meta">冷却 {{ skill.cooldown }} 秒</span>
              </header>
              <p v-if="skill.des" class="mechanic-desc" v-html="formatHighlightedText(skill.des)"></p>
              <p v-if="skill.summary" class="mechanic-summary">{{ skill.summary }}</p>
              <div v-if="skill.damageHits?.length" class="hit-list">
                <div v-for="(hit, index) in skill.damageHits" :key="`${skill.id}-${index}`" class="hit-row">
                  <span>第 {{ index + 1 }} 段</span><span>{{ formatDamageType(hit.type) }} {{ Math.round(hit.multiplier * 100) }}%<template v-if="hit.count > 1"> ×{{ hit.count }}</template></span>
                  <span v-if="hit.baseDamage">基础伤害 {{ hit.baseDamage }}</span><span v-if="hit.repelForce">击退 {{ hit.repelForce }}</span><span v-if="hit.stagger">硬直 {{ hit.stagger }} 秒</span>
                </div>
              </div>
              <div class="mechanic-tags">
                <UiTag v-for="range in (skill.ranges || []).filter(item => !['moveGridRange', 'moveDis'].includes(item.key))" :key="`${range.key}-${range.value}`" tone="default">{{ formatRangeLabel(range.key) }} {{ range.value }}</UiTag>
                <UiTag v-for="buff in skill.addBuffs || []" :key="buff.id" tone="danger">附加 {{ buff.name }}</UiTag>
                <UiTag v-for="summon in skill.summons || []" :key="`${summon.monsterId}-${summon.name}`" tone="gold">{{ formatSummon(summon) }}</UiTag>
                <UiTag v-if="skill.trap" tone="danger">{{ formatTrap(skill.trap) }}</UiTag>
              </div>
              <div v-if="skill.addBuffs?.some(buff => buff.description || buff.duration > 0)" class="linked-effect-list">
                <div v-for="buff in skill.addBuffs.filter(item => item.description || item.duration > 0)" :key="`${buff.id}-effect`" class="linked-effect-row">
                  <strong>{{ buff.name }}</strong><span>{{ formatSkillBuffEffect(buff) }}</span>
                </div>
              </div>
            </article>
          </div>
        </UiSection>

        <UiSection v-if="currentForm.buffs?.length" :title="buffSectionTitle">
          <div class="mechanic-list">
            <article v-for="buff in currentForm.buffs" :key="buff.id" class="mechanic-card">
              <header class="mechanic-head">
                <div class="mechanic-title"><UiTag :tone="currentForm.buffs.length === 1 ? 'accent' : 'gold'">{{ buff.selectionType }}</UiTag><strong>{{ buff.nameAdd }}{{ buff.name }}</strong></div>
                <span v-if="currentForm.buffs.length > 1" class="mechanic-meta">占比 {{ formatPercent(buff.probability) }}</span>
              </header>
              <p v-if="buff.des && buff.des !== 'noneButEft'" class="mechanic-desc" v-html="formatHighlightedText(buff.des)"></p>
              <div class="mechanic-tags">
                <UiTag v-if="buff.duration > 0" tone="default">持续 {{ buff.duration }} 秒</UiTag><UiTag v-if="buff.stackable" tone="gold">可叠加{{ buff.maxStacks ? ` · 最多 ${buff.maxStacks} 层` : '' }}</UiTag>
                <UiTag v-if="buff.triggerLabel" tone="default">{{ buff.triggerLabel }}</UiTag>
                <UiTag v-if="buff.triggerInterval > 0" tone="default">触发间隔 {{ buff.triggerInterval }} 秒</UiTag><UiTag v-if="buff.damageReduction" tone="accent">伤害倍率 {{ formatSignedPercent(buff.damageReduction) }} / 层</UiTag>
                <UiTag v-if="buff.speedChange" tone="accent">移速变化 {{ formatSignedPercent(buff.speedChange) }}</UiTag><UiTag v-if="buff.muPower" tone="danger">{{ formatDamageType(buff.damageType) }} {{ Math.round(buff.muPower * 100) }}%</UiTag>
                <UiTag v-if="buff.rectRange" tone="default">范围 {{ buff.rectRange }}</UiTag><UiTag v-if="buff.addBuffs?.length" tone="danger">附加 {{ buff.addBuffs.join('、') }}</UiTag>
              </div>
              <div v-if="buff.linkedEffects?.length" class="linked-effect-list">
                <div v-for="effect in buff.linkedEffects" :key="effect.id" class="linked-effect-row">
                  <strong>{{ effect.name }}</strong><span>{{ formatLinkedBuffEffect(effect) }}</span>
                </div>
              </div>
            </article>
          </div>
        </UiSection>

        <UiSection v-for="section in configuredRewardSections" :key="section.title" :title="section.title">
          <div v-for="(group, groupIndex) in section.groups" :key="groupIndex" class="reward-pool"><div class="reward-items">
            <UiRewardCard v-for="(rule, ruleIndex) in group.rules || []" :key="ruleIndex" :rule="rewardCardRule(rule, group)" :clickable="isRewardClickable(rule)" @click="handleRewardClick(rule)" />
          </div></div>
        </UiSection>

      </div>
    </template>
    <UiBackToTop scroll-container="#monsterModalScroll" />
  </UiModal>
</template>

<script setup>
import { computed, onBeforeUnmount, onErrorCaptured, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiBackToTop, UiButton, UiEmptyState, UiModal, UiRewardCard, UiSection, UiStatGrid, UiTabs, UiTag } from './ui/index.js'
import { getImageUrl, handleImageFallback } from '../utils/env'
import { fetchMonsterData, fetchMonsterLevelStrength } from '../utils/monsterParser'
import { formatHighlightedText, translateStatName } from '../utils/gameMappings'

defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible'])
const router = useRouter()
const route = useRoute()
const monster = ref(null)
const currentFormIndex = ref(0)
const levelStrengthMap = ref({})
const currentLevel = ref(1)
const renderError = ref(null)
const portraitUrl = ref('')
const loading = ref(false)
const loadError = ref('')
let loadOperation = 0

onErrorCaptured(error => { renderError.value = error.message || String(error); console.error('MonsterDetailModal render error:', error); return false })

const loadMonster = async () => {
  const operation = ++loadOperation
  const newId = route.query.id
  loadError.value = ''
  renderError.value = null
  if (route.path !== '/monsters' || !newId) {
    monster.value = null
    loading.value = false
    emit('update:visible', false)
    return
  }
  loading.value = true
  emit('update:visible', true)
  try {
    const [officialMonsters, levelStrength] = await Promise.all([fetchMonsterData(), fetchMonsterLevelStrength()])
    if (operation !== loadOperation) return
    levelStrengthMap.value = levelStrength
    let foundMonster = null
    let foundFormIndex = 0
    for (const entry of officialMonsters) {
      const index = [...(entry.forms || []), ...(entry.summons || [])].findIndex(form => form.id === newId)
      if (index < 0) continue
      foundMonster = entry
      foundFormIndex = index
      break
    }
    if (!foundMonster) throw new Error('未找到该怪物，请返回列表重新选择。')
    monster.value = foundMonster
    currentFormIndex.value = foundFormIndex
  } catch (error) {
    if (operation === loadOperation) loadError.value = error.message || '怪物数据暂时不可用，请重试。'
  } finally {
    if (operation === loadOperation) loading.value = false
  }
}
watch(() => [route.path, route.query.id], loadMonster, { immediate: true })
onBeforeUnmount(() => { loadOperation += 1 })

const allForms = computed(() => monster.value ? [...(monster.value.forms || []), ...(monster.value.summons || [])] : [])
const currentForm = computed(() => allForms.value[currentFormIndex.value] || null)
const towerAppearances = computed(() => currentForm.value?.towerAppearances?.length
  ? currentForm.value.towerAppearances
  : (currentForm.value?.towerBossAppearances || []))
const formTabOptions = computed(() => allForms.value.map((form, index) => ({ value: index, label: form.tabLabel || form.name || `形态${index + 1}` })))
const formatDisplayStat = (key, raw, growth = {}) => {
  const percentKeys = new Set(['crit', 'critRes', 'critDam', 'atkFloatMin', 'atkFloatMax', 'rebDam', 'vampire', 'cureAdd'])
  return {
    label: translateStatName(key),
    value: key in growth
      ? growth[key].toLocaleString('zh-CN')
      : (percentKeys.has(key) ? `${Number(raw[key]) < 2 ? Math.round(Number(raw[key]) * 100) : raw[key]}%` : raw[key])
  }
}
const statGroups = computed(() => {
  const raw = currentForm.value?.rawStats || {}
  const coefficient = Number(levelStrengthMap.value[String(currentLevel.value)]?.coefficient || 1)
  const growth = { maxHp: Math.floor(Number(raw.maxHp || 0) * coefficient), phyAtk: Math.floor(Number(raw.phyAtk || 0) * coefficient), magicAtk: Math.floor(Number(raw.magicAtk || 0) * coefficient), phyDef: Math.floor(Number(raw.phyDef || 0) * coefficient), magicDef: Math.floor(Number(raw.magicDef || 0) * coefficient) }
  const growthKeys = ['maxHp', 'phyAtk', 'magicAtk', 'phyDef', 'magicDef']
  const fixedKeys = ['crit', 'critRes', 'critDam', 'atkRange', 'atkFloatMin', 'atkFloatMax', 'runSpeed', 'repelRes', 'phyAtkPen', 'magicAtkPen', 'rebDam', 'vampire', 'cureAdd']
  return {
    growth: growthKeys.filter(key => Number(raw[key] || growth[key] || 0) !== 0).map(key => formatDisplayStat(key, raw, growth)),
    fixed: fixedKeys.filter(key => Number(raw[key] || 0) !== 0).map(key => formatDisplayStat(key, raw))
  }
})
const growthStats = computed(() => statGroups.value.growth)
const fixedStats = computed(() => statGroups.value.fixed)

const buffSectionTitle = computed(() => currentForm.value?.buffs?.length > 1 ? '随机携带效果' : '固有效果')
const configuredRewardSections = computed(() => {
  const sections = []
  if (monster.value?.baseRewards?.length) sections.push({ title: '图鉴战利品', groups: monster.value.baseRewards })
  if (currentForm.value?.collectRewards?.length && JSON.stringify(currentForm.value.collectRewards) !== JSON.stringify(monster.value?.baseRewards || [])) sections.push({ title: '怪物配置奖励', groups: currentForm.value.collectRewards })
  return sections
})
watch(currentFormIndex, index => { const form = allForms.value[index]; if (form) router.replace({ query: { ...route.query, id: form.id } }) })
watch(currentForm, form => {
  if (!form) return
  currentLevel.value = Number(form.level || 1)
  portraitUrl.value = getImageUrl(form.portraitPath)
}, { immediate: true })

const handleClose = () => { emit('update:visible', false); if (route.query.id) { const query = { ...route.query }; delete query.id; router.replace({ query }) } }
// ID 显示已隐藏，复制入口随之停用（保留实现，恢复 ID 显示时一并取消注释）
// const copyId = id => { if (id) navigator.clipboard.writeText(id).catch(error => console.error('Failed to copy ID:', error)) }
const handlePortraitError = event => {
  const baseId = String(monster.value?.id || '').replace('hero_', '')
  const rawIcon = currentForm.value?.icon || monster.value?.icon
  const names = [baseId && `colect_mon_${baseId}`, rawIcon].filter(Boolean)
  const candidates = names.flatMap(name => [name, name.replace('colect_mon_', 'colectr_mon_')])
    .map(name => getImageUrl(`/images/PicHandBookPanel_Atlas/${name}.webp`))
  handleImageFallback(event, { source: portraitUrl.value, candidates })
}
const rewardCardRule = (rule, group) => ({ ...rule, targetImg: getImageUrl(rule.targetImg), min: group.min, max: group.max })
const isRewardClickable = rule => !!rule?.targetId && ['item', 'equipGroup', 'equip'].includes(rule.mode)
const handleRewardClick = rule => { if (isRewardClickable(rule)) router.push({ query: { ...route.query, itemId: rule.targetId } }) }
const formatPercent = value => { const percent = Number(value || 0) * 100; return `${percent.toFixed(percent % 1 ? 1 : 0)}%` }
const formatTowerFloors = floors => `第 ${(floors || []).join('、')} 层`
const formatSignedPercent = value => `${Number(value) > 0 ? '+' : ''}${Math.round(Number(value) * 100)}%`
const formatSummon = summon => {
  const details = [summon.randomPool
    ? `从${summon.poolNames.join(' / ')}中随机召唤 ${summon.count} 只${summon.allowDuplicates ? '（可重复）' : ''}`
    : `召唤 ${summon.name} x${summon.count}`]
  if (summon.maxCount > 0) details.push(`场上最多 ${summon.maxCount} 只`)
  if (summon.delay > 0) details.push(`延迟 ${summon.delay} 秒`)
  if (summon.hpPercent > 0) details.push(`继承生命 ${Math.round(summon.hpPercent * 1000) / 10}%`)
  if (summon.atkPercent > 0) details.push(`继承攻击 ${Math.round(summon.atkPercent * 1000) / 10}%`)
  if (summon.defPercent > 0) details.push(`继承防御 ${Math.round(summon.defPercent * 1000) / 10}%`)
  if (summon.duration > 0) details.push(`持续 ${summon.duration} 秒`)
  return details.join(' · ')
}
const formatSkillBuffEffect = buff => [
  buff.description,
  buff.duration > 0 ? `持续 ${buff.duration} 秒` : ''
].filter(Boolean).join(' · ')
const formatTrap = trap => [
  '持续性陷阱',
  trap.duration > 0 ? `持续 ${trap.duration} 秒` : '',
  trap.interval > 0 ? `每 ${trap.interval} 秒` : ''
].filter(Boolean).join(' · ')
const formatLinkedBuffEffect = effect => {
  const details = []
  if (effect.healPercent || effect.healBase) {
    const interval = effect.interval > 0 ? `每 ${effect.interval} 秒` : ''
    const scale = effect.healType === 'maxHp' ? '最大生命' : ''
    const amount = effect.healPercent ? `${Math.round(effect.healPercent * 1000) / 10}%${scale}` : `${effect.healBase} 点生命`
    details.push(`${interval}恢复 ${amount}`.trim())
  } else if (effect.damageMultiplier || effect.damageBase) {
    const interval = effect.interval > 0 ? `每 ${effect.interval} 秒` : ''
    const element = ({ fire: '火属性', water: '水属性', wind: '风属性', earth: '地属性' })[effect.elementType] || ''
    const amount = effect.damageMultiplier ? `${Math.round(effect.damageMultiplier * 1000) / 10}%${element}${formatDamageType(effect.damageType)}` : `基础伤害 ${effect.damageBase}`
    details.push(`${interval}造成 ${amount}`.trim())
  } else if (effect.description) {
    details.push(effect.description)
  }
  if (effect.duration > 0) details.push(`持续 ${effect.duration} 秒`)
  if (effect.radius > 0) details.push(`半径 ${effect.radius}`)
  return details.join(' · ')
}
const formatDamageType = type => ({ magicAtk: '魔法伤害', phyAtk: '物理伤害', realAtk: '真实伤害', cure: '治疗' }[type] || '伤害')
const formatRangeLabel = key => ({ rectRange: '矩形范围', radius: '半径', raduis: '半径', range: '范围', checkRange: '判定范围', hit1CheckRange: '第一段范围', hit2CheckRange: '第二段范围', sectorAngle: '扇形角度', moveDis: '位移距离', moveGridRange: '随机位移', atkLenth: '攻击长度', atkWidth: '攻击宽度' }[key] || '范围')
</script>

<style scoped>
.id-line { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.copy-tag { cursor: pointer; user-select: none; }
.portrait-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 16px; padding: 18px 14px; }
.portrait-box { position: relative; display: grid; width: min(100%, 300px); min-height: 210px; place-items: center; padding: 14px; border: 1px dashed var(--border-color); border-radius: 6px; background: rgba(43, 31, 21, 0.08); box-shadow: inset 0 2px 8px rgba(43, 31, 21, 0.2); }
.portrait-relation { position: absolute; top: 8px; left: 8px; z-index: 1; }
.portrait-img { max-width: 100%; max-height: 190px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35)); }
.monster-desc { box-sizing: border-box; width: 100%; margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--border-faint); border-radius: 4px; background: rgba(43, 31, 21, 0.07); color: var(--text-main); font-size: 14px; line-height: 1.75; text-align: justify; text-indent: 2em; }
.forms-tabs { margin-bottom: 14px; }
.variant-context { display: grid; margin: -2px 0 14px; overflow: hidden; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(233, 220, 195, 0.66); box-shadow: inset 0 1px rgba(255, 255, 255, 0.28); }
.variant-context--transform { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.variant-context--tower { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.variant-context--tower .variant-context__item:nth-child(odd) { border-left: 0; }
.variant-context--tower .variant-context__item:nth-child(n + 3) { border-top: 1px solid var(--border-faint); }
.variant-context__item { display: flex; min-width: 0; min-height: 58px; align-items: flex-start; justify-content: center; flex-direction: column; gap: 4px; padding: 9px 12px; border-left: 1px solid var(--border-faint); }
.variant-context__item:first-child { border-left: 0; }
.variant-context__item span { color: var(--text-muted); font-size: 11px; font-weight: 700; }
.variant-context__item strong { overflow-wrap: anywhere; color: var(--text-main); font-size: 13px; line-height: 1.45; }
.variant-context__item small { color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.variant-context__item--current { background: var(--hover-bg); }
.variant-context__item--current strong { color: var(--accent-ink); }
.form-content { display: flex; flex-direction: column; gap: 2px; padding-bottom: 20px; }
.level-slider { margin-bottom: 12px; padding: 12px 14px; }
.level-slider__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 9px; color: var(--text-main); font-size: 13px; font-weight: 700; }
.level-slider__header strong { color: var(--accent-ink); }
.level-slider__input { width: 100%; height: 6px; margin: 0; cursor: pointer; accent-color: var(--accent-bright); }
.fixed-stat-grid { margin-top: 8px; }
.tags-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 12px; }
.tags-row--left { justify-content: flex-start; }
.text-desc { margin: 0; color: var(--text-main); font-size: 14px; line-height: 1.7; }
.mechanic-list { display: grid; gap: 10px; }
.mechanic-card { padding: 12px 14px; border: 1px solid var(--border-faint); border-radius: 5px; background: rgba(233, 220, 195, 0.44); }
.mechanic-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mechanic-title { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--text-main); font-size: 14px; }
.mechanic-title strong { word-break: break-word; }
.mechanic-meta { flex-shrink: 0; color: var(--accent-ink); font-size: 12px; font-weight: 700; }
.mechanic-desc, .mechanic-summary { margin: 8px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.65; }
.mechanic-summary { color: var(--text-main); }
.mechanic-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.linked-effect-list { display: grid; gap: 5px; margin-top: 9px; }
.linked-effect-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 9px; border-left: 3px solid var(--accent-bright); background: rgba(43, 31, 21, 0.06); color: var(--text-muted); font-size: 12px; line-height: 1.55; }
.linked-effect-row strong { flex-shrink: 0; color: var(--text-main); }
.hit-list { display: grid; gap: 5px; margin-top: 9px; }
.hit-row { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 6px 9px; border-left: 3px solid var(--accent-bright); background: rgba(43, 31, 21, 0.06); color: var(--text-muted); font-size: 12px; }
.hit-row span:first-child { color: var(--text-main); font-weight: 700; }
.reward-pool { margin-bottom: 8px; }
.reward-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.error-state { padding: 40px; color: var(--danger); text-align: center; }
@media (max-width: 600px) {
  .variant-context--transform { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .variant-context--transform .variant-context__item:nth-child(3) { border-left: 0; border-top: 1px solid var(--border-faint); }
  .variant-context--transform .variant-context__item:nth-child(4) { border-top: 1px solid var(--border-faint); }
  .mechanic-head { align-items: stretch; flex-direction: column; gap: 6px; }
  .mechanic-meta { align-self: flex-start; }
  .reward-items { grid-template-columns: 1fr; }
  .form-content :deep(.ui-stat-grid) { grid-template-columns: 1fr; }
}
</style>
