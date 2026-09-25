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
          <UiTag :tone="currentForm.monRank === 3 ? 'gold' : 'accent'" class="portrait-relation">{{ currentForm.relationType || currentForm.tabLabel || '本体' }}</UiTag>
          <img :src="portraitUrl" :alt="currentForm.name || monster.name" class="portrait-img" data-image-fallback="custom" @error="handlePortraitError" />
        </div>
        <div class="tags-row">
          <UiTag v-if="currentForm.monRank === 3" tone="gold">首领</UiTag>
          <UiTag v-else-if="currentForm.monRank === 2" tone="accent">精英</UiTag>
          <UiTag v-if="monster.label" tone="wood">{{ monster.label }}</UiTag>
          <UiTag v-for="mark in monster.mark" :key="mark" tone="accent">{{ mark }}</UiTag>
          <UiTag v-for="place in monster.place" :key="place" tone="default">{{ place }}</UiTag>
        </div>
        <div v-if="isIndependentBoss" class="boss-identity-banner">
          <span class="boss-badge">独立首领</span>
          <span>该形态为关卡专属首领【{{ currentForm.name }}】，拥有独立战斗血条与专属机制。</span>
        </div>
        <p v-if="monster.text" class="monster-desc">{{ monster.text }}</p>
        <p v-if="currentForm.specialDes" class="monster-special-desc">特性说明：{{ currentForm.specialDes }}</p>
      </div>

      <div v-if="allForms.length > 1" class="forms-tabs"><UiTabs v-model="currentFormIndex" :options="formTabOptions" /></div>

      <!-- 战斗阶段与变身流转卡 -->
      <div v-if="currentForm.transform" class="phase-transition-card paper-panel-solid">
        <div class="phase-transition-header">
          <span class="phase-title">战斗阶段机制</span>
          <span class="phase-badge" :class="currentForm.transform.currentStage === 'after' ? 'phase-badge--stage2' : 'phase-badge--stage1'">
            当前查看：{{ currentStageBadgeText }}
          </span>
        </div>

        <div class="phase-flow-visual">
          <div class="phase-node" :class="{ active: currentForm.transform.currentStage === 'before' }">
            <span class="node-tag">阶段 1</span>
            <span class="node-name">{{ currentForm.transform.stage1Name || '一阶段' }}</span>
          </div>

          <div class="phase-arrow-connector">
            <div class="phase-arrow-line"></div>
            <div class="phase-condition-bubble" :title="activeConditionText">
              <span class="bubble-icon">{{ activeConditionLabel }}</span>{{ activeConditionText }}
            </div>
            <div class="phase-arrow-head">▶</div>
          </div>

          <div class="phase-node" :class="{ active: currentForm.transform.currentStage === 'after' }">
            <span class="node-tag">阶段 2</span>
            <span class="node-name">{{ currentForm.transform.stage2Name || '二阶段' }}</span>
          </div>
        </div>

        <div class="phase-action-bar">
          <button
            v-if="transformPartnerIndex !== -1"
            type="button"
            class="phase-switch-button"
            @click="currentFormIndex = transformPartnerIndex"
          >
            {{ switchButtonText }}
          </button>
        </div>
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
          <div v-if="currentForm.keyList?.length" class="tags-row tags-row--left"><UiTag v-for="tag in currentForm.keyList" :key="tag" tone="gold">{{ formatKeyTag(tag) }}</UiTag></div>
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
                <UiTag v-if="skill.triggerCondition" tone="danger" class="trigger-condition-tag">
                  条件：{{ skill.triggerCondition }}
                </UiTag>
                <UiTag v-for="range in (skill.ranges || []).filter(item => !['moveGridRange', 'moveDis'].includes(item.key))" :key="`${range.key}-${range.value}`" tone="default">{{ formatRangeLabel(range.key) }} {{ range.value }}</UiTag>
                <UiTag
                  v-for="summon in skill.summons || []"
                  :key="`${summon.monsterId}-${summon.name}`"
                  tone="gold"
                  :class="{ 'clickable-summon-tag': !!findSummonTarget(summon) }"
                  :title="findSummonTarget(summon) ? `点击查看【${summon.name}】详细属性` : ''"
                  @click.stop="handleSummonJump(summon)"
                >
                  {{ formatSummon(summon) }}<span v-if="findSummonTarget(summon)" class="tag-arrow-icon"> ↗</span>
                </UiTag>
                <UiTag v-if="skill.trap" tone="danger">{{ formatTrap(skill.trap) }}</UiTag>
              </div>

              <!-- 召唤物快速跳转入口 -->
              <div v-if="skill.summons?.length" class="summon-jump-bar">
                <span class="summon-jump-hint">召唤单位：</span>
                <button
                  v-for="summon in skill.summons"
                  :key="`${summon.monsterId}-${summon.name}`"
                  type="button"
                  class="summon-jump-chip"
                  :class="{ 'summon-jump-chip--disabled': !findSummonTarget(summon) }"
                  :title="findSummonTarget(summon) ? `点击查看【${summon.name}】的详细属性与机制` : `未录入此召唤物的独立图鉴数据`"
                  @click.stop="handleSummonJump(summon)"
                >
                  <span class="summon-jump-name">{{ summon.name }}</span>
                  <span v-if="findSummonTarget(summon)" class="summon-jump-arrow">➔</span>
                </button>
              </div>

              <!-- 技能附加状态卡片（方案一：精致状态效果卡片） -->
              <div v-if="skill.addBuffs?.length" class="status-effect-list">
                <div
                  v-for="buff in skill.addBuffs"
                  :key="`${buff.id}-status`"
                  class="status-effect-card"
                  :class="`status-effect-card--${getBuffType(buff).type}`"
                >
                  <div class="status-effect-badge-group">
                    <span class="status-badge" :class="`status-badge--${getBuffType(buff).type}`">
                      {{ getBuffType(buff).label }}
                    </span>
                    <strong class="status-name">【{{ buff.name }}】</strong>
                  </div>
                  <div class="status-effect-body">
                    <span class="status-statement" v-html="formatSkillBuffStatement(buff)"></span>
                    <span v-if="getBuffExtraChips(buff).length" class="status-extra-chips">
                      <span v-for="chip in getBuffExtraChips(buff)" :key="`${chip.label}-${chip.value}`" class="status-chip">
                        <span class="status-chip__label">{{ chip.label }}</span>
                        <span class="status-chip__value">{{ chip.value }}</span>
                      </span>
                    </span>
                  </div>
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
              <!-- 状态信息与数值统一走 buffParser.describeBuff（与词条页同一实现），不再逐字段手写标签 -->
              <div class="mechanic-tags">
                <UiTag v-for="row in buffStatusRows(buff)" :key="row.label" tone="default">{{ row.label }} {{ row.value }}</UiTag>
              </div>
              <div v-if="buffValueGroups(buff).length" class="buff-value-groups">
                <div v-for="group in buffValueGroups(buff)" :key="group.title" class="buff-value-group">
                  <span class="buff-value-group__title">{{ group.title }}</span>
                  <span class="buff-value-group__items">
                    <span v-for="row in group.items" :key="`${row.label}-${row.value}`" class="buff-value-chip">
                      <span class="buff-value-chip__label">{{ row.label }}</span>
                      <span class="buff-value-chip__value">{{ row.value }}</span>
                    </span>
                  </span>
                </div>
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
          <template #title-end>
            <button
              v-if="section.entries?.length"
              type="button"
              class="prob-detail-btn prob-detail-btn--section"
              @click.stop="openRewardDetail(section.title, section.entries)"
            >
              概率明细
            </button>
          </template>
          <RewardPools :entries="section.entries" @item-click="handleRewardClick" />
        </UiSection>

      </div>
    </template>
    <UiBackToTop scroll-container="#monsterModalScroll" />
  </UiModal>
