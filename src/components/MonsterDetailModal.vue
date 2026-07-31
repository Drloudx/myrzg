<template>
  <Transition name="fade">
    <div v-if="visible" class="item-modal-overlay" @click.self="handleClose">
      <div class="item-modal-content monster-detail">
        <button class="close-btn" @click="handleClose">✕</button>
        <div v-if="renderError" class="error-state" style="padding:20px; color:red;">
          渲染错误: {{ renderError }}
        </div>
        <template v-else>
        
        <!-- Top Info: Icon, Name, Labels -->
        <div class="modal-header" v-if="monster">
          <div class="icon-wrapper quality-bg-3">
          <img 
            :src="getImageUrl(`/images/PicHandBookPanel/${monster.icon}.png`)" 
            :alt="monster.name"
            class="item-icon"
            @error="handleImgError"
          />
        </div>
          <div class="header-info">
            <h2 class="main-title quality-text-3">{{ currentForm?.name || monster.name }}</h2>
            <div class="tags-row mt-2" v-if="monster.label || monster.place?.length > 0">
              <span v-if="monster.label" class="mini-tag tag-job">{{ monster.label }}</span>
              <span class="mini-tag tag-time" v-for="p in monster.place" :key="p">{{ p }}</span>
            </div>
          </div>
        </div>

        <!-- Scrollable Area -->
        <div class="modal-scroll-area" id="monsterModalScroll" v-if="monster">
          <!-- Description -->
      <div class="detail-section" v-if="monster.text">
        <div class="section-title">图鉴描述</div>
        <div class="section-content text-desc">{{ monster.text }}</div>
      </div>

      <!-- Weakness -->
      <div class="detail-section mt-3" v-if="currentForm?.weakAttDes">
        <div class="section-title">弱点属性</div>
        <div class="section-content text-desc">
          <span v-html="formatWeakAtt(currentForm.weakAttDes)"></span>
        </div>
      </div>

      <!-- Forms Tabs -->
      <div class="detail-section" v-if="allForms.length > 1">
        <div class="tabs-container">
          <button 
            v-for="(form, idx) in allForms" 
            :key="idx"
            class="tab-btn"
            :class="{ active: currentFormIndex === idx }"
            @click="selectForm(idx)"
          >
            {{ form.name || '形态' + (idx + 1) }}
          </button>
        </div>
      </div>

      <!-- Form Content -->
      <div class="form-content" v-if="currentForm">
        
        <!-- Base Stats -->
        <div class="detail-section" v-if="currentForm.stats?.length > 0">
          <div class="section-title">战斗面板</div>
          <div class="attr-grid">
            <div class="attr-cell" v-for="stat in (currentForm.stats || [])" :key="stat?.key || Math.random()">
              <span class="attr-k" v-if="stat">{{ stat.label }}</span>
              <span class="attr-v" v-if="stat">{{ stat.value }}</span>
            </div>
          </div>
          <div class="tags-row mt-2" v-if="currentForm.keyList && currentForm.keyList.length > 0">
            <span class="mini-tag bg-gray" v-for="k in currentForm.keyList" :key="k">{{ k }}</span>
          </div>
        </div>

        <!-- Buffs / Elite Affixes -->
        <div class="detail-section" v-if="currentForm.buffs?.length > 0">
          <div class="section-title">可能携带效果</div>
          <div class="skill-list">
            <div class="skill-item" v-for="buff in (currentForm.buffs || [])" :key="buff?.id || Math.random()">
              <div v-if="buff">
                <div class="skill-header">
                  <span class="skill-name">{{ buff.nameAdd }}{{ buff.name }}</span>
                  <!-- 权重暂时隐藏: <span class="skill-cost" v-if="buff.weight">权重: {{ buff.weight }}</span> -->
                </div>
                <div class="skill-desc">{{ buff.des }}</div>
                <div class="skill-mechanics" v-if="buff.muPower || buff.baseDamage || buff.repelForce || buff.rectRange || (buff.addBuffs && buff.addBuffs.length > 0)">
                  <span v-if="buff.muPower" class="mech-tag dmg">倍率{{ buff.damageType ? '(' + formatDamageType(buff.damageType) + ')' : '' }}: {{ Math.round(buff.muPower * 100) }}%</span>
                  <span v-if="buff.baseDamage" class="mech-tag dmg">基础伤害: {{ buff.baseDamage }}</span>
                  <span v-if="buff.repelForce" class="mech-tag cc">隐藏击退: {{ buff.repelForce }}</span>
                  <span v-if="buff.rectRange" class="mech-tag cc">判定范围: {{ buff.rectRange }}</span>
                  <span v-if="buff.addBuffs && buff.addBuffs.length > 0" class="mech-tag dmg">附加状态: {{ buff.addBuffs.join(', ') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div class="detail-section" v-if="currentForm.skills?.length > 0">
          <div class="section-title">技能组</div>
          <div class="skill-list">
            <div class="skill-item" v-for="skill in (currentForm.skills || [])" :key="skill?.id || Math.random()">
              <div v-if="skill">
                <div class="skill-header">
                  <span class="skill-name">{{ skill.name }}</span>
                  <span class="skill-cost" v-if="skill.cost > 0">消耗: {{ skill.cost }}</span>
                </div>
                <div class="skill-desc">{{ skill.des }}</div>
                <div class="skill-mechanics" v-if="(skill.muPowers && skill.muPowers.length > 0) || skill.baseDamage || skill.repelForce || skill.repelTime">
                  <span v-if="skill.muPowers && skill.muPowers.length > 0" class="mech-tag dmg">倍率: {{ skill.muPowers.map(m => (m.type ? formatDamageType(m.type) : '') + Math.round(m.val * 100) + '%').join(' / ') }}</span>
                  <span v-if="skill.baseDamage" class="mech-tag dmg">基础伤害: {{ skill.baseDamage }}</span>
                  <span v-if="skill.repelForce" class="mech-tag cc">击退力: {{ skill.repelForce }}</span>
                  <span v-if="skill.repelTime" class="mech-tag cc">硬直时长: {{ skill.repelTime }}s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Drops / Rewards -->
        <div class="detail-section" v-if="activeRewards?.length > 0">
          <div class="section-title">战利品掉落</div>
          <div class="reward-group">
            <div v-for="(group, gIdx) in activeRewards" :key="gIdx" class="reward-pool">
              <div class="reward-items">
                <div 
                  v-for="(r, rIdx) in (group.rules || [])" 
                  :key="rIdx" 
                  class="reward-item"
                  @click="handleRewardClick(r)"
                  :class="{ clickable: r && (r.mode === 'item' || r.mode === 'equipGroup') && r.targetId }"
                >
                  <div v-if="r" style="display:flex; width:100%;">
                    <img :src="getImageUrl(r.targetImg)" class="r-icon" @error="handleImgError" />
                    <div class="r-info">
                      <span class="r-name" :class="`quality-text-${r.targetQuality}`">{{ r.targetName }}{{ group.min === group.max ? (group.min > 0 ? ' x' + group.min : '') : ' x' + group.min + '-' + group.max }}</span>
                      <span class="r-prob" v-if="r.actualProb">{{ (r.actualProb * 100).toFixed(1) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
        </template>
        <BackToTop scroll-container="#monsterModalScroll" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onErrorCaptured } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import BaseModal from './BaseModal.vue'
import BackToTop from './BackToTop.vue'
import { getImageUrl } from '../utils/env'
import { fetchMonsterData } from '../utils/monsterParser'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

const router = useRouter()
const route = useRoute()

const monster = ref(null)
const currentFormIndex = ref(0)
const title = ref('怪物详情')
const renderError = ref(null)

onErrorCaptured((err) => {
  renderError.value = err.message || String(err)
  console.error('MonsterDetailModal render error:', err)
  return false
})

watch(() => route.query.id, async (newId) => {
  if (newId && route.path.includes('monsters')) {
    const allMons = await fetchMonsterData()
    const found = allMons.find(m => m.id === newId)
    if (found) {
      monster.value = found
      title.value = found.name
      currentFormIndex.value = 0
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

const currentForm = computed(() => {
  if (!allForms.value.length) return null
  return allForms.value[currentFormIndex.value]
})

const selectForm = (idx) => {
  currentFormIndex.value = idx
}

const activeRewards = computed(() => {
  if (currentForm.value?.collectRewards?.length > 0) {
    return currentForm.value.collectRewards
  }
  return monster.value?.baseRewards || []
})

const handleImgError = (e) => {
  e.target.style.display = 'none'
}

const handleRewardClick = (rule) => {
  if ((rule.mode === 'item' || rule.mode === 'equipGroup') && rule.targetId) {
    // Navigate globally to item detail using itemId
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
.item-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-color, #f5f6f8);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0;
  overflow: hidden;
}

.item-modal-content {
  background: var(--bg-color, #f5f6f8);
  width: 100%;
  max-width: none;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-sub, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--primary, #3b82f6);
  background-color: var(--bg-hover, rgba(0,0,0,0.05));
}

.monster-detail {
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 24px;
  display: flex;
  gap: 20px;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}



.icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
  overflow: hidden;
}

.item-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.header-info {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: bold;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.modal-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-color, #fff);
  color: var(--text-color, #333);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.bg-gray { background: var(--border-color); color: var(--text-main); }

.detail-section {
  background: var(--hover-bg);
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-main);
  display: flex;
  align-items: center;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 14px;
  background: var(--primary);
  border-radius: 2px;
  margin-right: 8px;
}

.text-desc {
  font-size: 14px;
  color: var(--text-sub);
  line-height: 1.6;
}

.tabs-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 16px;
  border-radius: 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.attr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

@media (min-width: 480px) {
  .attr-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.attr-cell {
  background: var(--card-bg);
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  border: 1px solid var(--border-color);
}

.attr-k { color: var(--text-sub); }
.attr-v { font-weight: 600; color: var(--text-main); }

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-item {
  background: var(--card-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-name {
  font-weight: 600;
  color: var(--primary);
  font-size: 14px;
}

.skill-cost {
  font-size: 12px;
  color: #f59e0b;
}

.skill-desc {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.5;
}

.skill-mechanics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.mech-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0,0,0,0.05);
}

.mech-tag.dmg { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
.mech-tag.cc { color: #f97316; background: rgba(249, 115, 22, 0.1); }
.mech-tag.aoe { color: #8b5cf6; background: rgba(139, 92, 246, 0.1); }
.mech-tag.debuff { color: #10b981; background: rgba(16, 185, 129, 0.1); }

.reward-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  margin-bottom: 8px;
}

.reward-pool {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.pool-title {
  font-size: 12px;
  color: var(--text-sub);
  margin-bottom: 12px;
  text-align: center;
  background: var(--hover-bg);
  padding: 4px;
  border-radius: 4px;
}

.reward-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--hover-bg);
  padding: 8px;
  border-radius: 6px;
}

.reward-item.clickable {
  cursor: pointer;
  transition: background 0.2s;
}

.reward-item.clickable:hover {
  background: rgba(59, 130, 246, 0.1);
}

.r-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.r-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.r-name {
  font-size: 13px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.r-prob {
  font-size: 12px;
  color: var(--text-sub);
}
</style>
