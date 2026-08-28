<template>
  <UiModal
    :visible="visible"
    :title="currentForm?.name || monster?.name || '怪物详情'"
    max-width="820px"
    scroll-id="monsterModalScroll"
    :z-index="2000"
    @update:visible="handleClose"
  >
    <div v-if="renderError" class="error-state">
      渲染错误: {{ renderError }}
    </div>
    <template v-else>
      <!-- ID 复制标签 -->
      <div v-if="monster" class="id-line">
        <UiTag tone="wood" class="copy-tag" @click="copyId(currentForm?.id)" :title="'点击复制 ID'">
          ID: {{ currentForm?.id }}
        </UiTag>
      </div>

      <!-- 顶部立绘区 -->
      <div class="portrait-section paper-panel corner-nails" v-if="monster">
        <div class="portrait-box">
          <span class="portrait-label">{{ currentForm?.tabLabel || '当前形态' }}</span>
          <UiTag v-if="monster.label || currentForm?.category" tone="accent" class="portrait-element">
            {{ monster.label || currentForm?.category }}
          </UiTag>
          <img
            v-show="showPortrait"
            :src="portraitUrl"
            :alt="currentForm?.name || monster.name"
            class="portrait-img"
            @error="handlePortraitError"
            @load="handlePortraitLoad"
          />
        </div>

        <!-- 出没地点标签 -->
        <div class="tags-row" v-if="monster.place?.length > 0">
          <UiTag v-for="p in monster.place" :key="p" tone="default">{{ p }}</UiTag>
        </div>

        <!-- 描述 -->
        <div class="monster-desc" v-if="monster.text">
          {{ monster.text }}
        </div>
      </div>

      <!-- 形态切换页签 -->
      <div class="forms-tabs" v-if="allForms.length > 1">
        <UiTabs v-model="currentFormIndex" :options="formTabOptions" />
      </div>

      <!-- 形态内容 -->
      <div class="form-content" v-if="currentForm">
        <!-- 1. 战斗面板 -->
        <UiSection v-if="currentForm.rawStats" title="战斗面板">
          <!-- 目标等级滑块 -->
          <div class="slider-group paper-panel-solid">
            <div class="slider-header">
              <span class="slider-title">目标等级</span>
              <span class="slider-val">Lv.{{ currentLevel }} / 101</span>
            </div>
            <input
              type="range"
              min="1"
              max="101"
              v-model.number="currentLevel"
              class="calc-range-slider"
            />
          </div>

          <h4 class="attr-subheading">基础属性（随等级成长）</h4>
          <div class="attr-grid">
            <div class="attr-cell" v-for="stat in growableStats" :key="stat.key">
              <span class="attr-k">{{ stat.label }}</span>
              <span class="attr-values-row">
                <span class="attr-val-base">{{ stat.baseVal }}</span>
                <span class="attr-arrow">→</span>
                <span class="attr-val-calc">{{ stat.calcVal }}</span>
              </span>
            </div>
          </div>

          <template v-if="nonGrowableStats.length > 0">
            <h4 class="attr-subheading">其他属性（固定值）</h4>
            <div class="attr-grid">
              <div class="attr-cell" v-for="stat in nonGrowableStats" :key="stat.key">
                <span class="attr-k">{{ stat.label }}</span>
                <span class="attr-v">{{ stat.value }}</span>
              </div>
            </div>
          </template>

          <div class="tags-row" v-if="currentForm.keyList && currentForm.keyList.length > 0">
            <UiTag v-for="k in currentForm.keyList" :key="k" tone="gold">{{ k }}</UiTag>
          </div>
        </UiSection>

        <!-- 2. 弱点属性 -->
        <UiSection v-if="currentForm.weakAttDes" title="弱点属性">
          <p class="text-desc" v-html="formatWeakAtt(currentForm.weakAttDes)"></p>
        </UiSection>

        <!-- 3. 可能携带效果 -->
        <UiSection v-if="currentForm.buffs?.length > 0" title="可能携带效果">
          <div class="skill-list">
            <div class="skill-item" v-for="buff in (currentForm.buffs || [])" :key="buff?.id || Math.random()">
              <div v-if="buff">
                <div class="skill-header">
                  <span class="skill-name">{{ buff.nameAdd }}{{ buff.name }}</span>
                </div>
                <div class="skill-desc">{{ buff.des }}</div>
                <div class="skill-mechanics" v-if="buff.muPower || buff.baseDamage || buff.repelForce || buff.rectRange || (buff.addBuffs && buff.addBuffs.length > 0)">
                  <UiTag v-if="buff.muPower" tone="danger">倍率{{ buff.damageType ? '(' + formatDamageType(buff.damageType) + ')' : '' }}: {{ Math.round(buff.muPower * 100) }}%</UiTag>
                  <UiTag v-if="buff.baseDamage" tone="danger">基础伤害: {{ buff.baseDamage }}</UiTag>
                  <UiTag v-if="buff.repelForce" tone="gold">隐藏击退: {{ buff.repelForce }}</UiTag>
                  <UiTag v-if="buff.rectRange" tone="gold">判定范围: {{ buff.rectRange }}</UiTag>
                  <UiTag v-if="buff.addBuffs && buff.addBuffs.length > 0" tone="danger">附加状态: {{ buff.addBuffs.join(', ') }}</UiTag>
                </div>
              </div>
            </div>
          </div>
        </UiSection>

        <!-- 4. 技能组 -->
        <UiSection v-if="currentForm.skills?.length > 0" title="技能组">
          <div class="skill-list">
            <div class="skill-item" v-for="skill in (currentForm.skills || [])" :key="skill?.id || Math.random()">
              <div v-if="skill">
                <div class="skill-header">
                  <span class="skill-name">{{ skill.name }}</span>
                  <span class="skill-cost" v-if="skill.cost > 0">消耗: {{ skill.cost }}</span>
                </div>
                <div class="skill-desc">{{ skill.des }}</div>
                <div class="skill-mechanics" v-if="(skill.muPowers && skill.muPowers.length > 0) || skill.baseDamage || skill.repelForce || skill.repelTime">
                  <UiTag v-if="skill.muPowers && skill.muPowers.length > 0" tone="danger">倍率: {{ skill.muPowers.map(m => (m.type ? formatDamageType(m.type) : '') + Math.round(m.val * 100) + '%').join(' / ') }}</UiTag>
                  <UiTag v-if="skill.baseDamage" tone="danger">基础伤害: {{ skill.baseDamage }}</UiTag>
                  <UiTag v-if="skill.repelForce" tone="gold">击退力: {{ skill.repelForce }}</UiTag>
                  <UiTag v-if="skill.repelTime" tone="gold">硬直时长: {{ skill.repelTime }}s</UiTag>
                </div>
              </div>
            </div>
          </div>
        </UiSection>

        <!-- 5. 战利品掉落 -->
        <UiSection v-if="activeRewards?.length > 0" title="战利品掉落">
          <div v-for="(group, gIdx) in activeRewards" :key="gIdx" class="reward-pool paper-panel-solid">
            <div class="reward-items">
              <UiRewardCard
                v-for="(r, rIdx) in (group.rules || [])"
                :key="rIdx"
                :rule="r ? { ...r, targetImg: getImageUrl(r.targetImg), min: group.min, max: group.max } : {}"
                :clickable="!!(r && (r.mode === 'item' || r.mode === 'equipGroup') && r.targetId)"
                @click="r && handleRewardClick(r)"
              />
            </div>
          </div>
        </UiSection>
      </div>
    </template>
    <UiBackToTop scroll-container="#monsterModalScroll" />
  </UiModal>