</template>

<script setup>
import { computed, onBeforeUnmount, onErrorCaptured, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiBackToTop, UiButton, UiEmptyState, UiModal, UiSection, UiStatGrid, UiTabs, UiTag } from './ui/index.js'
import RewardPools from './RewardPools.vue'
import { openRewardDetail } from '../utils/rewardModalState.js'
import { getImageUrl, handleImageFallback } from '../utils/env'
import { fetchMonsterData, fetchMonsterLevelStrength } from '../utils/monsterParser'
import { formatHighlightedText, translateStatName } from '../utils/gameMappings'

defineProps({ visible: Boolean })
const emit = defineEmits(['update:visible'])
const router = useRouter()
const route = useRoute()
const monster = ref(null)
const currentFormIndex = ref(0)
const allMonstersList = ref([])
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
    allMonstersList.value = officialMonsters || []
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

// 怪物原型本身是否就是首领（如角布林头领、“魔爪”图洛德、碎岩统领等）
const isBaseMonsterBoss = computed(() => {
  const base = monster.value
  if (!base) return false
  const firstForm = base.forms?.[0]
  return (firstForm?.monRank || 1) >= 3
    || (base.quality || 1) >= 5
    || base.tags?.includes('boss')
    || base.tags?.includes('首领')
    || (base.name && (base.name.includes('首领') || base.name.includes('头领') || base.name.includes('统领') || base.name.includes('女王') || base.name.includes('育母') || base.name.includes('王')))
})

