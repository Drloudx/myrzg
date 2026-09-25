<template>
  <div class="page-view-container glossary-page">
    <!-- 顶层搜索与分类面板 -->
    <UiFilterPanel class="filter-panel paper-panel" :collapsible="hasFilterOptions">
      <template #search>
        <UiSearchInput :model-value="search"
          placeholder="搜索词条名称、机制、属性或施加者（如 中毒、暴击、波特温...）"
          @update:model-value="setFilter('q', $event)" />
      </template>

      <!-- 一级大类 Tab -->
      <UiTabs :model-value="activeSection" :options="sectionTabs" @update:model-value="changeSection" />

      <!-- 二级分类筛选胶囊 -->
      <UiFilterRow v-if="categories.length > 1" label="分类：">
        <UiFilterPill :active="!category" @click="setFilter('category', '')">
          全部（{{ totalCountForSection }}）
        </UiFilterPill>
        <UiFilterPill v-for="item in categories" :key="item.category"
          :active="category === item.category"
          @click="setFilter('category', item.category)">
          {{ item.category }}（{{ item.count }}）
        </UiFilterPill>
      </UiFilterRow>

      <!-- 计数与当前说明 -->
      <div class="collection-counter">
        <span class="count-num">{{ filteredEntries.length }}</span> 条词条
        <span v-if="searchActive" class="counter-hint">· 包含全部板块的搜索匹配结果</span>
        <span v-else-if="currentSectionObj" class="counter-hint">· {{ currentSectionObj.name }}：{{ currentSectionObj.desc }}</span>
      </div>
    </UiFilterPanel>

    <!-- 词条百科主体内容 -->
    <UiEmptyState v-if="loading" type="loading" text="正在加载游戏机制与状态词条..." />
    <div v-else-if="error" class="glossary-error">
      <UiEmptyState type="error" :text="error" />
      <UiButton @click="loadData">重试</UiButton>
    </div>
    <UiCardGrid v-else id="glossaryScroll" class="glossary-content paper-panel" :content-style="{ gridTemplateColumns: 'minmax(0, 1fr)' }">
      <div v-if="filteredEntries.length" class="glossary-grid">
        <article v-for="entry in filteredEntries" :key="entry.id || entry.name"
          class="glossary-card" :class="{ 'is-target': openedId === (entry.id || entry.name) }">
          <button type="button" class="glossary-card__button"
            :aria-label="`查看 ${entry.name} 的百科详情`"
            @click="openEntry(entry)">
            
            <!-- 图标或首字徽章 -->
            <img v-if="entry.icon" class="glossary-card__icon" :src="getImageUrl(entry.icon)" :alt="entry.name"
              loading="lazy" decoding="async" width="38" height="38" @error="handleImageFallback" />
            <span v-else class="glossary-card__icon glossary-card__icon--text" aria-hidden="true">
              {{ entry.name.slice(0, 1) }}
            </span>

            <!-- 卡片主体 -->
            <span class="glossary-card__body">
              <span class="glossary-card__head">
                <span class="glossary-card__name">{{ entry.name }}</span>
                <UiTag tone="accent">{{ entry.category }}</UiTag>
                <UiTag v-if="searchActive" tone="wood">{{ sectionName(entry.group) }}</UiTag>
              </span>

              <!-- 人话摘要 -->
              <p class="glossary-card__summary">{{ entry.summary }}</p>

              <!-- 核心特征提取胶囊 -->
              <div v-if="entry.rules && entry.rules.length" class="glossary-card__chips">
                <span v-for="r in entry.rules.slice(0, 3)" :key="r.label" class="rule-chip">
                  <span class="rule-chip__label">{{ r.label }}：</span>
                  <span class="rule-chip__value">{{ r.value }}</span>
                </span>
              </div>

              <!-- 来源概览提示 -->
              <div v-if="hasSources(entry)" class="glossary-card__source-hint">
                <span class="source-hint-badge">{{ sourceSummaryText(entry) }}</span>
              </div>
            </span>
          </button>
        </article>
      </div>
      <UiEmptyState v-else text="没有找到符合条件的词条，换个关键词试试" />
    </UiCardGrid>
    <UiBackToTop scroll-container="#glossaryScroll" />

    <!-- 词条百科详情弹窗 -->
    <UiModal v-model:visible="detailVisible" :title="currentEntry ? currentEntry.name : '词条百科'"
      max-width="840px" scroll-id="glossaryModalScroll" :z-index="2000">
      <template v-if="currentEntry">
        <!-- 弹窗顶栏 -->
        <div class="detail-header">
          <img v-if="currentEntry.icon" class="detail-header__icon" :src="getImageUrl(currentEntry.icon)"
            :alt="currentEntry.name" width="54" height="54" @error="handleImageFallback" />
          <span v-else class="detail-header__icon detail-header__icon--text" aria-hidden="true">
            {{ currentEntry.name.slice(0, 1) }}
          </span>
          <div class="detail-header__info">
            <div class="detail-header__tags">
              <UiTag tone="accent">{{ currentEntry.category }}</UiTag>
              <UiTag tone="wood">{{ sectionName(currentEntry.group) }}</UiTag>
              <UiTag v-for="tag in currentEntry.tags" :key="tag" tone="default">{{ tag }}</UiTag>
            </div>
            <p class="detail-header__summary">{{ currentEntry.summary }}</p>
          </div>
        </div>

        <!-- 机制与结算规则 -->
        <!-- 机制与结算规则 -->
        <UiSection v-if="currentEntry.rules && currentEntry.rules.length" title="机制与结算规则">
          <div class="rules-table">
            <div v-for="r in currentEntry.rules" :key="r.label" class="rule-row-container">
              <UiInfoRow :label="r.label">
                <div class="rule-value-content">
                  <span class="rule-value-text">{{ r.value }}</span>
                  <!-- 步骤专属可折叠公式图解按钮 -->
                  <button v-if="currentEntry.id === 'mech_damage_flow' && hasStepDiagram(r.label)"
                    type="button" class="rule-toggle-btn"
                    @click="toggleStepDiagram(r.label)">
                    <span class="rule-toggle-icon">{{ isStepExpanded(r.label) ? '▲' : '▼' }}</span>
                    <span>{{ isStepExpanded(r.label) ? '收起公式图解' : '展开公式图解' }}</span>
                  </button>
                </div>
              </UiInfoRow>

              <!-- 第二步：属性与特攻乘区公式图解 -->
              <transition name="formula-fade">
                <div v-if="currentEntry.id === 'mech_damage_flow' && r.label.includes('第二步') && isStepExpanded(r.label)" class="step-inline-diagram">
                  <div class="formula-card">
                    <div class="formula-card__badge">◆ 第二步：属性与特定目标（特攻）加成公式</div>
                    <div class="formula-card__math">
                      <span class="math-term">乘区倍率</span>
                      <span class="math-sym">=</span>
                      <span class="math-num">1</span>
                      <span class="math-sym">+</span>
                      <div class="math-pill math-pill--add">
                        <span class="math-pill__label">伤害类型与属性增伤</span>
                        <span class="math-pill__code">damAddTypes（如物伤、火伤等）</span>
                      </div>
                      <span class="math-sym">+</span>
                      <div class="math-pill math-pill--key">
                        <span class="math-pill__label">特定敌人特攻加成</span>
                        <span class="math-pill__code">damKeyTypes（如对Boss伤害加成）</span>
                      </div>
                      <span class="math-sym">−</span>
                      <div class="math-pill math-pill--res">
                        <span class="math-pill__label">目标对应属性抗性</span>
                        <span class="math-pill__code">damResTypes（如火抗、魔抗等）</span>
                      </div>
                    </div>

                    <div class="formula-card__notes">
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--add"></span>
                        <div class="formula-card__text"><strong>普通属性增伤</strong>：如「物理伤害 +15%」、「火属性伤害 +20%」，不论打何种目标均全量生效。</div>
                      </div>
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--key"></span>
                        <div class="formula-card__text"><strong>特定敌人特攻</strong>：如「对首领(Boss)伤害 +20%」，仅当受击目标携带 <code>boss</code> 等匹配标签时生效。</div>
                      </div>
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--res"></span>
                        <div class="formula-card__text"><strong>目标属性抗性</strong>：如受击方的火属性抗性、风抗或魔抗，直接在该乘区内按比例抵消对应增伤。</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>

              <!-- 第三步：双曲线防御与穿透公式图解 -->
              <transition name="formula-fade">
                <div v-if="currentEntry.id === 'mech_damage_flow' && r.label.includes('第三步') && isStepExpanded(r.label)" class="step-inline-diagram">
                  <div class="formula-card">
                    <div class="formula-card__badge">◆ 第三步：双曲线防御承伤比公式</div>
                    <div class="formula-card__math">
                      <span class="math-term">实际承伤比</span>
                      <span class="math-sym">=</span>
                      <div class="math-fraction">
                        <div class="math-fraction__num">
                          <div class="math-pill math-pill--k">
                            <span class="math-pill__label">等级防御常数 K(L)</span>
                            <span class="math-pill__code">伤害减半基准值</span>
                          </div>
                        </div>
                        <div class="math-fraction__bar"></div>
                        <div class="math-fraction__den">
                          <div class="math-pill math-pill--k">
                            <span class="math-pill__label">K(L)</span>
                            <span class="math-pill__code">基准常数</span>
                          </div>
                          <span class="math-sym">+</span>
                          <div class="math-pill math-pill--def">
                            <span class="math-pill__label">面板防御 × (1 − 穿透率)</span>
                            <span class="math-pill__code">有效防御（穿透削减后）</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="formula-card__notes">
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--k"></span>
                        <div class="formula-card__text"><strong>K(L) 防御常数与 50% 减伤</strong>：随攻击方等级 L 递增（物理 0.6125L² + 45.27L + 352 / 魔法 0.5011L² + 37.04L + 288）。当受击方有效防御等于 K(L) 时，承受伤害正好减半（承伤 50%，减伤 50%）；防御越高减伤越多（例如 2 倍 K 时减伤 66.7%）。</div>
                      </div>
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--def"></span>
                        <div class="formula-card__text"><strong>防御穿透与真实伤害</strong>：穿透率按百分比直接削减有效防御；达到 100% 穿透时有效防御归零，承伤比变为 100%，直接打出无视防御的<strong>真实伤害</strong>。</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>

              <!-- 第四步：暴击结算公式图解 -->
              <transition name="formula-fade">
                <div v-if="currentEntry.id === 'mech_damage_flow' && r.label.includes('第四步') && isStepExpanded(r.label)" class="step-inline-diagram">
                  <div class="formula-card">
                    <div class="formula-card__badge">◆ 第四步：净暴击率与暴伤倍率判定</div>
                    <div class="formula-card__math">
                      <div class="math-pill math-pill--crit">
                        <span class="math-pill__label">净暴击率</span>
                        <span class="math-pill__code">max(0%, 自身暴击率 − 目标暴击抗性) ÷ 100</span>
                      </div>
                      <span class="math-sym">➔</span>
                      <span class="math-term">判定暴击则乘算</span>
                      <div class="math-pill math-pill--crit-dam">
                        <span class="math-pill__label">暴击伤害倍率</span>
                        <span class="math-pill__code">面板暴伤 ÷ 100（默认 1.5 倍）</span>
                      </div>
                    </div>

                    <div class="formula-card__notes">
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--crit"></span>
                        <div class="formula-card__text"><strong>暴击抗性直接扣减</strong>：受击方的暴击抗性直接 1:1 抵消攻击方的暴击率。净暴击率归零时无法触发暴击。</div>
                      </div>
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--crit-dam"></span>
                        <div class="formula-card__text"><strong>真实暴击例外</strong>：若角色具备「真实暴击」（realCirt）特性，则无视概率强制判定暴击并全额享受暴伤加成。</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>

              <!-- 第六步：等级压制惩罚公式图解 -->
              <transition name="formula-fade">
                <div v-if="currentEntry.id === 'mech_damage_flow' && r.label.includes('第六步') && isStepExpanded(r.label)" class="step-inline-diagram">
                  <div class="formula-card">
                    <div class="formula-card__badge">◆ 第六步：等级压制惩罚结算公式</div>
                    <div class="formula-card__math">
                      <span class="math-term">最终伤害系数</span>
                      <span class="math-sym">=</span>
                      <span class="math-num">1</span>
                      <span class="math-sym">−</span>
                      <div class="math-pill math-pill--suppress">
                        <span class="math-pill__label">压制减伤率 y</span>
                        <span class="math-pill__code">min(50%, 0.008 × 等级差^1.5)</span>
                      </div>
                    </div>

                    <div class="formula-card__notes">
                      <div class="formula-card__note">
                        <span class="formula-card__bullet formula-card__bullet--suppress"></span>
                        <div class="formula-card__text"><strong>单向惩罚与 50% 上限</strong>：仅在怪物等级高于自身时触发惩罚；当等级差达到 16 级及以上时锁定最大 50% 减伤，不会无限降低伤害。</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </UiSection>

        <!-- 等级压制伤害全量对照表 -->
        <UiSection v-if="currentEntry.id === 'mech_level_suppression'" title="等级差减免与实际造成伤害对照表（0~16+级）">
          <div class="level-sup-table-wrapper">
            <table class="level-sup-table">
              <thead>
                <tr>
                  <th scope="col">敌我等级差</th>
                  <th scope="col">目标免伤率</th>
                  <th scope="col">实际造成伤害</th>
                  <th scope="col">实际承伤占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in LEVEL_SUPPRESSION_ROWS" :key="item.diff" :class="{ 'level-sup-table__row--max': item.isMax }">
                  <td class="level-sup-table__cell level-sup-table__diff">
                    {{ item.diff }}
                    <span v-if="item.isMax" class="level-sup-table__badge">上限</span>
                  </td>
                  <td class="level-sup-table__cell level-sup-table__red">-{{ item.redRate }}</td>
                  <td class="level-sup-table__cell level-sup-table__dmg">{{ item.dmgRate }}</td>
                  <td class="level-sup-table__cell level-sup-table__bar-cell">
                    <div class="level-sup-table__bar-track" :title="`造成伤害: ${item.dmgRate}`">
                      <div class="level-sup-table__bar-fill" :style="{ width: item.dmgRate }"></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UiSection>

        <!-- 施加来源：角色 -->
        <UiSection v-if="currentEntry.sources?.heroes?.length"
          :title="`施加角色（${currentEntry.sources.heroes.length} 位）`">
          <div class="source-chips">
            <button v-for="hero in currentEntry.sources.heroes" :key="hero.name"
              type="button" class="source-chip source-chip--hero"
              :title="`前往查看角色「${hero.name}」`"
              @click="navigateToHero(hero)">
              <span class="source-chip__name">{{ hero.name }}</span>
              <span v-if="hero.skillName" class="source-chip__skill">「{{ hero.skillName }}」</span>
              <span class="source-chip__arrow">➔</span>
            </button>
          </div>
        </UiSection>

        <!-- 施加来源：怪物与首领 -->
        <UiSection v-if="currentMonsterSources.length"
          :title="`携带 / 施加怪物（${currentMonsterSources.length} 种）`">
          <div class="source-chips">
            <button v-for="mon in currentMonsterSources" :key="mon.id || mon.name"
              type="button" class="source-chip source-chip--mon"
              :title="`前往查看怪物「${mon.name}」`"
              @click="navigateToMonster(mon)">
              <span class="source-chip__name">{{ mon.name }}</span>
              <span v-if="mon.skillName" class="source-chip__skill">「{{ mon.skillName }}」</span>
              <span class="source-chip__arrow">➔</span>
            </button>
          </div>
        </UiSection>

        <!-- 施加来源：魔物 -->
        <UiSection v-if="currentEntry.sources?.pets?.length"
          :title="`魔物伙伴（${currentEntry.sources.pets.length} 种）`">
          <div class="source-chips">
            <button v-for="pet in currentEntry.sources.pets" :key="pet.name"
              type="button" class="source-chip source-chip--pet"
              :title="`前往查看魔物「${pet.name}」`"
              @click="navigateToPet(pet)">
              <span class="source-chip__name">{{ pet.name }}</span>
              <span v-if="pet.skillName" class="source-chip__skill">「{{ pet.skillName }}」</span>
              <span class="source-chip__arrow">➔</span>
            </button>
          </div>
        </UiSection>

        <!-- 关联道具 -->
        <UiSection v-if="currentEntry.sources?.items?.length"
          :title="`关联道具与料理（${currentEntry.sources.items.length} 件）`">
          <div class="source-chips">
            <button v-for="item in currentEntry.sources.items" :key="item.id || item.name"
              type="button" class="source-chip source-chip--item"
              :title="`查看道具「${item.name}」`"
              @click="navigateToItem(item)">
              <span class="source-chip__name">{{ item.name }}</span>
              <span class="source-chip__arrow">➔</span>
            </button>
          </div>
        </UiSection>

        <UiBackToTop scroll-container="#glossaryModalScroll" />
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { facetCountsForGroup, GLOSSARY_SECTIONS } from '../utils/glossaryData.js'
import { resolveScrollTarget } from '../utils/scrollTarget.js'
import {
  UiTabs, UiFilterPanel, UiSearchInput, UiFilterRow, UiFilterPill, UiCardGrid, UiTag,
  UiButton, UiEmptyState, UiBackToTop, UiSection, UiInfoRow, UiModal
} from '../components/ui/index.js'
import { isBlacklisted } from '../config/blacklist.js'