</template>

<script setup>
import { ref, computed, watch, onErrorCaptured, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UiModal, UiSection, UiTag, UiTabs, UiRewardCard, UiBackToTop } from './ui/index.js'
import { getImageUrl } from '../utils/env'
import { fetchMonsterData, fetchMonsterLevelStrength, fetchFullMonsterHandbook } from '../utils/monsterParser'
import { translateStatName } from '../utils/gameMappings'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

const router = useRouter()
const route = useRoute()

const monster = ref(null)
const currentFormIndex = ref(0)
const renderError = ref(null)

const levelStrengthMap = ref({})
const currentLevel = ref(1)
const portraitUrl = ref('')
const showPortrait = ref(true)

onMounted(async () => {
  try {
    levelStrengthMap.value = await fetchMonsterLevelStrength()
  } catch (err) {
    console.error('Failed to load monster level strength:', err)
  }
})

onErrorCaptured((err) => {
  renderError.value = err.message || String(err)
  console.error('MonsterDetailModal render error:', err)
  return false
})

watch(() => route.query.id, async (newId) => {
  if (newId && route.path.includes('monsters')) {
    const [mons, fullMons] = await Promise.all([
      fetchMonsterData(),
      fetchFullMonsterHandbook()
    ])
    
    let foundMonster = null
    let foundFormIndex = 0
    
    const searchMonster = (m) => {
      const forms = m.forms || []
      const summons = m.summons || []
      const allF = [...forms, ...summons]
      const idx = allF.findIndex(f => f.id === newId)
      if (idx !== -1) {
        foundMonster = m
        foundFormIndex = idx
        return true
      }
      return false
    }

    const isFound = mons.some(searchMonster) || fullMons.some(searchMonster)
    if (isFound && foundMonster) {
      monster.value = foundMonster
      currentFormIndex.value = foundFormIndex
      emit('update:visible', true)
    }
  }
}, { immediate: true })