// 独立首领仅在“本体是小怪/普通怪，但该变种为关底独立首领”时展示（如尸术蕈下的布斯波乌尔）
const isIndependentBoss = computed(() => {
  if (isBaseMonsterBoss.value) return false
  return currentForm.value?.monRank === 3 && currentForm.value?.id !== monster.value?.id && currentForm.value?.name !== monster.value?.name
})

// 变身伙伴形态索引（一阶段与二阶段双向联动）
const transformPartnerIndex = computed(() => {
  if (!currentForm.value?.transform) return -1
  const t = currentForm.value.transform
  const targetId = t.currentStage === 'before' ? t.toId : t.fromId
  return allForms.value.findIndex(f => f.id === targetId)
})

const currentStageBadgeText = computed(() => {
  const t = currentForm.value?.transform
  if (!t) return ''
  if (t.currentStage === 'after') {
    return t.stage2Name || '二阶段'
  }
  return t.stage1Name || '一阶段'
})

const activeConditionLabel = computed(() => {
  const t = currentForm.value?.transform
  if (t?.currentStage === 'after' && t?.reverseCondition) {
    return '回网：'
  }
  return '条件：'
})

const activeConditionText = computed(() => {
  const t = currentForm.value?.transform
  if (!t) return ''
  if (t.currentStage === 'after' && t.reverseCondition) {
    return t.reverseCondition
  }
  return t.condition || ''
})

const switchButtonText = computed(() => {
  const t = currentForm.value?.transform
  if (!t) return ''
  if (t.currentStage === 'before') {
    return t.stage2Name ? `查看【${t.stage2Name}】➔` : '查看二阶段技能与属性 ➔'
  }
  return t.stage1Name ? `🠔 返回【${t.stage1Name}】` : '🠔 返回一阶段'
})

const towerAppearances = computed(() => currentForm.value?.towerAppearances?.length
  ? currentForm.value.towerAppearances
  : (currentForm.value?.towerBossAppearances || []))