const route = useRoute()
const router = useRouter()

const sectionTabs = [
  { value: 'all', label: '全部' },
  { value: 'status', label: '异常与状态' },
  { value: 'stats', label: '战斗属性' },
  { value: 'mechanics', label: '核心机制' }
]

const LEVEL_SUPPRESSION_ROWS = [
  { diff: '差 0 级（平级/我高于敌）', redRate: '0.00%', dmgRate: '100.00%', isMax: false },
  { diff: '差 1 级', redRate: '0.80%', dmgRate: '99.20%', isMax: false },
  { diff: '差 2 级', redRate: '2.26%', dmgRate: '97.74%', isMax: false },
  { diff: '差 3 级', redRate: '4.16%', dmgRate: '95.84%', isMax: false },
  { diff: '差 4 级', redRate: '6.40%', dmgRate: '93.60%', isMax: false },
  { diff: '差 5 级', redRate: '8.94%', dmgRate: '91.06%', isMax: false },
  { diff: '差 6 级', redRate: '11.76%', dmgRate: '88.24%', isMax: false },
  { diff: '差 7 级', redRate: '14.82%', dmgRate: '85.18%', isMax: false },
  { diff: '差 8 级', redRate: '18.10%', dmgRate: '81.90%', isMax: false },
  { diff: '差 9 级', redRate: '21.60%', dmgRate: '78.40%', isMax: false },
  { diff: '差 10 级', redRate: '25.30%', dmgRate: '74.70%', isMax: false },
  { diff: '差 11 级', redRate: '29.19%', dmgRate: '70.81%', isMax: false },
  { diff: '差 12 级', redRate: '33.26%', dmgRate: '66.74%', isMax: false },
  { diff: '差 13 级', redRate: '37.50%', dmgRate: '62.50%', isMax: false },
  { diff: '差 14 级', redRate: '41.91%', dmgRate: '58.09%', isMax: false },
  { diff: '差 15 级', redRate: '46.48%', dmgRate: '53.52%', isMax: false },
  { diff: '差 16 级及以上', redRate: '50.00%', dmgRate: '50.00%', isMax: true }
]