const handleClose = () => {
  emit('update:visible', false)
  if (route.query.id) {
    const newQuery = { ...route.query }
    delete newQuery.id
    router.replace({ query: newQuery })
  }
}

const allForms = computed(() => {
  if (!monster.value) return []
  const forms = monster.value.forms || []
  const summons = monster.value.summons || []
  return [...forms, ...summons]
})

const formTabOptions = computed(() =>
  allForms.value.map((f, idx) => ({ value: idx, label: f.tabLabel || f.name || '形态' + (idx + 1) }))
)

const currentForm = computed(() => {
  if (!allForms.value.length) return null
  return allForms.value[currentFormIndex.value]
})

// 形态页签切换时同步 URL（与 selectForm 行为一致）
watch(currentFormIndex, (idx) => {
  const form = allForms.value[idx]
  if (form) {
    router.replace({ query: { ...route.query, id: form.id } })
  }
})

watch(currentForm, (newForm) => {
  if (newForm) {
    currentLevel.value = newForm.level || 1
    showPortrait.value = true
    portraitUrl.value = getImageUrl(`/images/MonstersView/${newForm.portraitName || 'colect_mon_' + newForm.id}.png`)
  }
}, { immediate: true })

const handlePortraitLoad = () => {
  showPortrait.value = true
}

const handlePortraitError = (e) => {
  const currentSrc = e.target.src
  const cleanBaseId = monster.value?.id ? String(monster.value.id).replace('hero_', '') : ''
  const variantId = currentForm.value?.id || ''

  // 1. If MonstersView/colect_mon_... fails, try PicHandBookPanel/colect_mon_...
  if (currentSrc.includes('/images/MonstersView/')) {
    e.target.src = currentSrc.replace('/images/MonstersView/', '/images/PicHandBookPanel/')
    return
  }

  // 2. Try spelling variant (colect_mon_xxx -> colectr_mon_xxx) in both dirs
  if (currentSrc.includes('colect_mon_')) {
    e.target.src = currentSrc.replace('colect_mon_', 'colectr_mon_')
    return
  }
  if (currentSrc.includes('/images/MonstersView/') && currentSrc.includes('colectr_mon_')) {
    e.target.src = currentSrc.replace('/images/MonstersView/', '/images/PicHandBookPanel/')
    return
  }

  // 3. If variant's colect_mon/colectr_mon failed in both dirs, try base monster's colect_mon
  if ((currentSrc.includes('colect_') || currentSrc.includes('colectr_')) && variantId && variantId !== cleanBaseId && cleanBaseId) {
    portraitUrl.value = getImageUrl(`/images/MonstersView/colect_mon_${cleanBaseId}.png`)
    return
  }

  // 4. If base colect_mon failed, try form's raw icon
  const rawIcon = currentForm.value?.icon || monster.value?.icon
  if (rawIcon) {
    portraitUrl.value = getImageUrl(`/images/MonstersView/${rawIcon}.png`)
    return
  }

  // 5. Otherwise hide
  showPortrait.value = false
}

const selectForm = (idx) => {
  currentFormIndex.value = idx
  const form = allForms.value[idx]
  if (form) {
    router.replace({ query: { ...route.query, id: form.id } })
  }
}

const copyId = (id) => {
  if (!id) return
  navigator.clipboard.writeText(id).then(() => {
    alert('已复制 ID: ' + id)
  }).catch(err => {
    console.error('Failed to copy ID:', err)
  })
}

const activeRewards = computed(() => {
  if (currentForm.value?.collectRewards?.length > 0) {
    return currentForm.value.collectRewards
  }
  return monster.value?.baseRewards || []
})

const growableStats = computed(() => {
  if (!currentForm.value || !currentForm.value.rawStats) return []
  const raw = currentForm.value.rawStats
  const coef = levelStrengthMap.value[String(currentLevel.value)]?.coefficient || 1.0
  const keys = ['maxHp', 'phyAtk', 'magicAtk', 'phyDef', 'magicDef']
  
  return keys.map(key => {
    const baseVal = raw[key] || 0
    if (baseVal === 0) return null
    return {
      key,
      label: translateStatName(key),
      baseVal,
      calcVal: Math.floor(baseVal * coef)
    }
  }).filter(Boolean)
})