const formTabOptions = computed(() => {
  const baseName = monster.value?.name || ''

  // 1. 预计算每个形态的基础前缀/名字（去除重复怪物名后缀）
  const baseLabels = allForms.value.map(form => {
    let label = form.tabLabel || form.name || ''
    if (baseName && label.endsWith(` · ${baseName}`)) {
      const prefix = label.slice(0, -(` · ${baseName}`.length)).trim()
      if (prefix === '剧情' || prefix === '副本') {
        return `${prefix}版本`
      }
      return prefix
    }
    if (label === baseName || form.relationType === '本体') {
      return '本体'
    }
    return label
  })

  // 2. 映射阶段与特殊修饰（二阶段保持与对应一阶段的前缀一致）
  return allForms.value.map((form, index) => {
    let label = baseLabels[index]

    if (form.transform) {
      if (form.transform.currentStage === 'after') {
        if (form.transform.stage2Tab && form.transform.fromId === monster.value?.id) {
          label = form.transform.stage2Tab
        } else {
          const sourceIndex = allForms.value.findIndex(f => f.id === form.transform.fromId)
          const sourcePrefix = sourceIndex >= 0 ? baseLabels[sourceIndex] : label
          if (sourcePrefix === '本体') {
            label = '二阶段'
          } else {
            label = `${sourcePrefix} (二阶段)`
          }
        }
      } else if (form.transform.currentStage === 'before') {
        if (label === '本体') {
          label = form.transform.stage1Tab || '一阶段'
        } else {
          label = `${label} (一阶段)`
        }
      }
    }

    // 只有当怪物的本体不是首领（小怪/普通怪），而该变种是独立大 Boss 时，才在 Tab 上标 [首领]
    if (!isBaseMonsterBoss.value && form.id !== monster.value?.id) {
      const isFormBoss = form.monRank >= 3 || form.relationType?.includes('首领')
      if (isFormBoss && !label.includes('首领')) {
        label = `[首领] ${label}`
      }
    }

    return { value: index, label }
  })
})

// 召唤物导航与联动跳转
const findSummonTarget = (summon) => {
  if (!summon) return null
  const targetId = String(summon.monsterId || '').trim()
  const targetName = String(summon.name || '').trim()

  // 1. 优先在当前怪物的所有形态（forms + summons）中寻找
  if (allForms.value?.length) {
    const localIdx = allForms.value.findIndex(f =>
      (targetId && f.id === targetId) || (targetName && f.name === targetName)
    )
    if (localIdx >= 0) {
      return { type: 'local', index: localIdx, form: allForms.value[localIdx] }
    }
  }

  // 2. 在全局怪物列表中寻找对应怪物
  if (allMonstersList.value?.length) {
    for (const m of allMonstersList.value) {
      const forms = [...(m.forms || []), ...(m.summons || [])]
      const form = forms.find(f => (targetId && f.id === targetId) || (targetName && f.name === targetName))
      if (form) {
        return { type: 'global', monsterId: m.id, formId: form.id }
      }
    }
  }
  return null
}

const handleSummonJump = (summon) => {
  const target = findSummonTarget(summon)
  if (!target) return
  if (target.type === 'local') {
    currentFormIndex.value = target.index
  } else if (target.type === 'global') {
    router.push({ query: { ...route.query, id: target.formId } })
  }
}

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

const rewardGroupsToEntries = (groups = []) => {
  const entries = []
  groups.forEach((group, groupIndex) => {
    const groupRate = Number(group.rate ?? 1)
    const groupCount = Number(group.num ?? group.min ?? group.max ?? 1)
    for (const rule of (group.rules || [])) {
      entries.push({
        typeId: rule.targetId || rule.typeId,
        name: rule.targetName || rule.typeId || rule.mode,
        icon: rule.targetImg || '',
        quality: Number(rule.targetQuality || 1),
        actualProb: Number(rule.actualProb ?? rule.prob ?? 1),
        min: Number(rule.min ?? group.min ?? 1),
        max: Number(rule.max ?? group.max ?? rule.min ?? 1),
        kind: rule.mode === 'equip' ? 'equip' : 'item',
        ruleMode: rule.mode || 'item',
        detail: rule.detail || '',
        groupIndex,
        groupRate,
        groupCount
      })
    }
  })
  return entries
}