const expandedStepDiagrams = ref({})

function hasStepDiagram(label) {
  if (!label) return false
  return label.includes('第二步') || label.includes('第三步') || label.includes('第四步') || label.includes('第六步')
}

function isStepExpanded(label) {
  return !!expandedStepDiagrams.value[label]
}

function toggleStepDiagram(label) {
  expandedStepDiagrams.value = {
    ...expandedStepDiagrams.value,
    [label]: !expandedStepDiagrams.value[label]
  }
}

const activeSection = computed(() => {
  const s = route.query.section || route.query.tab || route.query.group
  return sectionTabs.some(t => t.value === s) ? s : 'all'
})

const queryString = key => (typeof route.query[key] === 'string' ? route.query[key] : '')
const search = computed(() => queryString('q'))
const category = computed(() => queryString('category'))

const data = ref(null)
const loading = ref(false)
const error = ref('')

const entries = computed(() => data.value?.entries || data.value?.buffs || [])
const sections = computed(() => data.value?.sections || GLOSSARY_SECTIONS)
const currentSectionObj = computed(() => sections.value.find(s => s.id === activeSection.value) || null)

function sectionName(secId) {
  const found = sections.value.find(s => s.id === secId)
  return found ? found.name : ''
}

const facets = computed(() => facetCountsForGroup(entries.value, activeSection.value))
const categories = computed(() => facets.value.categories)
const totalCountForSection = computed(() => {
  if (activeSection.value === 'all') return entries.value.length
  return entries.value.filter(e => e.group === activeSection.value).length
})

