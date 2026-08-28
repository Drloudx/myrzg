<template>
  <div class="page-view-container heroes-page">

    <!-- 筛选区（羊皮纸面板） -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索角色名称、称号、关键词..." />

      <!-- 稀有度 -->
      <UiFilterRow label="稀有度：">
        <UiFilterPill :active="selectedRarity === null" @click="selectedRarity = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="r in [5, 4, 3]"
          :key="r"
          :quality="r"
          :active="selectedRarity === r"
          @click="selectedRarity = r"
        >{{ r }}星</UiFilterPill>
      </UiFilterRow>

      <!-- 职业 -->
      <UiFilterRow label="职业：">
        <UiFilterPill :active="selectedJob === null" @click="selectedJob = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="(jobName, jobIdx) in jobsList"
          :key="jobIdx"
          :active="selectedJob === (jobIdx + 1)"
          @click="selectedJob = (jobIdx + 1)"
        >{{ jobName }}</UiFilterPill>
      </UiFilterRow>

      <!-- 属性 -->
      <UiFilterRow label="属性：">
        <UiFilterPill :active="selectedElement === null" @click="selectedElement = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="(elementName, elementKey) in ELEMENT_NAMES"
          :key="elementKey"
          :active="selectedElement === Number(elementKey)"
          @click="selectedElement = Number(elementKey)"
        >{{ elementName }}</UiFilterPill>
      </UiFilterRow>
    </div>

    <!-- 角色网格（懒加载每批 60 项） -->
    <UiCardGrid id="heroesGridScroll" v-if="isDataReady" class="heroes-scroll">
      <div class="heroes-grid">
        <div
          v-for="hero in displayedHeroes"
          :key="hero.id"
          class="hero-bag-card"
          @click="openHeroDetail(hero)"
        >
          <!-- Card Background -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/card_${hero.rare}_botm.png`)"
            class="bag-card-background"
            alt="background"
          />

          <!-- Frame Background -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/card_${hero.rare}.png`)"
            class="bag-card-frame"
            alt="frame"
          />

          <!-- Character Avatar -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/${hero.img}_ka.png`)"
            :alt="hero.name"
            class="bag-card-avatar"
            loading="lazy"
            @error="handleCardImgError"
          />

          <!-- Attribute Icon (Top-Left) -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/card_atr_${getElementSlug(hero.element)}.png`)"
            class="bag-card-element"
            :title="hero.elementName"
          />

          <!-- Class Icon (Top-Right) -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/class_icon_s_${getJobSlug(hero.job)}.png`)"
            class="bag-card-job"
            :title="hero.jobName"
          />

          <!-- Bottom Card Info Overlay -->
          <div class="bag-card-info">
            <div class="hero-name-label">{{ hero.name }}</div>
          </div>

          <!-- Nameplate Star Icon (Bottom-Left Diamond) -->
          <img
            :src="getImageUrl('/PicHandBookPanel/colect_star.png')"
            class="bag-card-name-star"
            alt="star"
          />
        </div>
      </div>

      <UiEmptyState v-if="filteredHeroes.length === 0" text="未找到匹配的角色数据" />
    </UiCardGrid>

    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />
    <UiEmptyState v-else type="loading" text="正在装配角色图鉴数据..." />

    <!-- 角色详情全屏弹窗 -->
    <UiModal
      v-model:visible="detailVisible"
      max-width="820px"
      scroll-id="heroModalScroll"
      :z-index="2000"
      @close="closeHeroDetail"
    >
      <template #header>
        <div class="hero-modal-title-group">
          <h3 class="hero-title-main">{{ selectedHero ? selectedHero.name : '角色详情' }}</h3>
          <span v-if="selectedHero" class="hero-subtitle">{{ selectedHero.name2 || selectedHero.des }}</span>
        </div>
      </template>

      <template v-if="selectedHero">
        <!-- TOP SECTION: Standup portrait -->
        <div class="portrait-section paper-panel corner-nails">
          <img
            :src="getImageUrl(`/images/chara/${selectedHero.img}.png`)"
            :alt="selectedHero.name"
            class="chara-portrait-img"
            @error="handlePortraitImgError"
          />
        </div>

        <!-- Badges & Favorite Gifts Row -->
        <div class="hero-badges-row-container">
          <UiTag tone="default" class="badge job-badge">
            <img :src="getImageUrl(`/images/HeroBagPanel/class_icon_s_${getJobSlug(selectedHero.job)}.png`)" class="badge-icon" />
            {{ selectedHero.jobName }}
          </UiTag>
          <UiTag tone="accent" class="badge element-badge">
            <img :src="getImageUrl(`/images/HeroGachaShowPanel/spGachaTag${getSpGachaElementSlug(selectedHero.element)}03.png`)" class="badge-icon" />
            {{ selectedHero.elementName }}属性
          </UiTag>
          <UiTag :quality="selectedHero.rare" class="badge rare-badge">
            {{ selectedHero.rare }}星
          </UiTag>

          <!-- Favorite Gifts (Inline) -->
          <div v-if="heroFavoriteGifts && heroFavoriteGifts.length > 0" class="hero-fav-gifts-inline">
            <span class="fav-label">喜好礼物：</span>
            <div
              v-for="gift in heroFavoriteGifts"
              :key="gift.id"
              class="fav-gift-badge-inline"
              :class="`quality-border-${gift.quality}`"
              @click="handleGiftClick(gift.id)"
              :title="gift.name"
            >
              <img :src="getImageUrl(gift.icon)" class="fav-gift-icon" />
              <span class="fav-gift-points" :class="`quality-text-${gift.quality}`">+{{ gift.value }}</span>
            </div>
          </div>
        </div>

        <!-- MIDDLE SECTION: Tabs Navigation -->
        <div class="detail-tabs">
          <UiTabs
            v-model="activeTab"
            :options="[
              { value: 'skills', label: '技能星阶' },
              { value: 'calculator', label: '基础属性' },
              { value: 'archives', label: '角色档案' },
              { value: 'voicelines', label: '互动' }
            ]"
          />
        </div>

        <!-- TAB CONTENT: SKILLS & STARS -->
        <div v-if="activeTab === 'skills'" class="tab-pane-content">
          <UiSection title="主动技能与天赋">
            <!-- Skills Select Grid -->
            <div class="skills-select-grid">
              <div
                v-for="(skill, sIdx) in selectedHero.skills"
                :key="skill.id"
                class="skill-select-card"
                :class="{ active: activeSkillIndex === sIdx }"
                @click="activeSkillIndex = sIdx"
              >
                <img
                  v-if="skill.type !== 'normal'"
                  :src="getImageUrl(`/images/Common_SkillIcon/${skill.icon}.png`)"
                  class="skill-select-icon"
                  @error="handleSkillIconError"
                />
                <div class="skill-select-info">
                  <UiTag :tone="skill.type === 'normal' ? 'default' : 'gold'">{{ skill.type === 'normal' ? '普攻' : '技能' }}</UiTag>
                  <span class="sk-name">{{ skill.name }}</span>
                </div>
              </div>

              <!-- Talent Passive -->
              <div
                v-for="(talent, tIdx) in selectedHero.talentSkills"
                :key="talent.id"
                class="skill-select-card"
                :class="{ active: activeSkillIndex === (selectedHero.skills.length + tIdx) }"
                @click="activeSkillIndex = (selectedHero.skills.length + tIdx)"
              >
                <img
                  :src="getImageUrl(`/images/Common_SkillIcon/${talent.icon}.png`)"
                  class="skill-select-icon"
                  @error="handleSkillIconError"
                />
                <div class="skill-select-info">
                  <UiTag tone="accent">天赋</UiTag>
                  <span class="sk-name">{{ talent.name }}</span>
                </div>
              </div>
            </div>

            <!-- Skill details display panel -->
            <div class="skill-details-panel paper-panel-solid" v-if="currentSelectedSkill">
              <div class="panel-header">
                <h4 class="skill-display-name">{{ currentSelectedSkill.name }}</h4>
                <div class="skill-meta-tags" v-if="currentSelectedSkill.type !== 'talent'">
                  <UiTag v-if="currentSelectedSkill.cd > 0" tone="accent">CD: {{ currentSelectedSkill.cd }}s</UiTag>
                  <UiTag v-if="currentSelectedSkill.cost > 0" tone="accent">法力: {{ currentSelectedSkill.cost }}</UiTag>
                </div>
                <UiTag v-else tone="default">核心被动天赋</UiTag>
              </div>

              <!-- Levels sliders for skill -->
              <div class="skill-level-slider-container" v-if="currentSelectedSkill.type !== 'normal' && currentSelectedSkill.levelData?.length > 1">
                <div class="slider-row">
                  <span class="lvl-slider-label">当前等级: Lv.{{ currentSkillLevel }}</span>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    v-model.number="currentSkillLevel"
                    class="lvl-range-slider"
                  />
                </div>
                <div class="slider-row mt-2">
                  <span class="lvl-slider-label">目标等级: Lv.{{ targetSkillLevel }}</span>
                  <input
                    type="range"
                    :min="currentSkillLevel"
                    max="12"
                    v-model.number="targetSkillLevel"
                    class="lvl-range-slider"
                  />
                </div>
              </div>

              <!-- Level Description -->
              <div class="skill-des-box" v-if="currentSelectedSkillLevelDetail">
                <div class="lvl-subname">{{ currentSelectedSkillLevelDetail.name }}</div>
                <p class="lvl-des-txt" v-html="formatSkillDescription(currentSelectedSkillLevelDetail.des)"></p>
              </div>

              <!-- Upgrade Cost Info -->
              <div class="upgrade-costs-box" v-if="currentSelectedSkill.type !== 'normal' && currentSelectedSkill.upgrades?.length > 0 && targetSkillLevel > currentSkillLevel">
                <h5 class="cost-subtitle">升级计划消耗 (Lv.{{ currentSkillLevel }} → Lv.{{ targetSkillLevel }}):</h5>
                <div class="cost-req-row">
                  <div class="cost-req-cell">角色等级门槛: <span class="cost-num">{{ skillUpgradeRangeSummary.maxHeroLevel }}级</span></div>
                  <div class="cost-req-cell">消耗银币: <span class="cost-num">{{ skillUpgradeRangeSummary.money }}</span></div>
                </div>
                <div class="cost-items-list" v-if="skillUpgradeRangeSummary.items?.length > 0">
                  <span class="cost-label">消耗道具:</span>
                  <div class="cost-item-pill" v-for="item in skillUpgradeRangeSummary.items" :key="item.id">
                    <img :src="getImageUrl(item.img)" class="cost-item-img" />
                    <span class="cost-item-name" :class="`quality-text-${item.quality}`">{{ item.name }} x{{ item.num }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UiSection>

          <!-- Star Upgrades (星阶技能) Section -->
          <UiSection title="星阶命座强化">
            <div class="star-skills-select-grid">
              <div
                v-for="(star, sIdx) in selectedHero.starSkills"
                :key="star.id"
                class="star-select-card"
                :class="{ active: activeStarIndex === sIdx }"
                @click="activeStarIndex = sIdx"
              >
                <img
                  :src="getImageUrl(`/images/Common_SkillIcon/${star.icon}.png`)"
                  class="star-select-icon"
                  @error="handleSkillIconError"
                />
                <div class="star-select-info">
                  <UiTag tone="default">星阶 {{ sIdx + 1 }}</UiTag>
                  <span class="st-name">{{ star.name }}</span>
                </div>
              </div>
            </div>

            <!-- Selected Star Skill Details -->
            <div class="star-details-panel paper-panel-solid" v-if="currentSelectedStarSkill">
              <div class="panel-header">
                <h4 class="star-display-name">{{ currentSelectedStarSkill.name }}</h4>
                <UiTag tone="accent">可升至Lv.{{ currentSelectedStarSkill.maxLevel }}</UiTag>
              </div>

              <!-- Star Levels Grid -->
              <div class="star-levels-box">
                <div
                  v-for="lvl in currentSelectedStarSkill.levelData"
                  :key="lvl.level"
                  class="star-level-row"
                >
                  <div class="star-lvl-badge">等级 {{ lvl.level }}</div>
                  <div class="star-lvl-desc">
                    <p class="lvl-des-txt" v-html="formatSkillDescription(lvl.des)"></p>
                    <div class="shard-cost-pills" v-if="lvl.cost > 0">
                      <span class="shard-cost-label">消耗专属碎片:</span>
                      <span class="shard-cost-value">
                        <img :src="getImageUrl(`/images/HeroInfoPanel/${selectedHero.img}_p.png`)" class="shard-item-img-small" />
                        {{ lvl.cost }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Limits and Conversions -->
              <div class="star-limits-box">
                <div class="limit-title">满命总需：</div>
                <ul class="limit-list">
                  <li>累计需要专属碎片总量：<span class="limit-num">{{ selectedHero.starLimitInfo.limit }}</span> 片。</li>
                  <li>
                    满命（全部点满）后，再次抽到重复角色多余的专属碎片会自动转化为通用货币：
                    <span class="limit-crystal">
                      <img src="/images/Common_ItemIcon/item_20026.png" class="crystal-icon" />
                      记忆结晶 x{{ selectedHero.starLimitInfo.rewardItemNum }}
                    </span>。
                  </li>
                </ul>
              </div>
            </div>
          </UiSection>
        </div>

        <!-- TAB CONTENT: CALCULATOR -->
        <div v-if="activeTab === 'calculator'" class="tab-pane-content">
          <UiSection title="等级与基础属性">
            <!-- Calculator Sliders -->
            <div class="calculator-inputs">
              <div class="input-slider-group paper-panel-solid">
                <div class="slider-header">
                  <span class="slider-title">目标等级</span>
                  <span class="slider-val">{{ calcLevel }} / 80</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  v-model="calcLevel"
                  class="calc-range-slider"
                  @input="handleCalcLevelChange"
                />
              </div>

              <div class="input-slider-group paper-panel-solid mt-3">
                <div class="slider-header">
                  <span class="slider-title">突破品阶</span>
                  <span class="slider-val">品阶 {{ calcRank }} (突破等级上限: {{ getRankMaxLevel(calcRank) }})</span>
                </div>
                <div class="rank-selector-buttons">
                  <UiFilterPill
                    v-for="r in 6"
                    :key="r - 1"
                    :active="calcRank === (r - 1)"
                    @click="setCalcRank(r - 1)"
                  >品阶 {{ r - 1 }}</UiFilterPill>
                </div>
              </div>
            </div>

            <!-- Calculated Attributes Grid -->
            <div class="calculator-outputs mt-4">
              <div class="output-subheading">基础属性</div>
              <div class="attr-calc-grid">
                <div
                  v-for="field in growingAttributesList"
                  :key="field"
                  class="attr-calc-card"
                >
                  <span class="attr-calc-label">{{ translateAttributeKey(field) }}</span>
                  <div class="attr-values-row">
                    <span class="attr-val-base">{{ selectedHero.unitData[field] || 0 }}</span>
                    <span class="attr-arrow">→</span>
                    <span class="attr-val-calc">{{ computedStats[field] }}</span>
                  </div>
                  <span class="attr-diff-pill" v-if="computedStats[field] - (selectedHero.unitData[field] || 0) > 0">
                    +{{ computedStats[field] - (selectedHero.unitData[field] || 0) }}
                  </span>
                </div>
              </div>

              <div class="output-subheading mt-4">其他属性</div>
              <div class="attr-calc-grid">
                <div
                  v-for="field in staticAttributesList"
                  :key="field"
                  class="attr-calc-card static-v-card"
                >
                  <span class="attr-calc-label">{{ translateAttributeKey(field) }}</span>
                  <div class="attr-values-row">
                    <span class="attr-val-calc static-color">{{ selectedHero.unitData[field] || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cumulative Costs Box -->
            <div class="calculator-costs mt-4 paper-panel-solid">
              <div class="output-subheading">升级与突破累计消耗 (从 Lv.1, 品阶 0 开始)</div>

              <div class="costs-summary-grid">
                <div class="cost-summary-cell">
                  <span class="summary-label">累计所需经验值 (EXP)</span>
                  <span class="summary-val">{{ computedCosts.exp }}</span>
                </div>
                <div class="cost-summary-cell">
                  <span class="summary-label">升级所需银币 (1:1 EXP)</span>
                  <span class="summary-val">{{ computedCosts.upgradeMoney }}</span>
                </div>
                <div class="cost-summary-cell">
                  <span class="summary-label">突破所需银币</span>
                  <span class="summary-val">{{ computedCosts.breakthroughMoney }}</span>
                </div>
                <div class="cost-summary-cell highlight">
                  <span class="summary-label">总消耗银币合计</span>
                  <span class="summary-val">{{ computedCosts.upgradeMoney + computedCosts.breakthroughMoney }}</span>
                </div>
              </div>

              <!-- Breakthrough Materials -->
              <div class="breakthrough-mats-box mt-3" v-if="computedCosts.breakthroughItems?.length > 0">
                <div class="mats-subtitle">突破所需材料汇总:</div>
                <div class="mats-flex-row">
                  <div
                    v-for="item in computedCosts.breakthroughItems"
                    :key="item.id"
                    class="mat-item-pill"
                  >
                    <img :src="getImageUrl(item.img)" class="mat-item-img" />
                    <span class="mat-item-name" :class="`quality-text-${item.quality}`">{{ item.name }} x{{ item.num }}</span>
                  </div>
                </div>
              </div>
            </div>
          </UiSection>
        </div>

        <!-- TAB CONTENT: ARCHIVES -->
        <div v-if="activeTab === 'archives'" class="tab-pane-content">
          <UiSection title="角色档案">
            <div class="archives-list">
              <div
                v-for="arch in selectedHero.archives"
                :key="arch.title"
                class="archive-item-card paper-panel-solid"
              >
                <!-- Regular biography or stats buff card -->
                <div v-if="arch.type !== 1">
                  <div class="archive-card-header">
                    <h4 class="archive-title">{{ arch.title }}</h4>
                    <span class="fav-unlock-tag">
                      好感要求: <span class="unlock-fav-val">{{ arch.unlockFav }}</span>
                    </span>
                  </div>
                  <!-- Description text -->
                  <div class="archive-desc-box">
                    <p class="archive-desc-txt">{{ arch.desc }}</p>
                  </div>

                  <!-- Unlock permanent buff attributes (if type 3) -->
                  <div class="archive-buff-banner" v-if="arch.type === 3 && Object.keys(arch.stats).length > 0">
                    <span class="buff-title">解锁属性增益:</span>
                    <div class="buff-stats-flex">
                      <UiTag
                        v-for="(val, statKey) in arch.stats"
                        :key="statKey"
                        tone="accent"
                      >{{ translateAttributeKey(statKey) }} +{{ val }}</UiTag>
                    </div>
                  </div>
                </div>

                <!-- Story task card (type === 1) -->
                <div v-else>
                  <div class="archive-card-header">
                    <div class="title-side-group">
                      <UiTag tone="danger">剧情</UiTag>
                      <h4 class="archive-title inline">{{ arch.taskName || arch.title }}</h4>
                    </div>
                    <span class="fav-unlock-tag">
                      好感要求: <span class="unlock-fav-val">{{ arch.unlockFav }}</span>
                    </span>
                  </div>

                  <!-- Archive Desc -->
                  <div class="archive-desc-box mb-2">
                    <p class="archive-desc-txt">{{ arch.desc }}</p>
                  </div>

                  <!-- Task Gate -->
                  <div class="story-task-gate mb-2" v-if="arch.taskDesc">
                    <span class="gate-label">任务目标:</span>
                    <p class="gate-txt">{{ cleanDialogueLine(arch.taskDesc) }}</p>
                  </div>

                  <!-- Mail Letter Content if attached -->
                  <div class="mail-body-inline-box mb-2" v-if="arch.mail">
                    <div class="mail-inline-header">✉ 专属信件:《{{ arch.mail.title }}》</div>
                    <p class="mail-inline-content">{{ cleanMailContent(arch.mail.content) }}</p>
                  </div>

                  <!-- Story Rewards -->
                  <div class="story-reward-box mb-2" v-if="arch.reward?.items?.length > 0">
                    <span class="reward-lbl">通关剧情奖励:</span>
                    <div class="reward-items-flex">
                      <div
                        v-for="item in arch.reward.items"
                        :key="item.id"
                        class="mail-r-item-pill"
                      >
                        <img :src="getImageUrl(item.img)" class="mail-r-item-img" />
                        <span class="mail-r-item-name" :class="`quality-text-${item.quality}`">{{ item.name }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- INLINE DIALOGUE TRANSCRIPT -->
                  <div class="story-dialogue-inline-list mt-2" v-if="arch.dialogs.length">
                    <template v-for="(seg, segIdx) in arch.dialogs" :key="seg.id">
                      <button
                        class="toggle-dialogue-btn"
                        :class="{ 'seg-mid': segIdx > 0 }"
                        @click="toggleDialogueInline(seg.id)"
                      >
                        <span class="btn-left">
                          {{ isDialogueExpanded(seg.id) ? '▲ 收起剧情文本' : '▼ 展开剧情文本' }}
                          <span class="seg-label" v-if="arch.dialogs.length > 1">
                            （第 {{ segIdx + 1 }}/{{ arch.dialogs.length }} 段）
                          </span>
                        </span>
                        <span class="btn-right" v-if="seg.name">{{ seg.name }}</span>
                      </button>

                      <div v-if="isDialogueExpanded(seg.id)" class="dialogue-lines-container">
                        <div v-if="loadingDialogs[seg.id]" class="dialogue-loading-indicator">
                          剧情读取中，请稍候...
                        </div>
                        <DialogLines v-else-if="dialogsCache[seg.id]?.length > 0" :lines="dialogsCache[seg.id]" />
                        <div v-else class="dialogue-error-indicator">
                          剧情读取失败。
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </UiSection>
        </div>

        <!-- TAB CONTENT: INTERACTION (互动) -->
        <div v-if="activeTab === 'voicelines'" class="tab-pane-content">
          <!-- Interaction voice subtabs -->
          <div class="voice-subtabs">
            <UiTabs
              v-model="voiceSubTab"
              :options="[
                { value: 'chat', label: '好感对话' },
                { value: 'heroEvent', label: '营地事件' },
                { value: 'explore', label: '局内探索' },
                { value: 'touch', label: '摸头' },
                { value: 'walk', label: '路过' },
                { value: 'ziyanziyu', label: '自言自语' }
              ]"
            />
          </div>

          <!-- 好感对话 Tab -->
          <UiSection v-if="voiceSubTab === 'chat'" title="好感对话">
            <div class="explore-voice-list">
              <div
                v-for="(chat, cIdx) in selectedHero.behavior.chat"
                :key="cIdx"
                class="voice-group-card paper-panel-solid inline-dialogue-task"
              >
                <div class="voice-group-title header-between">
                  <span class="fav-requirement-label">好感度要求: {{ chat.min }}-{{ chat.max }}</span>
                  <UiButton variant="secondary" size="sm" @click="toggleDialogueInline(chat.dialog)">
                    {{ isDialogueExpanded(chat.dialog) ? '▲ 收起对话' : '▼ 展开对话' }}
                  </UiButton>
                </div>

                <div v-if="isDialogueExpanded(chat.dialog)" class="dialogue-lines-container inline-chat">
                  <div v-if="loadingDialogs[chat.dialog]" class="dialogue-loading-indicator">
                    对话读取中...
                  </div>
                  <DialogLines v-else-if="dialogsCache[chat.dialog]?.length > 0" :lines="dialogsCache[chat.dialog]" />
                  <div v-else class="dialogue-error-indicator">
                    无法加载对话文本。
                  </div>
                </div>
              </div>
            </div>
          </UiSection>

          <!-- 营地事件 Tab -->
          <UiSection v-if="voiceSubTab === 'heroEvent'" title="营地事件">
            <div class="explore-voice-list">
              <div
                v-for="(evt, eIdx) in selectedHero.behavior.heroEvent"
                :key="eIdx"
                class="voice-group-card paper-panel-solid inline-dialogue-task"
              >
                <div class="voice-group-title header-between">
                  <span class="event-title-label">事件: {{ evt.title }} (触发天数: 第 {{ evt.day }} 天)</span>
                  <UiButton variant="secondary" size="sm" @click="toggleDialogueInline(evt.dialog)">
                    {{ isDialogueExpanded(evt.dialog) ? '▲ 收起剧情' : '▼ 展开剧情' }}
                  </UiButton>
                </div>

                <div v-if="isDialogueExpanded(evt.dialog)" class="dialogue-lines-container inline-chat">
                  <div v-if="loadingDialogs[evt.dialog]" class="dialogue-loading-indicator">
                    剧情读取中...
                  </div>
                  <DialogLines v-else-if="dialogsCache[evt.dialog]?.length > 0" :lines="dialogsCache[evt.dialog]" />
                  <div v-else class="dialogue-error-indicator">
                    无法加载剧情文本。
                  </div>
                </div>
              </div>
            </div>
          </UiSection>

          <!-- Exploration Voice Tab -->
          <UiSection v-if="voiceSubTab === 'explore'" title="局内探索">
            <div class="explore-voice-list">
              <div
                v-for="(group, key) in exploreVoiceGroups"
                :key="key"
                class="voice-group-card paper-panel-solid"
              >
                <div class="voice-group-title">{{ group.label }}</div>
                <div class="voice-lines-container">
                  <div
                    v-for="(line, idx) in group.lines"
                    :key="idx"
                    class="voice-line-item"
                  >
                    <span class="line-idx">台词 #{{ idx + 1 }}</span>
                    <p class="line-content-txt">{{ line }}</p>
                  </div>
                </div>
              </div>
            </div>
          </UiSection>

          <!-- Touch Voice Tab -->
          <UiSection v-if="voiceSubTab === 'touch'" title="摸头">
            <div class="voicelines-grid">
              <div
                v-for="(line, idx) in selectedHero.behavior.touch"
                :key="idx"
                class="voiceline-card paper-panel-solid static-v-card"
              >
                <div class="v-card-header">
                  <span class="fav-requirement-label">好感度要求: {{ line.min }}-{{ line.max }}</span>
                </div>
                <p class="v-text-content">"{{ line.text }}"</p>
              </div>
            </div>
          </UiSection>

          <!-- Daily Walk/Pass-by Voice Tab (路过) -->
          <UiSection v-if="voiceSubTab === 'walk'" title="路过">
            <div class="voicelines-grid">
              <div
                v-for="(line, idx) in selectedHero.behavior.walk"
                :key="idx"
                class="voiceline-card paper-panel-solid static-v-card"
              >
                <div class="v-card-header">
                  <span class="fav-requirement-label">好感度要求: {{ line.min }}-{{ line.max }}</span>
                </div>
                <p class="v-text-content">"{{ line.text }}"</p>
              </div>
            </div>
          </UiSection>

          <!-- 自言自语 Tab -->
          <UiSection v-if="voiceSubTab === 'ziyanziyu'" title="自言自语">
            <div class="voicelines-grid">
              <div
                v-for="(line, idx) in selectedHero.behavior.ziyanziyu"
                :key="idx"
                class="voiceline-card paper-panel-solid static-v-card"
              >
                <div class="v-card-header">
                  <span class="fav-requirement-label">好感度要求: {{ line.min }}-{{ line.max }}</span>
                </div>
                <p class="v-text-content">"{{ line.text }}"</p>
              </div>
            </div>
          </UiSection>
        </div>
      </template>

      <UiBackToTop scroll-container="#heroModalScroll" />
    </UiModal>

    <UiBackToTop scroll-container="#heroesGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getImageUrl, getResourceBaseUrl } from '../utils/env'
import { fetchItemData } from '../utils/itemParser'
import { fetchHeroData, calculateStats, calculateUpgradeCosts } from '../utils/heroParser'
import { isBlacklisted } from '../config/blacklist.js'
import { useLazyList } from '../composables/useLazyList'
import {
  JOB_NAMES,
  JOB_SLUGS,
  ELEMENT_NAMES,
  ELEMENT_SLUGS,
  ELEMENT_SLUGS_LOWER,
  formatHighlightedText,
  cleanDialogueBase,
  cleanMailContent,
  translateStatName
} from '../utils/gameMappings'
import DialogLines from '../components/TaskDialogLines.vue'
import {
  UiBackToTop,
  UiButton,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiModal,
  UiSearchInput,
  UiSection,
  UiTag,
  UiTabs
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

// Data refs
const allHeroes = ref([])
const heroLevelConfig = ref(null)
const heroRankConfig = ref(null)
const itemsCache = ref([])
const consumeCache = ref({})
const isDataReady = ref(false)
const errorMessage = ref('')

// Filter states
const searchQuery = ref('')
const selectedRarity = ref(null)
const selectedJob = ref(null)
const selectedElement = ref(null)

// Detail modal states
const detailVisible = ref(false)
const selectedHero = ref(null)
const activeTab = ref('skills') // 'skills', 'calculator', 'archives', 'voicelines'

// Tab specific states
const activeSkillIndex = ref(0)
const currentSkillLevel = ref(1)
const activeStarIndex = ref(0)
const calcLevel = ref(1)
const calcRank = ref(0)

const voiceSubTab = ref('chat') // 'chat', 'heroEvent', 'explore', 'touch', 'walk', 'ziyanziyu'

// Inline dialogue states
const dialogsCache = ref({})
const loadingDialogs = ref({})
const expandedDialogs = ref(new Set())

// Job names mapping array
const jobsList = Object.values(JOB_NAMES)

onMounted(async () => {
  try {
    const coreData = await fetchItemData()
    itemsCache.value = coreData.items
    
    const parsedData = await fetchHeroData()
    allHeroes.value = parsedData.heroes
    heroLevelConfig.value = parsedData.heroLevel
    heroRankConfig.value = parsedData.heroRank
    
    // 累计计算器所需消耗表：优先使用预解析 heroes.json 内置的 consumeDatas，缺失再回退原始拉取
    if (parsedData.consumeDatas) {
      consumeCache.value = parsedData.consumeDatas
    } else {
      const consumeRes = await fetch(`${getResourceBaseUrl()}/data/consume.json`).then(r => r.json())
      consumeCache.value = consumeRes.datas || consumeRes || {}
    }

    isDataReady.value = true

    // Check URL parameters for direct character opening
    if (route.query.id) {
      openFromQueryId(route.query.id)
    }
  } catch (err) {
    console.error('Error initializing HeroesView:', err)
    errorMessage.value = '数据初始化失败: ' + err.message
  }
})

// Listen to URL query to trigger modal
watch(() => route.query.id, (newId) => {
  if (newId) {
    openFromQueryId(newId)
  } else {
    detailVisible.value = false
    selectedHero.value = null
  }
})

function openFromQueryId(id) {
  const found = allHeroes.value.find(h => h.id === id)
  if (found) {
    selectedHero.value = found
    detailVisible.value = true
    // Reset tabs
    activeTab.value = 'skills'
    activeSkillIndex.value = 0
    currentSkillLevel.value = 1
    activeStarIndex.value = 0
    calcLevel.value = 1
    calcRank.value = 0
    voiceSubTab.value = 'chat'
    
    // Clear expanded dialogs cache on hero switch
    expandedDialogs.value.clear()
  }
}

// Compute filtered heroes
const filteredHeroes = computed(() => {
  if (!isDataReady.value) return []
  
  let result = allHeroes.value.filter(h => !isBlacklisted(h))

  // Rarity filter
  if (selectedRarity.value !== null) {
    result = result.filter(h => h.rare === selectedRarity.value)
  }

  // Job filter
  if (selectedJob.value !== null) {
    result = result.filter(h => h.job === selectedJob.value)
  }

  // Element filter
  if (selectedElement.value !== null) {
    result = result.filter(h => h.element === selectedElement.value)
  }

  // Text search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(h => 
      h.name.toLowerCase().includes(q) || 
      (h.name2 && h.name2.toLowerCase().includes(q)) ||
      (h.des && h.des.toLowerCase().includes(q)) ||
      h.jobName.toLowerCase().includes(q) ||
      h.elementName.toLowerCase().includes(q)
    )
  }

  return result
})

const { displayedItems: displayedHeroes } = useLazyList(filteredHeroes, 60, '#heroesGridScroll')

// Get element and job slugs for icons
function getElementSlug(element) {
  return ELEMENT_SLUGS_LOWER[element] || 'water'
}
function getSpGachaElementSlug(element) {
  return ELEMENT_SLUGS[element] || 'Water'
}

function getJobSlug(job) {
  return JOB_SLUGS[job] || 'zs'
}



// Navigation actions
function openHeroDetail(hero) {
  router.push({ query: { ...route.query, id: hero.id } })
}

function closeHeroDetail() {
  const newQuery = { ...route.query }
  delete newQuery.id
  router.replace({ query: newQuery })
  detailVisible.value = false
  selectedHero.value = null
}

// Image fallback handlers
function handleCardImgError(e) {
  e.target.style.opacity = '0.3'
}

function handlePortraitImgError(e) {
  e.target.style.display = 'none'
}

function handleSkillIconError(e) {
  // Use a generic skill icon fallback
  e.target.src = '/ui/item_00002.png'
}

// Active Skill selected getter
const currentSelectedSkill = computed(() => {
  if (!selectedHero.value) return null
  const numSkills = selectedHero.value.skills.length
  if (activeSkillIndex.value < numSkills) {
    return selectedHero.value.skills[activeSkillIndex.value]
  } else {
    const tIdx = activeSkillIndex.value - numSkills
    return selectedHero.value.talentSkills[tIdx] || null
  }
})

// Update skill level selection range
const targetSkillLevel = ref(1)

watch(currentSkillLevel, (newVal) => {
  const cur = parseInt(newVal)
  const tgt = parseInt(targetSkillLevel.value)
  if (tgt < cur) {
    targetSkillLevel.value = cur
  }
})

watch(activeSkillIndex, () => {
  currentSkillLevel.value = 1
  targetSkillLevel.value = 1
})

const skillUpgradeRangeSummary = computed(() => {
  const skill = currentSelectedSkill.value
  if (!skill || !skill.upgrades) return null
  
  const cur = parseInt(currentSkillLevel.value)
  const tgt = parseInt(targetSkillLevel.value)
  if (tgt <= cur) return { money: 0, items: [], maxHeroLevel: 1 }
  
  let totalMoney = 0
  const itemMap = {}
  let maxHeroLevel = 1
  
  for (let i = cur - 1; i <= tgt - 2; i++) {
    const u = skill.upgrades[i]
    if (u) {
      totalMoney += u.money || 0
      if (u.heroLevel > maxHeroLevel) {
        maxHeroLevel = u.heroLevel
      }
      if (u.items) {
        u.items.forEach(it => {
          if (!itemMap[it.id]) {
            itemMap[it.id] = { ...it, num: 0 }
          }
          itemMap[it.id].num += it.num
        })
      }
    }
  }
  
  return {
    money: totalMoney,
    items: Object.values(itemMap),
    maxHeroLevel
  }
})

const formatSkillDescription = formatHighlightedText

const currentSelectedSkillLevelDetail = computed(() => {
  const skill = currentSelectedSkill.value
  if (!skill || !skill.levelData) return null
  const detail = skill.levelData.find(l => l.level === parseInt(currentSkillLevel.value))
  return detail || skill.levelData[0] || null
})

// Star skill selected
const currentSelectedStarSkill = computed(() => {
  if (!selectedHero.value || !selectedHero.value.starSkills) return null
  return selectedHero.value.starSkills[activeStarIndex.value] || null
})

// Voicelines lists
const exploreVoiceGroups = computed(() => {
  if (!selectedHero.value || !selectedHero.value.behavior?.explore) return {}
  const exp = selectedHero.value.behavior.explore
  return {
    start: { label: '开启探索', lines: exp.start || [] },
    fight: { label: '遭遇战斗', lines: exp.fight || [] },
    win: { label: '战斗胜利', lines: exp.win || [] },
    exploreTalk: { label: '局内闲聊', lines: exp.exploreTalk || [] },
    loopEnd: { label: '区域探索结束', lines: exp.loopEnd || [] },
    readyGoHome: { label: '准备返回营地', lines: exp.readyGoHome || [] },
    over: { label: '安全抵达营地', lines: exp.over || [] },
    roomFinishMember: { label: '房间结束(队员)', lines: exp.roomFinishMember || [] },
    roomFinishLeader: { label: '房间结束(队长)', lines: exp.roomFinishLeader || [] },
    getGift: { label: '收到赠礼', lines: exp.getGift || [] },
    gacha: { label: '抽卡获取', lines: exp.gacha || [] }
  }
})

// Calculator logic
function getRankMaxLevel(rank) {
  const map = { 0: 10, 1: 20, 2: 30, 3: 40, 4: 50, 5: 60 }
  return map[rank] || 80
}

function handleCalcLevelChange() {
  const maxLvl = getRankMaxLevel(calcRank.value)
  // Adjust rank if level exceeds limits
  if (calcLevel.value > maxLvl) {
    // Find matching rank
    for (let r = 5; r >= 0; r--) {
      if (calcLevel.value > getRankMaxLevel(r)) {
        calcRank.value = Math.min(r + 1, 5)
        break
      }
    }
  }
}

function setCalcRank(rank) {
  calcRank.value = rank
  // Adjust level limit
  const maxLvl = getRankMaxLevel(rank)
  if (calcLevel.value > maxLvl) {
    calcLevel.value = maxLvl
  }
}

// Renders only clean, numeric attributes in computedStats
const calculatorAttributes = computed(() => {
  if (!selectedHero.value) return []
  const unit = selectedHero.value.unitData
  // Exclude strings, arrays, or administrative properties
  const exclude = ['level', 'name', 'name2', 'spType', 'tags', 'addSp']
  return Object.keys(unit).filter(key => !exclude.includes(key))
})

const growthFields = ['maxHp', 'phyAtk', 'magicAtk', 'phyDef', 'magicDef']

// Growing attributes (maxHp, phyAtk, magicAtk, phyDef, magicDef)
const growingAttributesList = computed(() => {
  return calculatorAttributes.value.filter(key => growthFields.includes(key))
})

// Static attributes (atkSpeed, crit, repelRes, etc.)
const staticAttributesList = computed(() => {
  return calculatorAttributes.value.filter(key => !growthFields.includes(key))
})

const computedStats = computed(() => {
  if (!selectedHero.value) return {}
  return calculateStats(
    selectedHero.value.unitData,
    parseInt(calcLevel.value),
    parseInt(calcRank.value),
    heroLevelConfig.value,
    heroRankConfig.value
  )
})

const computedCosts = computed(() => {
  if (!selectedHero.value) return {}
  return calculateUpgradeCosts(
    parseInt(calcLevel.value),
    parseInt(calcRank.value),
    selectedHero.value.rare,
    selectedHero.value.job,
    heroLevelConfig.value,
    heroRankConfig.value,
    consumeCache.value,
    itemsCache.value
  )
})

function translateAttributeKey(key) {
  return translateStatName(key)
}

// Inline dialogue loading and rendering
// 每个剧情分段（如 fav_hero_011_1_0）独立加载自己的剧本文件
const toggleDialogueInline = async (scriptId) => {
  if (!scriptId) return
  if (expandedDialogs.value.has(scriptId)) {
    expandedDialogs.value.delete(scriptId)
  } else {
    expandedDialogs.value.add(scriptId)
    // If not loaded, fetch from local dialogue catalog
    if (!dialogsCache.value[scriptId]) {
      loadingDialogs.value[scriptId] = true
      try {
        const baseUrl = getResourceBaseUrl()
        const res = await fetch(`${baseUrl}/data/dialogs/${scriptId}.json`)
        const direct = res.ok ? await res.json() : null
        const listExps = direct ? direct.exps || [] : []

        dialogsCache.value[scriptId] = listExps.filter(e => e.key === 'text' || e.key === 'option').map(e => {
          if (e.key === 'option') {
            return {
              isOption: true,
              options: (e.para.options || []).map(o => cleanDialogueLine(o.text))
            }
          }
          const cleanedText = cleanDialogueLine(e.para.text || '')
          if (!cleanedText) return null
          
          let sp = e.para.charaName || ''
          if (sp === '主角' || sp === '[myName]' || sp === '{myName}') {
            sp = '小工匠'
          }
          return {
            isOption: false,
            speaker: sp,
            text: cleanedText
          }
        }).filter(Boolean)
      } catch (err) {
        console.error('Failed to load dialogue script:', err)
      } finally {
        loadingDialogs.value[scriptId] = false
      }
    }
  }
}

const isDialogueExpanded = (scriptId) => {
  return expandedDialogs.value.has(scriptId)
}

const cleanDialogueLine = cleanDialogueBase

// Favorite Gifts computed property
const heroFavoriteGifts = computed(() => {
  if (!selectedHero.value || !selectedHero.value.itemFavor || !Array.isArray(selectedHero.value.itemFavor)) return []
  
  return selectedHero.value.itemFavor.map(gift => ({
    id: gift.id,
    name: gift.name,
    quality: gift.quality,
    icon: gift.img,
    value: gift.points
  })).sort((a, b) => b.value - a.value)
})

const handleGiftClick = (giftId) => {
  router.push({ query: { ...route.query, itemId: giftId } })
}
</script>

<style scoped>
/* ====== 页面骨架与筛选面板 ====== */
.heroes-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  margin: 0 0 12px 0;
  flex-shrink: 0;
  max-height: 55vh;
  overflow-y: auto;
  box-sizing: border-box;
}

/* 英雄卡网格：网格内通栏自定义列（卡面为游戏原图比例） */
.heroes-scroll :deep(.ui-card-grid) {
  padding: 4px;
}
.heroes-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}
@media (max-width: 767px) {
  .heroes-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
  }
}

/* ====== 英雄背包卡（游戏原卡面分层） ====== */
.hero-bag-card {
  position: relative;
  aspect-ratio: 184 / 280;
  width: 100%;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}
.hero-bag-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}
.bag-card-background {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 0;
  pointer-events: none;
}
.bag-card-frame {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 3;
  pointer-events: none;
}
.bag-card-avatar {
  position: absolute;
  top: 4.5%;
  left: 6.5%;
  width: 87%;
  height: 91%;
  object-fit: cover;
  z-index: 1;
  border-radius: 5px;
}
.bag-card-element {
  position: absolute;
  top: 0%; left: 0%;
  width: 32%;
  height: auto;
  aspect-ratio: 1 / 1;
  z-index: 4;
  pointer-events: none;
}
.bag-card-job {
  position: absolute;
  top: 2%; right: 3.5%;
  width: 30%;
  height: auto;
  aspect-ratio: 1 / 1;
  z-index: 5;
}
.bag-card-info {
  position: absolute;
  bottom: 5%;
  left: 0;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  z-index: 5;
}
.hero-name-label {
  font-size: clamp(10px, 3.2vw, 12px);
  font-weight: bold;
  color: #f2e1c3;
  text-shadow:
    -1px -1px 0 #2a1b12,
     1px -1px 0 #2a1b12,
    -1px  1px 0 #2a1b12,
     1px  1px 0 #2a1b12,
     0px  2px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 78%;
  margin: 0 auto;
  padding-left: 4.5%;
}

.bag-card-name-star {
  position: absolute;
  left: 13.0%;
  bottom: 9.5%;
  transform: translate(-50%, 50%);
  width: 16.8%;
  height: auto;
  aspect-ratio: 1 / 1;
  z-index: 6;
  pointer-events: none;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
}

/* ====== 详情弹窗 ====== */
.hero-modal-title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.3;
}
.hero-title-main {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--paper, #dfceb3);
  letter-spacing: 1.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.hero-subtitle {
  font-size: 11px;
  color: rgba(223, 206, 179, 0.7);
}

/* 立绘区 */
.portrait-section {
  position: relative;
  min-height: 300px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  overflow: hidden;
}
.chara-portrait-img {
  max-height: 340px;
  max-width: 90%;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}

/* 徽章行 */
.hero-badges-row-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
  justify-content: center;
}
.badge-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 2px;
}
.hero-fav-gifts-inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.fav-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.fav-gift-badge-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.fav-gift-badge-inline:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}
.fav-gift-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.fav-gift-points {
  font-size: 12px;
  font-weight: 700;
}

/* 详情页签 */
.detail-tabs {
  margin-bottom: 14px;
}
.tab-pane-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}

/* 技能选择网格 */
.skills-select-grid,
.star-skills-select-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

@media (max-width: 500px) {
  .skills-select-grid,
  .star-skills-select-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.skill-select-card,
.star-select-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.skill-select-card:hover,
.star-select-card:hover {
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}
.skill-select-card.active,
.star-select-card.active {
  background: rgba(122, 154, 153, 0.12);
  border-color: var(--accent-bright, #7a9a99);
}
.skill-select-icon,
.star-select-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(43, 31, 21, 0.10);
}
.skill-select-info,
.star-select-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}
.sk-name,
.st-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 普攻没有图标时，文字区仍保持与其他选择卡一致的可点击宽度。 */
.skill-select-card > .skill-select-info:first-child {
  flex: 1;
}

.skill-select-card :deep(.ui-tag),
.star-select-card :deep(.ui-tag) {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 技能/星阶详情面板 */
.skill-details-panel,
.star-details-panel {
  padding: 14px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  padding-bottom: 8px;
}
.skill-display-name,
.star-display-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  letter-spacing: 1px;
}
.skill-meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 等级滑块 */
.skill-level-slider-container {
  margin-bottom: 10px;
}
.slider-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.lvl-slider-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.lvl-range-slider,
.calc-range-slider {
  width: 100%;
  cursor: pointer;
  accent-color: var(--accent-bright, #7a9a99);
  height: 6px;
}
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mb-2 { margin-bottom: 8px; }

.skill-des-box {
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.lvl-subname {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-ink, #557574);
  margin-bottom: 4px;
}
.lvl-des-txt {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main, #3e2a14);
  white-space: pre-wrap;
}

/* 升级消耗 */
.upgrade-costs-box {
  background: rgba(138, 106, 31, 0.12);
  border: 1px solid rgba(138, 106, 31, 0.35);
  border-radius: 4px;
  padding: 10px 12px;
}
.cost-subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--gold, #8a6a1f);
}
.cost-req-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 8px;
}
.cost-req-cell {
  font-size: 13px;
  color: var(--text-main, #3e2a14);
}
.cost-num {
  font-weight: 700;
  color: var(--danger, #8b0000);
}
.cost-items-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.cost-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.cost-item-pill,
.mat-item-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.cost-item-img,
.mat-item-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.cost-item-name,
.mat-item-name {
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}

/* 星阶明细 */
.star-levels-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.star-level-row {
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 8px 10px;
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
}
.star-lvl-badge {
  flex-shrink: 0;
  align-self: flex-start;
  font-size: 12px;
  font-weight: 700;
  background: var(--paper-solid, #d9c6a6);
  color: var(--text-main, #3e2a14);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  padding: 2px 8px;
  border-radius: 3px;
}
.star-lvl-desc {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.shard-cost-pills {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.shard-cost-label {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
}
.shard-cost-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}
.shard-item-img-small {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.star-limits-box {
  background: rgba(138, 106, 31, 0.1);
  border: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  padding: 10px 12px;
}
.limit-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--gold, #8a6a1f);
  margin-bottom: 6px;
}
.limit-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-main, #3e2a14);
}
.limit-num {
  font-weight: 700;
  color: var(--danger, #8b0000);
}
.limit-crystal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  color: var(--accent-ink, #557574);
}
.crystal-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* ====== 计算器 ====== */
.calculator-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}
.input-slider-group {
  padding: 12px 14px;
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
.rank-selector-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.output-subheading {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  margin-bottom: 8px;
  border-left: 3px solid var(--accent-bright, #7a9a99);
  padding-left: 8px;
}
.attr-calc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
@media (max-width: 600px) {
  .attr-calc-grid {
    grid-template-columns: 1fr;
  }
}
.attr-calc-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 12px;
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
}
.attr-calc-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.attr-values-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
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
  color: var(--text-main, #3e2a14);
  font-weight: 700;
}
.static-color {
  color: var(--text-main, #3e2a14);
}
.attr-diff-pill {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  color: var(--q2, #2b7a2b);
  background: rgba(43, 122, 43, 0.14);
  border-radius: 3px;
  padding: 1px 6px;
}

.calculator-costs {
  padding: 14px;
}
.costs-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
@media (max-width: 600px) {
  .costs-summary-grid {
    grid-template-columns: 1fr;
  }
}
.cost-summary-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  background: rgba(43, 31, 21, 0.07);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
}
.cost-summary-cell.highlight {
  background: rgba(138, 106, 31, 0.14);
  border-color: rgba(138, 106, 31, 0.4);
}
.summary-label {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
}
.summary-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}
.cost-summary-cell.highlight .summary-val {
  color: var(--gold, #8a6a1f);
}
.mats-subtitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  margin-bottom: 8px;
}
.mats-flex-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ====== 档案 ====== */
.archives-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.archive-item-card {
  padding: 12px 14px;
}
.archive-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.title-side-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.archive-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  letter-spacing: 1px;
}
.archive-title.inline {
  display: inline;
}
.fav-unlock-tag {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
}
.unlock-fav-val {
  font-weight: 700;
  color: var(--gold, #8a6a1f);
}
.archive-desc-box {
  background: rgba(43, 31, 21, 0.06);
  border-left: 3px solid var(--border-color, #8f7351);
  border-radius: 0 4px 4px 0;
  padding: 8px 12px;
  margin-bottom: 8px;
}
.archive-desc-txt {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  text-align: justify;
  white-space: pre-wrap;
}
.archive-buff-banner {
  background: rgba(122, 154, 153, 0.14);
  border: 1px solid rgba(122, 154, 153, 0.4);
  border-radius: 4px;
  padding: 8px 12px;
}
.buff-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-ink, #557574);
  margin-right: 8px;
}
.buff-stats-flex {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

/* 剧情卡 */
.story-task-gate {
  background: rgba(43, 31, 21, 0.06);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 8px 12px;
}
.gate-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.gate-txt {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main, #3e2a14);
}
.mail-body-inline-box {
  background: var(--paper-solid, #d9c6a6);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  padding: 10px 14px;
  box-shadow: inset 0 2px 5px rgba(43, 31, 21, 0.12);
}
.mail-inline-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  margin-bottom: 6px;
}
.mail-inline-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  white-space: pre-wrap;
}
.story-reward-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.reward-lbl {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.reward-items-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mail-r-item-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.mail-r-item-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.mail-r-item-name {
  font-weight: 700;
  color: var(--text-main, #3e2a14);
}

/* 对话展开按钮 */
.toggle-dialogue-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  background: var(--wood, #2b1f15);
  color: var(--paper, #dfceb3);
  border: 1px solid #17100a;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  transition: all 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}
.toggle-dialogue-btn:hover {
  background: var(--wood-soft, #463424);
}
.toggle-dialogue-btn.seg-mid {
  margin-top: 6px;
}
.btn-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.seg-label {
  font-size: 11px;
  color: rgba(223, 206, 179, 0.7);
}
.btn-right {
  font-size: 12px;
  color: rgba(223, 206, 179, 0.8);
}
.dialogue-lines-container {
  margin-top: 8px;
}
.dialogue-loading-indicator,
.dialogue-error-indicator {
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  padding: 8px 0;
  font-style: italic;
}
.dialogue-error-indicator {
  color: var(--danger, #8b0000);
}

/* ====== 互动语音 ====== */
.voice-subtabs {
  margin-bottom: 12px;
}
.explore-voice-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.voice-group-card {
  padding: 12px 14px;
}
.voice-group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  margin-bottom: 8px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  padding-bottom: 6px;
}
.voice-group-title.header-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}
.fav-requirement-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--gold, #8a6a1f);
}
.event-title-label {
  font-size: 13px;
  color: var(--text-main, #3e2a14);
}
.voice-lines-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.voice-line-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(43, 31, 21, 0.06);
  border-radius: 4px;
}
.line-idx {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-ink, #557574);
  padding-top: 2px;
}
.line-content-txt {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main, #3e2a14);
}
.voicelines-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (max-width: 600px) {
  .voicelines-grid {
    grid-template-columns: 1fr;
  }
}
.voiceline-card {
  padding: 12px 14px;
}
.v-card-header {
  margin-bottom: 6px;
}
.v-text-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main, #3e2a14);
  font-style: italic;
}
</style>