const buffSectionTitle = computed(() => currentForm.value?.buffs?.length > 1 ? '随机携带效果' : '固有效果')
const configuredRewardSections = computed(() => {
  const sections = []
  if (monster.value?.baseRewards?.length) {
    sections.push({
      title: '图鉴战利品',
      entries: rewardGroupsToEntries(monster.value.baseRewards)
    })
  }
  if (currentForm.value?.collectRewards?.length && JSON.stringify(currentForm.value.collectRewards) !== JSON.stringify(monster.value?.baseRewards || [])) {
    sections.push({
      title: '怪物配置奖励',
      entries: rewardGroupsToEntries(currentForm.value.collectRewards)
    })
  }
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
const handleRewardClick = (typeId) => {
  if (typeId && typeId !== 'equipGroup') {
    router.push({ query: { ...route.query, itemId: typeId } })
  }
}
const formatPercent = value => { const percent = Number(value || 0) * 100; return `${percent.toFixed(percent % 1 ? 1 : 0)}%` }
const formatTowerFloors = floors => `第 ${(floors || []).join('、')} 层`
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
const getBuffType = (buff) => {
  const name = buff?.name || ''
  const desc = buff?.description || ''
  if (/眩晕|禁锢|嘲讽|混乱|石化|冰冻|定身|沉睡|恐惧/.test(name) || /无法行动|无法动弹|不可移动|强制攻击/.test(desc)) {
    return { type: 'control', label: '控制' }
  }
  if (/弱化|减速|虚弱|易伤|破防/.test(name) || /降低攻速|降低移速/.test(desc)) {
    return { type: 'debuff', label: '负面' }
  }
  if (/提升|庇护|护盾|恢复|增益|减伤|减少/.test(name) || /增加|提升|降低受到的伤害|恢复/.test(desc)) {
    return { type: 'buff', label: '增益' }
  }
  return { type: 'debuff', label: '负面' }
}
const formatSkillBuffStatement = (buff) => {
  const desc = (buff?.description || '').replace(/^进入.+?状态[，,]\s*/, '').replace(/。$/, '')
  const duration = Number(buff?.duration || 0)
  const groups = buff?.values?.groups || []
  const items = groups.flatMap(g => g.items || [])

  const intervalItem = items.find(i => i.label?.includes('间隔') || i.label?.includes('频率'))
  const damageRatioItem = items.find(i => i.label === '伤害倍率' || (i.label?.includes('倍率') && !i.label?.includes('免')))
  const damageBaseItem = items.find(i => i.label === '基础伤害' || i.label === '固定伤害')

  const interval = intervalItem ? intervalItem.value : null
  const damageRatio = damageRatioItem ? damageRatioItem.value : null
  const damageBase = damageBaseItem ? damageBaseItem.value : null

  const parts = []
  if (duration > 0) {
    parts.push(`持续 <strong class="stat-highlight">${duration} 秒</strong>`)
  }

  if ((damageRatio || damageBase) && interval) {
    const dmgText = damageRatio && damageBase
      ? `${damageRatio} + ${damageBase}`
      : (damageRatio || damageBase)
    parts.push(`每 <strong class="stat-highlight">${interval}</strong> 结算一次 <strong class="stat-highlight">${dmgText}</strong> 伤害`)
  } else if (damageRatio || damageBase) {
    const dmgText = damageRatio && damageBase
      ? `${damageRatio} + ${damageBase}`
      : (damageRatio || damageBase)
    parts.push(`造成 <strong class="stat-highlight">${dmgText}</strong> 伤害`)
  }

  const attrItems = items.filter(i => i !== intervalItem && i !== damageRatioItem && i !== damageBaseItem)
  if (attrItems.length > 0) {
    const attrTexts = attrItems.map(i => {
      const val = i.value
      const lbl = i.label
      if (lbl === '受到伤害变化' || lbl === '伤害提升' || lbl?.includes('受到伤害')) {
        const num = parseFloat(val)
        if (num < 0) return `受到的伤害降低 <strong class="stat-highlight">${Math.abs(num)}%</strong>`
        return `受到的伤害增加 <strong class="stat-highlight">${num}%</strong>`
      }
      if (lbl === '攻速加成' || lbl === '移速加成') {
        const num = parseFloat(val)
        const sign = num > 0 ? `+${num}%` : `${num}%`
        return `${lbl.replace('加成', '')} <strong class="stat-highlight">${sign}</strong>`
      }
      return `${lbl} <strong class="stat-highlight">${val}</strong>`
    })
    parts.push(attrTexts.join(' · '))
  }

  const isTautology = /持续收?到(物理)?伤害|每秒受到(魔法)?伤害|受到的?伤害降低|受到的?伤害减少|移动速度提升/.test(desc)

  if (desc && !isTautology && !attrItems.length && !damageRatio && !damageBase) {
    parts.push(desc)
  }

  return parts.join(' · ') || desc || '生效'
}
const getBuffExtraChips = (buff) => {
  const chips = []
  const status = buff?.values?.status || []
  status.forEach(s => {
    if (s.label?.includes('叠') || s.label?.includes('层')) {
      chips.push(s)
    }
  })
  return chips
}
/**
 * 状态信息 / 数值分组统一取 `buffParser.describeBuff` 的产物（`monsterParser` 已写入 `values`）。
 * 与词条页共用同一渲染器，避免怪物详情另维护一份 para 解读。
 */
const buffStatusRows = buff => buff?.values?.status || []
const buffValueGroups = buff => buff?.values?.groups || []
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
const formatKeyTag = tag => (tag === 'boss' ? '首领' : tag)
</script>

<style scoped>
.id-line { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.copy-tag { cursor: pointer; user-select: none; }
.portrait-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 16px; padding: 18px 14px; }
.portrait-box { position: relative; display: grid; width: min(100%, 300px); min-height: 210px; place-items: center; padding: 14px; border: 1px dashed var(--border-color); border-radius: 6px; background: rgba(43, 31, 21, 0.08); box-shadow: inset 0 2px 8px rgba(43, 31, 21, 0.2); }
.portrait-relation { position: absolute; top: 8px; left: 8px; z-index: 1; }
.portrait-img { max-width: 100%; max-height: 190px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35)); }
.monster-desc { box-sizing: border-box; width: 100%; margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--border-faint); border-radius: 4px; background: rgba(43, 31, 21, 0.07); color: var(--text-main); font-size: 14px; line-height: 1.75; text-align: justify; text-indent: 2em; }
.monster-special-desc { box-sizing: border-box; width: 100%; margin: 8px 0 0; padding: 6px 12px; border-left: 3px solid var(--accent-bright); border-radius: 2px; background: rgba(43, 31, 21, 0.05); color: var(--accent-ink); font-size: 13px; line-height: 1.6; }
.boss-identity-banner { display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; margin: 10px 0 0; padding: 7px 12px; border-left: 3px solid #d49e35; border-radius: 2px; background: rgba(212, 158, 53, 0.12); color: var(--text-main); font-size: 13px; line-height: 1.5; }
.boss-badge { display: inline-block; padding: 1px 6px; border-radius: 2px; background: #9c6e1e; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; }
.phase-transition-card { margin: -2px 0 14px; padding: 12px 14px; border-radius: 4px; }
.phase-transition-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color); }
.phase-title { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-main); }
.phase-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 3px; }
.phase-badge--stage1 { background: rgba(43, 31, 21, 0.08); color: var(--text-muted); border: 1px solid var(--border-faint); }
.phase-badge--stage2 { background: rgba(212, 158, 53, 0.15); color: #9c6e1e; border: 1px solid rgba(212, 158, 53, 0.35); }
.phase-flow-visual { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; padding: 8px 12px; background: rgba(43, 31, 21, 0.04); border-radius: 4px; }
.phase-node { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 12px; border-radius: 4px; background: rgba(255, 255, 255, 0.3); border: 1px solid var(--border-faint); min-width: 90px; transition: all 0.2s ease; }
.phase-node.active { background: rgba(212, 158, 53, 0.18); border-color: #d49e35; box-shadow: 0 0 8px rgba(212, 158, 53, 0.25); }
.node-tag { font-size: 10px; font-weight: 700; color: var(--text-muted); }
.phase-node.active .node-tag { color: #9c6e1e; }
.node-name { font-size: 13px; font-weight: 700; color: var(--text-main); white-space: nowrap; }
.phase-arrow-connector { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-width: 90px; }
.phase-arrow-line { position: absolute; left: 0; right: 0; height: 2px; background: var(--border-color); z-index: 0; }
.phase-condition-bubble { position: relative; z-index: 1; max-width: 90%; padding: 2px 10px; border-radius: 12px; background: #fbf7ee; border: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: var(--accent-ink); text-align: center; box-shadow: 0 1px 3px rgba(43, 31, 21, 0.1); }
.phase-condition-bubble .bubble-icon { color: var(--text-muted); font-weight: normal; }
.phase-arrow-head { position: absolute; right: -6px; color: var(--border-color); font-size: 10px; z-index: 1; }
.phase-action-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; font-size: 12px; color: var(--text-muted); }
.phase-switch-button { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border: 1px solid #d49e35; border-radius: 4px; background: rgba(212, 158, 53, 0.15); color: #7c4f0b; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; white-space: nowrap; }
.phase-switch-button:hover { background: #d49e35; color: #fff; }
.forms-tabs { margin-bottom: 14px; }
.variant-context { display: grid; margin: -2px 0 14px; overflow: hidden; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(233, 220, 195, 0.66); box-shadow: inset 0 1px rgba(255, 255, 255, 0.28); }
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
/* 数值说明：分组标题 + 数值胶囊，数据来自 buffParser.describeBuff */
.buff-value-groups { display: grid; gap: 6px; margin-top: 9px; }
.buff-value-group { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.buff-value-group__title { flex-shrink: 0; min-width: 56px; color: var(--text-muted); font-size: 12px; font-weight: 700; }
.buff-value-group__items { display: flex; flex-wrap: wrap; gap: 5px; }
.buff-value-chip { display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 7px; border: 1px solid var(--border-faint); border-radius: 3px; background: var(--paper-soft); font-size: 12px; line-height: 1.5; }
.buff-value-chip__label { color: var(--text-muted); }
.buff-value-chip__value { font-weight: 700; color: var(--accent-ink); }
.linked-effect-list { display: grid; gap: 5px; margin-top: 9px; }
.linked-effect-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 9px; border-left: 3px solid var(--accent-bright); background: rgba(43, 31, 21, 0.06); color: var(--text-muted); font-size: 12px; line-height: 1.55; }
.linked-effect-row strong { flex-shrink: 0; color: var(--text-main); }
/* 技能附加状态卡片（方案一：精致状态效果卡片） */
.status-effect-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.status-effect-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12.5px;
  line-height: 1.5;
  box-sizing: border-box;
  transition: all 0.15s ease;
}
.status-effect-card--debuff {
  background: rgba(180, 52, 40, 0.07);
  border: 1px solid rgba(180, 52, 40, 0.22);
}
.status-effect-card--control {
  background: rgba(118, 56, 175, 0.07);
  border: 1px solid rgba(118, 56, 175, 0.22);
}
.status-effect-card--buff {
  background: rgba(38, 125, 82, 0.07);
  border: 1px solid rgba(38, 125, 82, 0.22);
}
.status-effect-badge-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}
.status-badge--debuff {
  background: #b5382b;
  color: #fff;
}
.status-badge--control {
  background: #6e3fb0;
  color: #fff;
}
.status-badge--buff {
  background: #2a8356;
  color: #fff;
}
.status-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.status-effect-card--debuff .status-name {
  color: #8c261b;
}
.status-effect-card--control .status-name {
  color: #552796;
}
.status-effect-card--buff .status-name {
  color: #1a633e;
}
.status-effect-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  flex: 1;
}
.status-statement {
  color: var(--text-main);
  font-size: 12.5px;
}
.status-statement :deep(.stat-highlight) {
  color: var(--accent-ink);
  font-weight: 700;
}
.status-extra-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}
.status-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 1px 6px;
  border: 1px solid var(--border-faint);
  border-radius: 3px;
  background: var(--paper-soft);
  font-size: 11px;
  line-height: 1.4;
}
.status-chip__label {
  color: var(--text-muted);
}
.status-chip__value {
  font-weight: 700;
  color: var(--accent-ink);
}
.hit-list { display: grid; gap: 5px; margin-top: 9px; }
.hit-row { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 6px 9px; border-left: 3px solid var(--accent-bright); background: rgba(43, 31, 21, 0.06); color: var(--text-muted); font-size: 12px; }
.hit-row span:first-child { color: var(--text-main); font-weight: 700; }
.summon-jump-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding: 6px 10px; border-radius: 4px; background: rgba(212, 158, 53, 0.1); border: 1px dashed rgba(212, 158, 53, 0.35); }
.summon-jump-hint { font-size: 11px; font-weight: 700; color: #8c5d1a; white-space: nowrap; }
.summon-jump-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid #d49e35; border-radius: 3px; background: #fff8eb; color: #6b4307; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
.summon-jump-chip:hover { background: #d49e35; color: #fff; }
.summon-jump-chip--disabled { opacity: 0.6; cursor: default; border-color: var(--border-color); background: rgba(0, 0, 0, 0.04); color: var(--text-muted); }
.clickable-summon-tag { cursor: pointer; transition: opacity 0.15s; }
.clickable-summon-tag:hover { filter: brightness(0.95); text-decoration: underline; }
.tag-arrow-icon { font-size: 10px; margin-left: 2px; opacity: 0.8; }
.trigger-condition-tag { font-weight: 700; border: 1px solid rgba(160, 48, 48, 0.35); box-shadow: 0 1px 2px rgba(160, 48, 48, 0.12); }
.error-state { padding: 40px; color: var(--danger); text-align: center; }
@media (max-width: 600px) {
  .variant-context--transform { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .variant-context--transform .variant-context__item:nth-child(3) { border-left: 0; border-top: 1px solid var(--border-faint); }
  .variant-context--transform .variant-context__item:nth-child(4) { border-top: 1px solid var(--border-faint); }
  .mechanic-head { align-items: stretch; flex-direction: column; gap: 6px; }
  .mechanic-meta { align-self: flex-start; }
  .form-content :deep(.ui-stat-grid) { grid-template-columns: 1fr; }
  
  /* 移动端变身流转卡竖向自然排版 */
  .phase-transition-header { flex-direction: column; align-items: flex-start; gap: 6px; }
  .phase-flow-visual { flex-direction: column; align-items: stretch; gap: 8px; padding: 10px; }
  .phase-node { width: 100%; box-sizing: border-box; flex-direction: row; justify-content: space-between; padding: 8px 14px; min-width: unset; }
  .phase-arrow-connector { flex-direction: column; min-width: unset; min-height: auto; width: 100%; padding: 4px 0; }
  .phase-arrow-line, .phase-arrow-head { display: none; }
  .phase-condition-bubble { max-width: 100%; box-sizing: border-box; white-space: normal; font-size: 11px; padding: 4px 10px; line-height: 1.4; }
  .phase-condition-bubble::after { content: ' ▼'; font-size: 10px; color: #9c6e1e; display: inline-block; margin-left: 4px; }
  .phase-action-bar { flex-direction: column; align-items: stretch; gap: 8px; }
  .phase-switch-button { width: 100%; justify-content: center; padding: 8px 12px; font-size: 13px; }
}
</style>