const hasFilterOptions = computed(() => categories.value.length > 1)
const searchActive = computed(() => search.value.trim().length > 0)

// 全局过滤检索
const filteredEntries = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return entries.value.filter(entry => {
    // 非搜索状态下按一级大类过滤
    if (!searchActive.value && activeSection.value !== 'all' && entry.group !== activeSection.value) {
      return false
    }
    // 二级分类过滤
    if (category.value && entry.category !== category.value) {
      return false
    }
    if (!keyword) return true

    // 关键词全文匹配
    const haystack = [
      entry.name,
      entry.category,
      sectionName(entry.group),
      entry.summary,
      ...(entry.tags || []),
      ...(entry.rules || []).flatMap(r => [r.label, r.value]),
      ...(entry.sources?.heroes || []).filter(h => !isBlacklisted(h)).flatMap(h => [h.name, h.skillName]),
      ...(entry.sources?.monsters || []).filter(m => !isBlacklisted(m)).flatMap(m => [m.name, m.skillName]),
      ...(entry.sources?.pets || []).filter(p => !isBlacklisted(p)).flatMap(p => [p.name, p.skillName]),
      ...(entry.sources?.items || []).filter(i => !isBlacklisted(i)).map(i => i.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return haystack.includes(keyword)
  })
})

// 来源摘要显示
function hasSources(entry) {
  const s = entry.sources
  if (!s) return false
  const heroesCount = (s.heroes || []).filter(h => !isBlacklisted(h)).length
  const monstersCount = (s.monsters || []).filter(m => !isBlacklisted(m)).length
  const petsCount = (s.pets || []).filter(p => !isBlacklisted(p)).length
  const itemsCount = (s.items || []).filter(i => !isBlacklisted(i)).length
  return Boolean(heroesCount || monstersCount || petsCount || itemsCount)
}