const nonGrowableStats = computed(() => {
  if (!currentForm.value || !currentForm.value.rawStats) return []
  const raw = currentForm.value.rawStats
  const keys = [
    'crit', 'critRes', 'critDam', 'atkRange', 'atkFloatMin', 'atkFloatMax',
    'runSpeed', 'repelRes', 'phyAtkPen', 'magicAtkPen', 'rebDam', 'vampire', 'cureAdd'
  ]
  
  return keys.map(key => {
    const val = raw[key] || 0
    if (val === 0) return null
    return {
      key,
      label: translateStatName(key),
      value: val
    }
  }).filter(Boolean)
})

const handleImgError = (e) => {
  e.target.style.display = 'none'
}

const handleRewardClick = (rule) => {
  if ((rule.mode === 'item' || rule.mode === 'equipGroup') && rule.targetId) {
    router.push({ query: { ...route.query, itemId: rule.targetId } })
  }
}

const formatWeakAtt = (text) => {
  if (!text) return ''
  return text.replace(/\{([^}]+)\}/g, '<span class="quality-text-2">$1</span>')
}

const formatDamageType = (type) => {
  const map = {
    'magicAtk': '魔法',
    'phyAtk': '物理',
    'realAtk': '真实',
    'cure': '治疗'
  }
  return map[type] || type || ''
}
</script>

<style scoped>
.id-line {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.copy-tag {
  cursor: pointer;
  user-select: none;
}
.copy-tag:active {
  opacity: 0.6;
}

/* 立绘区 */
.portrait-section {
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}
.portrait-box {
  position: relative;
  width: 100%;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(43, 31, 21, 0.08);
  border-radius: 6px;
  border: 1px dashed var(--border-color, #8f7351);
  padding: 14px 12px;
  box-shadow: inset 0 2px 8px rgba(43, 31, 21, 0.2);
}
.portrait-label {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--wood, #2b1f15);
  color: var(--paper, #dfceb3);
  font-weight: 700;
  z-index: 2;
}
.portrait-element {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
}
.portrait-img {
  max-height: 190px;
  max-width: 100%;
  object-fit: contain;
  margin-top: 12px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}
.monster-desc {
  font-size: 14px;
  color: var(--text-main, #3e2a14);
  line-height: 1.75;
  margin-top: 14px;
  text-align: justify;
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  padding: 12px 14px;
  border-radius: 4px;
  width: 100%;
  box-sizing: border-box;
  text-indent: 2em;
}

/* 形态页签 */
.forms-tabs {
  margin-bottom: 14px;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

/* 滑块 */
.slider-group {
  padding: 12px 14px;
  margin-bottom: 12px;
}
.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.slider-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}
.slider-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink, #557574);
}
.dark-mode .slider-val {
  color: var(--accent-bright, #93b3b2);
}
.calc-range-slider {
  width: 100%;
  cursor: pointer;
  accent-color: var(--accent-bright, #7a9a99);
  height: 6px;
}

/* 属性 */
.attr-subheading {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  margin: 14px 0 8px;
  border-left: 3px solid var(--accent-bright, #7a9a99);
  padding-left: 8px;
}
.attr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.attr-cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 3px;
  font-size: 13px;
  min-width: 0;
}
.attr-k {
  color: var(--text-muted, #6b5134);
  font-weight: 600;
  white-space: nowrap;
}
.attr-v {
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}
.attr-values-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.attr-val-base {
  color: var(--text-faint, #8a6d4d);
  text-decoration: line-through;
  font-size: 12px;
}
.attr-arrow {
  color: var(--text-faint, #8a6d4d);
}
.attr-val-calc {
  color: var(--accent-ink, #557574);
}
.dark-mode .attr-val-calc {
  color: var(--accent-bright, #93b3b2);
}

.text-desc {
  font-size: 14px;
  color: var(--text-main, #3e2a14);
  line-height: 1.7;
  margin: 0;
}

/* 技能 */
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skill-item {
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  padding-bottom: 12px;
}
.skill-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.skill-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}
.skill-cost {
  font-size: 12px;
  color: var(--accent-ink, #557574);
  font-weight: 700;
}
.dark-mode .skill-cost {
  color: var(--accent-bright, #93b3b2);
}
.skill-desc {
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  line-height: 1.65;
}
.skill-mechanics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

/* 掉落 */
.reward-pool {
  padding: 12px;
  margin-bottom: 10px;
}
.reward-pool:last-child {
  margin-bottom: 0;
}
.reward-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.error-state {
  text-align: center;
  padding: 40px;
  color: var(--danger, #8b0000);
}

@media (max-width: 600px) {
  .attr-grid, .reward-items {
    grid-template-columns: 1fr;
  }
}
</style>