function sourceSummaryText(entry) {
  const s = entry.sources
  if (!s) return ''
  const parts = []
  const heroes = (s.heroes || []).filter(h => !isBlacklisted(h))
  const monsters = (s.monsters || []).filter(m => !isBlacklisted(m))
  const pets = (s.pets || []).filter(p => !isBlacklisted(p))
  const items = (s.items || []).filter(i => !isBlacklisted(i))

  if (heroes.length) parts.push(`${heroes.length} 位角色`)
  if (monsters.length) parts.push(`${monsters.length} 种怪物`)
  if (pets.length) parts.push(`${pets.length} 种魔物`)
  if (items.length) parts.push(`${items.length} 件道具`)
  return parts.length ? `来源：${parts.join(' · ')}` : ''
}

// 详情弹窗管理
const openedId = computed(() => queryString('id') || queryString('buff'))
const detailVisible = computed({
  get: () => Boolean(openedId.value),
  set: val => { if (!val) closeEntry() }
})
const currentEntry = computed(() => {
  if (!openedId.value) return null
  return entries.value.find(e => (e.id && e.id === openedId.value) || e.name === openedId.value) || null
})
const currentMonsterSources = computed(() => {
  return (currentEntry.value?.sources?.monsters || []).filter(m => !isBlacklisted(m))
})

watch(openedId, () => {
  expandedStepDiagrams.value = {}
})

function openEntry(entry) {
  router.push({ query: { ...route.query, id: entry.id || entry.name } })
}

function closeEntry() {
  const query = { ...route.query }
  delete query.id
  delete query.buff
  router.replace({ query })
}

function changeSection(sec) {
  const query = { ...route.query, section: sec }
  delete query.category
  delete query.id
  delete query.buff
  router.replace({ query })
}

function setFilter(key, val) {
  const query = { ...route.query }
  if (val) query[key] = val
  else delete query[key]
  router.replace({ query })
}

// 页面联动跳转
function navigateToHero(hero) {
  if (!hero.id) return
  router.push({ path: '/heroes', query: { id: hero.id } })
}

function navigateToMonster(mon) {
  if (!mon.id) return
  router.push({ path: '/monsters', query: { id: mon.id } })
}

function navigateToPet(pet) {
  if (!pet.id) return
  router.push({ path: '/pets', query: { id: pet.id } })
}

function navigateToItem(item) {
  if (!item.id) return
  router.push({ query: { ...route.query, itemId: item.id } })
}

async function loadData() {
  if (loading.value || data.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchWithFallback('data/parsed/glossary.json')
  } catch (err) {
    error.value = '词条数据加载失败，请重试。'
    console.error('Failed to load glossary data:', err)
  } finally {
    loading.value = false
  }
}

watch([activeSection, category], async () => {
  await nextTick()
  resolveScrollTarget('#glossaryScroll')?.scrollTo({ top: 0, behavior: 'auto' })
})

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.glossary-content {
  background: var(--paper);
  padding: 12px 14px calc(88px + var(--safe-bottom, 0px));
}

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.count-num {
  color: var(--accent-ink);
}
.counter-hint {
  font-weight: 400;
}

/* 网格与卡片 */
.glossary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.glossary-card {
  display: flex;
  min-width: 0;
}

.glossary-card.is-target {
  outline: 2px solid var(--accent-ink);
  outline-offset: -2px;
  border-radius: 6px;
}

.glossary-card__button {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--paper-soft);
  color: var(--text-main);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.glossary-card__button:hover {
  background: var(--paper-solid);
  border-color: var(--border-color);
}

.glossary-card__button:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: 2px;
}

.glossary-card__icon {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  object-fit: contain;
}

img.glossary-card__icon {
  border: none;
  background: transparent;
  padding: 1px;
}

.glossary-card__icon--text {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-soft);
  border-radius: 5px;
  background: var(--wood-soft);
  color: var(--on-wood-text);
  font-weight: 700;
  font-size: 16px;
}

.glossary-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.glossary-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.glossary-card__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
}

.glossary-card__summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.glossary-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rule-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 2px 6px;
  background: var(--paper);
  border: 1px solid var(--border-faint);
  border-radius: 3px;
  font-size: 12px;
}
.rule-chip__label {
  color: var(--text-faint);
}
.rule-chip__value {
  font-weight: 600;
  color: var(--accent-ink);
}

.glossary-card__source-hint {
  margin-top: 2px;
  font-size: 12px;
}
.source-hint-badge {
  display: inline-block;
  padding: 1px 6px;
  background: var(--paper-solid);
  border-radius: 3px;
  color: var(--text-muted);
}

/* 详情弹窗内部 */
.detail-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.detail-header__icon {
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  object-fit: contain;
}

img.detail-header__icon {
  border: none;
  background: transparent;
  padding: 2px;
}

.detail-header__icon--text {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--wood-soft);
  color: var(--on-wood-text);
  font-size: 24px;
  font-weight: 700;
}

.detail-header__info {
  flex: 1;
  min-width: 0;
}

.detail-header__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.detail-header__summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main);
}

.rules-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rules-table :deep(.ui-info-row) {
  align-items: flex-start;
  gap: 16px;
  padding: 8px 4px;
}

.rules-table :deep(.ui-info-row__label) {
  flex: 0 0 140px;
  max-width: 140px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  white-space: normal;
  line-height: 1.6;
}

.rules-table :deep(.ui-info-row__value) {
  text-align: left;
  line-height: 1.6;
  color: var(--text-main, #3e2a14);
  word-break: normal;
  overflow-wrap: break-word;
}

/* 来源跳转卡片 */
.source-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 5px;
  color: var(--text-main);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.source-chip:hover {
  background: var(--paper-solid);
  border-color: var(--accent-ink);
  color: var(--accent-ink);
}

.source-chip__name {
  font-weight: 600;
}

.source-chip__skill {
  font-size: 12px;
  color: var(--text-muted);
}

.source-chip__arrow {
  font-size: 12px;
  opacity: 0.7;
}

.glossary-error {
  text-align: center;
  padding: 24px;
}

/* 等级压制梯度对照表 */
.level-sup-table-wrapper {
  overflow-x: auto;
  margin-top: 8px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--paper-soft);
}

.level-sup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.level-sup-table th {
  padding: 8px 12px;
  background: rgba(139, 90, 43, 0.08);
  color: var(--text-muted);
  font-weight: 700;
  border-bottom: 1px solid var(--border-soft);
  white-space: nowrap;
}

.level-sup-table td {
  padding: 7px 12px;
  border-bottom: 1px dashed var(--border-soft);
  color: var(--text-main);
  white-space: nowrap;
}

.level-sup-table tr:last-child td {
  border-bottom: none;
}

.level-sup-table__row--max {
  background: rgba(180, 50, 50, 0.06);
}

.level-sup-table__diff {
  font-weight: 600;
}

.level-sup-table__badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #c0392b;
  border-radius: 3px;
}

.level-sup-table__red {
  color: #c0392b;
  font-weight: 600;
}

.level-sup-table__dmg {
  color: #27ae60;
  font-weight: 600;
}

.level-sup-table__bar-cell {
  width: 130px;
}

.level-sup-table__bar-track {
  height: 8px;
  width: 100px;
  background: rgba(192, 57, 43, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.level-sup-table__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #d35400, #27ae60);
  border-radius: 4px;
}

/* 第二步乘区拆解与公式图解卡片 */
.formula-card {
  margin-top: 8px;
  padding: 14px 16px;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.formula-card__math {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 10px;
  background: rgba(139, 90, 43, 0.05);
  border: 1px dashed var(--border-soft);
  border-radius: 6px;
  margin-bottom: 14px;
}

.math-term {
  font-weight: 700;
  font-size: 15px;
  color: var(--accent-ink);
}

.math-sym {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-muted);
}

.math-num {
  font-size: 16px;
  font-weight: 700;
  color: #27ae60;
}

.math-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 5px 9px;
  border-radius: 6px;
  border: 1px solid;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.math-pill--add {
  background: rgba(41, 128, 185, 0.08);
  border-color: rgba(41, 128, 185, 0.35);
  color: #1a5276;
}

.math-pill--key {
  background: rgba(211, 84, 0, 0.08);
  border-color: rgba(211, 84, 0, 0.35);
  color: #935116;
}

.math-pill--res {
  background: rgba(192, 57, 43, 0.08);
  border-color: rgba(192, 57, 43, 0.35);
  color: #78281f;
}

.math-pill__label {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
}

.math-pill__code {
  font-size: 11px;
  font-family: var(--font-mono, 'Consolas', monospace);
  line-height: 1.25;
  opacity: 0.9;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.formula-card__notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-main);
}

.formula-card__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.formula-card__bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.formula-card__bullet--add {
  background: #2980b9;
}

.formula-card__bullet--key {
  background: #d35400;
}

.formula-card__bullet--res {
  background: #c0392b;
}

.formula-card__text code {
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  font-family: monospace;
}

/* 步骤折叠按钮与内容 */
.rule-value-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.rule-value-text {
  width: 100%;
}

.rule-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-ink);
  background: var(--paper-soft);
  border: 1px dashed var(--border-soft);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 4px;
}

.rule-toggle-btn:hover {
  background: var(--paper-solid);
  border-color: var(--accent-ink);
}

.rule-toggle-icon {
  font-size: 10px;
}

.step-inline-diagram {
  margin: 6px 0 10px 0;
  width: 100%;
}

.formula-card__badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-ink);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border-soft);
}

/* 分数形式数学公式 */
.math-fraction {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: middle;
  padding: 0 4px;
}

.math-fraction__num {
  padding-bottom: 4px;
}

.math-fraction__bar {
  width: 100%;
  height: 2px;
  background: var(--text-muted, #8a6a1f);
  border-radius: 1px;
}

.math-fraction__den {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
}

/* 专属药丸色彩 */
.math-pill--k {
  background: rgba(39, 174, 96, 0.08);
  border-color: rgba(39, 174, 96, 0.35);
  color: #1e8449;
}
.formula-card__bullet--k {
  background: #27ae60;
}

.math-pill--def {
  background: rgba(142, 68, 173, 0.08);
  border-color: rgba(142, 68, 173, 0.35);
  color: #6c3483;
}
.formula-card__bullet--def {
  background: #8e44ad;
}

.math-pill--crit {
  background: rgba(230, 126, 34, 0.08);
  border-color: rgba(230, 126, 34, 0.35);
  color: #b9770e;
}
.formula-card__bullet--crit {
  background: #e67e22;
}

.math-pill--crit-dam {
  background: rgba(231, 76, 60, 0.08);
  border-color: rgba(231, 76, 60, 0.35);
  color: #922b21;
}
.formula-card__bullet--crit-dam {
  background: #e74c3c;
}

.math-pill--suppress {
  background: rgba(192, 57, 43, 0.08);
  border-color: rgba(192, 57, 43, 0.35);
  color: #78281f;
}
.formula-card__bullet--suppress {
  background: #c0392b;
}

:global(.dark-theme) .math-pill--add {
  background: rgba(52, 152, 219, 0.15);
  border-color: rgba(52, 152, 219, 0.45);
  color: #70bbf0;
}
:global(.dark-theme) .math-pill--key {
  background: rgba(230, 126, 34, 0.15);
  border-color: rgba(230, 126, 34, 0.45);
  color: #f39c12;
}
:global(.dark-theme) .math-pill--res {
  background: rgba(231, 76, 60, 0.15);
  border-color: rgba(231, 76, 60, 0.45);
  color: #f1948a;
}
:global(.dark-theme) .math-pill--k {
  background: rgba(46, 204, 113, 0.15);
  border-color: rgba(46, 204, 113, 0.45);
  color: #58d68d;
}
:global(.dark-theme) .math-pill--def {
  background: rgba(155, 89, 182, 0.15);
  border-color: rgba(155, 89, 182, 0.45);
  color: #bb8fce;
}
:global(.dark-theme) .math-pill--crit {
  background: rgba(243, 156, 18, 0.15);
  border-color: rgba(243, 156, 18, 0.45);
  color: #f8c471;
}
:global(.dark-theme) .math-pill--crit-dam {
  background: rgba(231, 76, 60, 0.15);
  border-color: rgba(231, 76, 60, 0.45);
  color: #f1948a;
}
:global(.dark-theme) .math-pill--suppress {
  background: rgba(231, 76, 60, 0.15);
  border-color: rgba(231, 76, 60, 0.45);
  color: #f1948a;
}
:global(.dark-theme) .math-pill__code {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.06);
}

/* 过渡动画 */
.formula-fade-enter-active,
.formula-fade-leave-active {
  transition: all 0.2s ease;
}

.formula-fade-enter-from,
.formula-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 860px) {
  .glossary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .glossary-content {
    padding-inline: 10px;
  }
  .glossary-card__button {
    padding: 10px;
    gap: 10px;
  }
  .glossary-card__icon {
    flex-basis: 34px;
    width: 34px;
    height: 34px;
  }
  .rules-table :deep(.ui-info-row) {
    flex-direction: column;
    gap: 4px;
  }
  .rules-table :deep(.ui-info-row__label) {
    flex: none;
    max-width: none;
    color: var(--accent-ink);
  }
}
</style>
