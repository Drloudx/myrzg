<template>
  <div class="page-view-container heroes-page">

    <!-- 筛选区（羊皮纸面板） -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索角色、技能、档案、互动文本（支持中英文/数字；空格=且、=或）..." />
      </template>

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
    </UiFilterPanel>

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
            :src="getImageUrl(`/images/HeroBagPanel/card_${hero.rare}_botm.webp`)"
            class="bag-card-background"
            alt="background"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
          />

          <!-- Frame Background -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/card_${hero.rare}.webp`)"
            class="bag-card-frame"
            alt="frame"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
          />

          <!-- Character Avatar -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/${hero.img}_ka.webp`)"
            :alt="hero.name"
            class="bag-card-avatar"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
          />

          <!-- Attribute Icon (Top-Left) -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/card_atr_${getElementSlug(hero.element)}.webp`)"
            class="bag-card-element"
            :title="hero.elementName"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
          />

          <!-- Class Icon (Top-Right) -->
          <img
            :src="getImageUrl(`/images/HeroBagPanel/class_icon_s_${getJobSlug(hero.job)}.webp`)"
            class="bag-card-job"
            :title="hero.jobName"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
          />

          <!-- Bottom Card Info Overlay -->
          <div class="bag-card-info">
            <div class="hero-name-label">{{ hero.name }}</div>
          </div>

          <!-- Nameplate Star Icon (Bottom-Left Diamond) -->
          <img
            :src="getImageUrl('/PicHandBookPanel_Atlas/colect_star.webp')"
            class="bag-card-name-star"
            alt="star"
            loading="lazy"
            decoding="async"
            @error="handleCardImgError"
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
        <div class="portrait-section paper-panel corner-nails" :class="{ 'portrait-section--protagonist': isProtagonist }">
          <template v-if="isProtagonist">
            <UiButton class="protagonist-portrait-toggle" size="sm" variant="secondary"
              :aria-label="protagonistGender === 'female' ? '切换男主' : '切换女主'"
              @click="protagonistGender = protagonistGender === 'female' ? 'male' : 'female'">
              {{ protagonistGender === 'female' ? '切换男主' : '切换女主' }}
            </UiButton>
            <!-- 模型图模式：与立绘模式同样处理——桌面端男女模型**并列显示**，手机端只显示选中性别 -->
            <template v-if="showHeroModel">
              <div v-for="variant in protagonistModels" :key="variant.gender"
                class="protagonist-portrait-slot" :class="{ 'is-selected': protagonistGender === variant.gender }">
                <img :src="getImageUrl(variant.image)"
                  :alt="`${selectedHero.name}（${variant.gender === 'female' ? '女主' : '男主'}）模型图`"
                  class="chara-model-img"
                  @error="handleModelImgError" />
              </div>
            </template>
            <template v-else>
              <div v-for="portrait in protagonistPortraits" :key="portrait.gender"
                class="protagonist-portrait-slot" :class="{ 'is-selected': protagonistGender === portrait.gender }">
                <img :src="getImageUrl(portrait.image)" :alt="portrait.label"
                  class="chara-portrait-img" @error="handlePortraitImgError" />
              </div>
            </template>
            <!-- 切换「立绘 / 模型图」：手机端由 CSS 放到性别切换按钮**下面** -->
            <UiButton v-if="hasHeroModel" class="hero-model-toggle" size="sm" variant="secondary"
              :aria-label="showHeroModel ? '切换到立绘' : '切换到模型图'"
              @click="showHeroModel = !showHeroModel">
              {{ showHeroModel ? '立绘' : '模型' }}
            </UiButton>
          </template>
          <template v-else>
            <img
              v-if="!showHeroModel"
              :src="getImageUrl(`/images/chara/l/${selectedHero.img}.webp`)"
              :alt="selectedHero.name"
              class="chara-portrait-img"
              @error="handlePortraitImgError"
            />
            <!-- 角色模型图（Q 版小人立绘）：与立绘同区二选一，叠在立绘区域右下角 -->
            <img
              v-else-if="heroModelImage"
              :src="getImageUrl(heroModelImage)"
              :alt="heroModelAlt"
              class="chara-model-img"
              @error="handleModelImgError"
            />
            <!-- 切换「立绘 / 模型图」：仅对**有模型图**的角色显示 -->
            <UiButton v-if="hasHeroModel" class="hero-model-toggle" size="sm" variant="secondary"
              :aria-label="showHeroModel ? '切换到立绘' : '切换到模型图'"
              @click="showHeroModel = !showHeroModel">
              {{ showHeroModel ? '立绘' : '模型' }}
            </UiButton>
          </template>
        </div>

        <!-- Badges & Favorite Gifts Row -->
        <div class="hero-badges-row-container">
          <button
            type="button"
            class="job-badge-button"
            :class="{ 'is-expanded': isJobDetailExpanded }"
            :aria-expanded="isJobDetailExpanded"
            aria-controls="hero-job-traits"
            :title="`${isJobDetailExpanded ? '收起' : '查看'}${selectedHero.jobName}职业特性`"
            @click="isJobDetailExpanded = !isJobDetailExpanded"
          >
            <UiTag tone="default" class="badge job-badge">
              <img :src="getImageUrl(`/images/HeroBagPanel/class_icon_s_${getJobSlug(selectedHero.job)}.webp`)" class="badge-icon" />
              {{ selectedHero.jobName }}
              <span class="job-badge-chevron" aria-hidden="true"></span>
            </UiTag>
          </button>
          <UiTag tone="accent" class="badge element-badge">
            <img :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${getSpGachaElementSlug(selectedHero.element)}03.webp`)" class="badge-icon" />
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

        <Transition name="job-traits">
          <section
            v-if="isJobDetailExpanded && selectedHero.jobTraits?.length"
            id="hero-job-traits"
            class="job-traits-panel"
            :aria-label="`${selectedHero.jobName}职业特性`"
          >
            <div class="job-traits-heading">
              <img
                :src="getImageUrl(`/images/HeroBagPanel/class_icon_s_${getJobSlug(selectedHero.job)}.webp`)"
                class="job-traits-icon"
                alt=""
              />
              <div>
                <span class="job-traits-kicker">职业特性</span>
                <strong>{{ selectedHero.jobName }}</strong>
              </div>
            </div>
            <div class="job-traits-list">
              <div v-for="trait in selectedHero.jobTraits" :key="trait.id" class="job-trait-item">
                <div class="job-trait-name">{{ trait.name }}</div>
                <p class="job-trait-description" v-html="formatSkillDescription(trait.des)"></p>
              </div>
            </div>
          </section>
        </Transition>

        <!-- MIDDLE SECTION: Tabs Navigation -->
        <div class="detail-tabs">
          <UiTabs
            v-model="activeTab"
            :options="heroDetailTabs"
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
                  :src="getImageUrl(`/images/Common_SkillIcon/${skill.icon}.webp`)"
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
                  :src="getImageUrl(`/images/Common_SkillIcon/${talent.icon}.webp`)"
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
              <div class="panel-header skill-panel-header">
                <h4 class="skill-display-name">{{ currentSelectedSkill.name }}</h4>
                <div class="skill-meta-tags" v-if="currentSelectedSkill.type !== 'talent'">
                  <UiTag v-if="Number(currentSelectedSkillLevelDetail?.cd) > 0" tone="accent">CD: {{ currentSelectedSkillLevelDetail.cd }}s</UiTag>
                  <UiTag v-if="Number(currentSelectedSkillLevelDetail?.cost) > 0" tone="accent">消耗: {{ currentSelectedSkillLevelDetail.cost }}</UiTag>
                </div>
                <UiTag v-else tone="default">核心被动天赋</UiTag>
              </div>

              <!-- Levels sliders for skill -->
              <div class="skill-level-slider-container" v-if="currentSelectedSkill.type !== 'normal' && currentSelectedSkill.levelData?.length > 1">
                <div class="dual-slider-labels">
                  <span class="lvl-slider-label">当前等级: Lv.{{ currentSkillLevel }}</span>
                  <span class="lvl-slider-label">目标等级: Lv.{{ targetSkillLevel }}</span>
                </div>
                <div
                  class="dual-level-slider"
                  :style="skillSliderStyle"
                  :aria-label="`技能等级范围，当前等级 ${currentSkillLevel}，目标等级 ${targetSkillLevel}`"
                  role="group"
                  @click="handleSkillTrackClick"
                >
                  <span class="dual-slider-track" aria-hidden="true"></span>
                  <span class="dual-slider-fill" aria-hidden="true"></span>
                  <input
                    type="range"
                    min="1"
                    :max="skillLevelMax"
                    v-model.number="currentSkillLevel"
                    class="dual-slider-input dual-slider-input--current"
                    aria-label="当前技能等级"
                    @input="handleCurrentSkillLevelInput"
                  />
                  <input
                    type="range"
                    min="1"
                    :max="skillLevelMax"
                    v-model.number="targetSkillLevel"
                    class="dual-slider-input dual-slider-input--target"
                    aria-label="目标技能等级"
                    @input="handleTargetSkillLevelInput"
                  />
                </div>
                <div class="dual-slider-scale" aria-hidden="true">
                  <span>Lv.1</span>
                  <span>Lv.{{ skillLevelMax }}</span>
                </div>
              </div>

              <!-- Level Description -->
              <div class="skill-des-box" v-if="currentSelectedSkillLevelDetail">
                <div class="lvl-subname">{{ currentSelectedSkillLevelDetail.name }}</div>
                <p class="lvl-des-txt" v-html="formatSkillDescription(currentSelectedSkillLevelDetail.des)"></p>
              </div>

              <!-- Combat settlement summary -->
              <div v-if="currentSkillMechanics" class="skill-mechanics-box">
                <div class="mechanics-row mechanics-settlement-row">
                  <span class="mechanics-label">结算</span>
                  <UiTag v-if="currentSkillMechanics.damage?.formLabel" tone="default">{{ currentSkillMechanics.damage.formLabel }}</UiTag>
                  <UiTag v-for="label in currentSkillMechanics.damage?.typeLabels" :key="`type-${label}`" tone="danger">{{ label }}</UiTag>
                  <UiTag v-for="label in currentSkillMechanics.damage?.elementLabels" :key="`element-${label}`" tone="accent">{{ label }}属性</UiTag>
                  <UiTag v-if="currentSkillMechanics.damage?.crit && currentSkillMechanics.damage.crit !== 'na'" :tone="critTone(currentSkillMechanics.damage.crit)">{{ critLabel(currentSkillMechanics.damage.crit) }}</UiTag>
                </div>
                <div v-if="currentSkillMechanics.outcomeLabels?.length && !(currentSkillMechanics.outcomeLabels.length === 1 && currentSkillMechanics.outcomeLabels[0] === '伤害')" class="mechanics-row">
                  <span class="mechanics-label">效果类型</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.outcomeLabels.join('、') }}</span>
                </div>
                <div v-if="currentSkillMechanics.damage?.scalingLabels?.length" class="mechanics-row">
                  <span class="mechanics-label">加成基准</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.damage.scalingLabels.join('、') }}</span>
                </div>
                <div v-if="currentSkillMechanics.effectScalingLabels?.length && currentSkillMechanics.outcomeLabels?.some(label => label !== '伤害')" class="mechanics-row">
                  <span class="mechanics-label">效果基准</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.effectScalingLabels.join('、') }}</span>
                </div>
                <div v-if="currentSkillMechanics.bonuses?.applies?.length" class="mechanics-row">
                  <span class="mechanics-label">加成生效</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.bonuses.applies.map(mechanicsLabel).join(' · ') }}</span>
                </div>
                <div v-if="currentSkillMechanics.features?.length" class="mechanics-row">
                  <span class="mechanics-label">攻击特性</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.features.join(' · ') }}</span>
                </div>
                <div v-if="currentSkillMechanics.effects?.length" class="mechanics-row">
                  <span class="mechanics-label">附加效果</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.effects.join(' · ') }}</span>
                </div>
                <div v-if="currentSkillMechanics.bonuses?.excludes?.length" class="mechanics-row mechanics-muted-row">
                  <span class="mechanics-label">不生效</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.bonuses.excludes.map(mechanicsLabel).join(' · ') }}</span>
                </div>
                <div v-if="currentSkillMechanics.conditions?.length" class="mechanics-row mechanics-condition-row">
                  <span class="mechanics-label">条件变化</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.conditions.join('；') }}</span>
                </div>
                <div v-if="currentSkillMechanics.notes?.length" class="mechanics-row mechanics-note-row">
                  <span class="mechanics-label">实际说明</span>
                  <span class="mechanics-text">{{ currentSkillMechanics.notes.join('；') }}</span>
                </div>
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
                  <button
                    v-for="item in skillUpgradeRangeSummary.items"
                    :key="item.id"
                    type="button"
                    class="cost-item-pill"
                    :data-item-id="item.id"
                    :title="`${item.name}（点击查看物品）`"
                    @click="openItemDetail(item.id)"
                  >
                    <img :src="getImageUrl(item.img)" class="cost-item-img" />
                    <span class="cost-item-name" :class="`quality-text-${item.quality}`">{{ item.name }} x{{ item.num }}</span>
                  </button>
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
                  :src="getImageUrl(`/images/Common_SkillIcon/${star.icon}.webp`)"
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
                        <img :src="getImageUrl(`/images/HeroInfoPanel_Atlas/${selectedHero.img}_p.webp`)" class="shard-item-img-small" />
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
                      <img :src="getImageUrl('/Common_ItemIcon/item_20026.webp')" class="crystal-icon" />
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
          <UiSection title="等级、升星与基础属性">
            <!-- Calculator Sliders -->
            <div class="calculator-inputs">
              <div class="input-slider-group paper-panel-solid">
                <div class="slider-header">
                  <label class="slider-title" for="hero-calc-level">目标等级</label>
                  <span class="slider-val">{{ calcLevel }} / {{ maxHeroLevel }} · 等级突破 {{ calcRank }} 次</span>
                </div>
                <input
                  id="hero-calc-level"
                  type="range"
                  min="1"
                  :max="maxHeroLevel"
                  v-model.number="calcLevel"
                  class="calc-range-slider"
                />
                <div class="level-growth-summary">
                  <span>每级基础属性 +{{ formatRate(heroLevelGrowthRate) }}</span>
                  <span>突破累计 +{{ formatRate(heroBreakthroughTotalRate) }}</span>
                </div>
                <label v-if="breakthroughAtLevel" class="breakthrough-toggle">
                  <input type="checkbox" v-model="includeCurrentBreakthrough" />
                  已完成 {{ calcLevel }} 级突破（基础属性 +{{ formatRate(breakthroughAtLevel.attUp) }}）
                </label>
              </div>
              <div class="input-slider-group paper-panel-solid">
                <div class="slider-header">
                  <label class="slider-title" for="hero-calc-stars">升星次数</label>
                  <span class="slider-val">{{ calcStarCount }} / {{ maxStarCount }}</span>
                </div>
                <input id="hero-calc-stars" type="range" min="0" :max="maxStarCount" v-model.number="calcStarCount" class="calc-range-slider" />
                <div class="level-growth-summary">
                  <span>每次基础属性 +{{ formatRate(starGrowthRate) }}</span>
                  <span>升星累计 +{{ formatRate(starGrowthRate * calcStarCount) }}</span>
                </div>
                <p class="calculator-explanation">每提升一级星阶技能算一次，四组已升级等级相加。</p>
              </div>
            </div>
            <p class="calculator-explanation growth-formula">五项基础属性 = 原始值 ×（1 + 等级加成 {{ formatRate((calcLevel - 1) * heroLevelGrowthRate) }} + 升星加成 {{ formatRate(calcStarCount * starGrowthRate) }} + 突破加成 {{ formatRate(heroBreakthroughTotalRate) }}）</p>
            <p class="calculator-explanation">这里只模拟等级、升星次数和突破的基础成长，星阶技能本身的属性效果及装备、潜能、档案、营地等加成另算。</p>

            <!-- Calculated Attributes Grid -->
            <div class="calculator-outputs mt-4">
              <div class="output-subheading">基础属性</div>
              <div class="attr-calc-grid">
                <div
                  v-for="field in growingAttributesList"
                  :key="field"
                  :data-attribute="field"
                  class="attr-calc-card"
                >
                  <span class="attr-calc-label">{{ translateAttributeKey(field) }}</span>
                  <div class="attr-values-row">
                    <span class="attr-val-calc">{{ computedStats[field] }}</span>
                  </div>
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
                  <button
                    v-for="item in computedCosts.breakthroughItems"
                    :key="item.id"
                    type="button"
                    class="mat-item-pill"
                    :data-item-id="item.id"
                    :title="`${item.name}（点击查看物品）`"
                    @click="openItemDetail(item.id)"
                  >
                    <img :src="getImageUrl(item.img)" class="mat-item-img" />
                    <span class="mat-item-name" :class="`quality-text-${item.quality}`">{{ item.name }} x{{ item.num }}</span>
                  </button>
                </div>
              </div>
            </div>
          </UiSection>
        </div>

        <HeroStoryPanels
          v-if="activeTab === 'archives' || activeTab === 'voicelines'"
          :hero="selectedHero"
          :active-tab="activeTab"
        />

        <HeroSkinsPanel
          v-if="activeTab === 'skins'"
          :skins="selectedHero.skins"
        />
      </template>

      <UiBackToTop scroll-container="#heroModalScroll" />
    </UiModal>

    <UiBackToTop scroll-container="#heroesGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getImageUrl } from '../utils/env'
import { fetchItemData } from '../utils/itemParser'
import { fetchHeroData, calculateStats, calculateUpgradeCosts } from '../utils/heroParser'
import { MECHANICS_CRIT_LABELS, MECHANICS_LABELS } from '../utils/heroMechanics.js'
import { isBlacklisted } from '../config/blacklist.js'
import { useLazyList } from '../composables/useLazyList'
import {
  JOB_NAMES,
  JOB_SLUGS,
  ELEMENT_NAMES,
  ELEMENT_SLUGS,
  ELEMENT_SLUGS_LOWER,
  formatHighlightedText,
  translateStatName
} from '../utils/gameMappings'
import HeroStoryPanels from '../components/heroes/HeroStoryPanels.vue'
import HeroSkinsPanel from '../components/heroes/HeroSkinsPanel.vue'
import { hasHeroModel as hasHeroModelFor, getHeroModelImage } from '../utils/heroModels.js'
import {
  UiBackToTop,
  UiButton,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiModal,
  UiFilterPanel, UiSearchInput,
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
const playerLevelCap = ref(1)
const itemsCache = ref([])
const consumeCache = ref({})
const isDataReady = ref(false)
const errorMessage = ref('')

/**
 * items.json 只服务于「等级突破」材料的名称与图标解析（calculateUpgradeCosts），
 * 角色列表本身不消费它。这里按需加载：只在首次打开角色详情时取，
 * 避免只浏览列表就拉入整张物品表（移动端在线走 CDN，同样经 manifest 版本校验）。
 * 失败不阻断详情，材料回落为 typeId + 空图标（heroParser 已有兜底）。
 */
let itemsLoadPromise = null
const loadItemsOnce = () => {
  if (!itemsLoadPromise) {
    itemsLoadPromise = fetchItemData()
      .then(coreData => { itemsCache.value = coreData.items })
      .catch(err => {
        console.error('Error loading item data for breakthrough costs:', err)
        itemsLoadPromise = null
      })
  }
  return itemsLoadPromise
}

// Filter states
const searchQuery = ref('')
const selectedRarity = ref(null)
const selectedJob = ref(null)
const selectedElement = ref(null)

// Detail modal states
const detailVisible = ref(false)
const selectedHero = ref(null)
// ExtentionMethod.SetSexHeroImg: hero_001 的男版立绘为 chara001b_0。
const isProtagonist = computed(() => selectedHero.value?.id === 'hero_001')
const protagonistGender = ref('female')
/** 立绘区显示的是「模型图」还是「立绘」；仅对有模型图的角色有效 */
const showHeroModel = ref(false)
const hasHeroModel = computed(() => hasHeroModelFor(selectedHero.value?.id))
// 主角传当前性别以取对应模型（女主 hero_001 / 男主 hero_001_male）；其他角色忽略该参数
const heroModelImage = computed(() => getHeroModelImage(selectedHero.value?.id, protagonistGender.value))
const heroModelAlt = computed(() => isProtagonist.value
  ? `${selectedHero.value?.name || ''}（${protagonistGender.value === 'female' ? '女主' : '男主'}）模型图`
  : `${selectedHero.value?.name || ''}模型图`)
const protagonistPortraits = [
  { gender: 'female', label: '希尔（女主）', image: '/images/chara/l/chara001_0.webp' },
  { gender: 'male', label: '希尔（男主）', image: '/images/chara/l/chara001b_0.webp' }
]
/**
 * 主角的 Q 版模型（两个性别）。
 *
 * 与立绘同样处理：桌面端**并列显示**男女两个模型，手机端由 CSS 只显示选中性别
 * （`.protagonist-portrait-slot:not(.is-selected){display:none}`）。
 * 男主模型不在 hero.json 里，是用导出工具单独生成的，详见 utils/heroModels.js。
 */
const protagonistModels = [
  { gender: 'female', image: '/images/chara/Q/hero_001.webp' },
  { gender: 'male', image: '/images/chara/Q/hero_001_male.webp' }
]
const activeTab = ref('skills')

// Tab specific states
const activeSkillIndex = ref(0)
const currentSkillLevel = ref(1)
const activeStarIndex = ref(0)
const calcLevel = ref(1)
const calcStarCount = ref(0)
const includeCurrentBreakthrough = ref(true)
const isJobDetailExpanded = ref(false)

// Job names mapping array
const jobsList = Object.values(JOB_NAMES)
const heroDetailTabs = computed(() => {
  const tabs = [
    { value: 'skills', label: '技能星阶' },
    { value: 'calculator', label: '基础属性' },
    { value: 'archives', label: '角色档案' },
    { value: 'voicelines', label: '互动' }
  ]
  if (selectedHero.value?.skins?.length) {
    tabs.splice(3, 0, { value: 'skins', label: '皮肤' })
  }
  return tabs
})

// 角色页搜索使用页面可见文本汇总，不把图片路径、内部 ID 等实现字段暴露为搜索结果。
// 这样新增技能/档案字段时，只要页面能展示该文本，搜索也会自动覆盖。
const SEARCH_IGNORED_KEYS = new Set([
  'id', 'key', 'icon', 'img', 'vocal', 'face', 'dialog', 'taskTypeId',
  'consumeKey', 'typeId', 'sourceRefs', 'reviewStatus', 'spType', 'type'
])

// 机制标签没有单独的英文表，搜索时补充常用英文别名，中文页面文本仍是唯一展示来源。
const SEARCH_LABEL_ALIASES = {
  '物理': 'physical phy',
  '魔法': 'magic magical spell',
  '真实': 'true real',
  '水': 'water',
  '火': 'fire flame',
  '风': 'wind',
  '地': 'earth',
  '物理攻击': 'physical attack phy atk',
  '魔法攻击': 'magic attack magic atk spell power',
  '普通攻击': 'normal attack basic attack',
  '技能伤害': 'skill damage ability damage',
  '伤害': 'damage',
  '持续伤害': 'damage over time dot',
  '护盾': 'shield',
  '治疗': 'heal healing',
  '召唤': 'summon',
  '属性增益': 'buff boost',
  '属性削弱': 'debuff',
  '属性继承': 'inherit inheritance',
  '伤害减免': 'damage reduction damage taken reduction',
  '控制': 'control crowd control cc',
  '暴击': 'crit critical',
  '最大生命': 'max hp maximum health',
  '物理穿透': 'physical penetration armor penetration',
  '魔法穿透': 'magic penetration',
  '范围': 'area aoe',
  '多段': 'multi hit multihit',
  '持续': 'duration',
  '反伤': 'reflect counter damage',
  '近卫': 'vanguard guard',
  '守护': 'defender tank guard 护卫',
  '秘术': 'mage caster',
  '射手': 'archer ranged',
  '突袭': 'assassin rogue',
  '支援': 'support healer'
}

const getSearchAliases = (value, mapped = '') => {
  const labels = [value, mapped].filter(Boolean)
  return labels
    .flatMap(label => [label, SEARCH_LABEL_ALIASES[label] || ''])
    .filter(Boolean)
    .join(' ')
}

const collectHeroSearchText = (value, key = '', seen = new Set()) => {
  if (value == null || SEARCH_IGNORED_KEYS.has(key)) return ''

  if (typeof value === 'string') {
    const mapped = MECHANICS_LABELS[value]
    return getSearchAliases(value, mapped)
  }

  // 数值也是页面可见信息（等级、星级、百分比等），允许直接搜索数字。
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map(item => collectHeroSearchText(item, '', seen)).join(' ')
  }

  return Object.entries(value)
    .map(([childKey, childValue]) => collectHeroSearchText(childValue, childKey, seen))
    .join(' ')
}

const heroSearchTextCache = new WeakMap()
const getHeroSearchText = hero => {
  if (!hero || typeof hero !== 'object') return ''
  const cached = heroSearchTextCache.get(hero)
  if (cached) return cached

  const rarityText = `${hero.rare ?? ''}星 ${hero.rare ?? ''} star rarity`
  const text = `${rarityText} ${collectHeroSearchText(hero)}`.toLowerCase()
  heroSearchTextCache.set(hero, text)
  return text
}

onMounted(async () => {
  try {
    const parsedData = await fetchHeroData()
    allHeroes.value = parsedData.heroes
    heroLevelConfig.value = parsedData.heroLevel
    heroRankConfig.value = parsedData.heroRank
    playerLevelCap.value = Number(parsedData.playerLevelCap) || 1
    
    // 累计计算器所需消耗表已内置在预解析 heroes.json 中。
    consumeCache.value = parsedData.consumeDatas || {}

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
    // 详情才需要物品表（突破材料名称/图标）；不 await，详情先渲染，材料到位后计算属性自行重算。
    loadItemsOnce()
    protagonistGender.value = 'female'
    showHeroModel.value = false
    detailVisible.value = true
    // Reset tabs
    activeTab.value = route.query.tab === 'skins' && found.skins?.length ? 'skins' : 'skills'
    activeSkillIndex.value = 0
    currentSkillLevel.value = 1
    activeStarIndex.value = 0
    calcLevel.value = 1
    calcStarCount.value = 0
    includeCurrentBreakthrough.value = true
    isJobDetailExpanded.value = false
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
    // 空格表示“且”，同一组中的“、/逗号/|”表示“或”。
    const termGroups = searchQuery.value.trim().toLowerCase()
      .split(/\s+/)
      .map(group => group.split(/[、,，|/]+/).filter(Boolean))
      .filter(group => group.length)
    result = result.filter(hero => {
      const searchText = getHeroSearchText(hero)
      return termGroups.every(group => group.some(term => searchText.includes(term)))
    })
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
  isJobDetailExpanded.value = false
  selectedHero.value = null
}

// Image fallback handlers
function handleCardImgError(e) {
  e.target.style.opacity = '0.3'
}

function handlePortraitImgError(e) {
  e.target.style.display = 'none'
}

/** 模型图加载失败：退回立绘（而不是留一块空白），并避免重复触发 */
function handleModelImgError(e) {
  e.target.onerror = null
  showHeroModel.value = false
}

function handleSkillIconError(e) {
  // Use a generic skill icon fallback
  e.target.src = '/ui/item_00002.webp'
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

const skillLevelMax = computed(() => Math.max(
  1,
  Number(currentSelectedSkill.value?.maxLevel || currentSelectedSkill.value?.levelData?.length || 1)
))

const skillSliderStyle = computed(() => {
  const max = skillLevelMax.value
  const position = level => max <= 1 ? 0 : ((Number(level) - 1) / (max - 1)) * 100
  return {
    '--skill-level-start': `${position(currentSkillLevel.value)}%`,
    '--skill-level-end': `${position(targetSkillLevel.value)}%`
  }
})

const handleCurrentSkillLevelInput = event => {
  const next = Number(event.target.value)
  currentSkillLevel.value = Math.min(next, Number(targetSkillLevel.value))
}

const handleTargetSkillLevelInput = event => {
  const next = Number(event.target.value)
  targetSkillLevel.value = Math.max(next, Number(currentSkillLevel.value))
}

const handleSkillTrackClick = event => {
  if (event.target instanceof HTMLInputElement) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const level = Math.round(ratio * (skillLevelMax.value - 1)) + 1
  targetSkillLevel.value = Math.max(level, Number(currentSkillLevel.value))
}

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

const mechanicsLabel = key => MECHANICS_LABELS[key] || key
const critLabel = value => MECHANICS_CRIT_LABELS[value] || value
const critTone = value => ({ yes: 'default', no: 'danger', conditional: 'accent', guaranteed: 'gold', unknown: 'default', na: 'default' }[value] || 'default')

const currentSelectedSkillLevelDetail = computed(() => {
  const skill = currentSelectedSkill.value
  if (!skill || !skill.levelData) return null
  const detail = skill.levelData.find(l => l.level === parseInt(currentSkillLevel.value))
  return detail || skill.levelData[0] || null
})

const currentSkillMechanics = computed(() => currentSelectedSkillLevelDetail.value?.mechanics || null)

// Star skill selected
const currentSelectedStarSkill = computed(() => {
  if (!selectedHero.value || !selectedHero.value.starSkills) return null
  return selectedHero.value.starSkills[activeStarIndex.value] || null
})

// Calculator logic
const heroRankOptions = computed(() => {
  const rankMap = heroRankConfig.value?.heroRank || {}
  return Object.values(rankMap)
    .filter(rank => Number.isFinite(Number(rank?.rank)) && Number(rank?.heroMaxLevel) > 0)
    .map(rank => Number(rank.rank))
    .sort((a, b) => a - b)
})

const maxHeroLevel = computed(() => {
  const rankMap = heroRankConfig.value?.heroRank || {}
  const rankMax = Math.max(1, ...heroRankOptions.value.map(rank => Number(rankMap[String(rank)]?.heroMaxLevel || 1)))
  return Math.min(rankMax, playerLevelCap.value)
})

const calcRank = computed(() => {
  const level = Number(calcLevel.value || 1)
  const rankMap = heroRankConfig.value?.heroRank || {}
  for (const rank of heroRankOptions.value) {
    const limit = Number(rankMap[String(rank)]?.heroMaxLevel || 0)
    if (level < limit || (level === limit && !includeCurrentBreakthrough.value)) return rank
  }
  return heroRankOptions.value.at(-1) || 0
})

const breakthroughAtLevel = computed(() => {
  const rankMap = heroRankConfig.value?.heroRank || {}
  return heroRankOptions.value.slice(0, -1)
    .map(rank => rankMap[String(rank)])
    .find(rank => Number(rank.heroMaxLevel) === Number(calcLevel.value))
})

const growthFields = ['maxHp', 'phyAtk', 'magicAtk', 'phyDef', 'magicDef']

const formatGrowthValue = value => {
  const rounded = Math.round(Number(value || 0) * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '')
}

const formatRate = rate => `${formatGrowthValue(Number(rate || 0) * 100)}%`

const heroLevelGrowthRate = computed(() => Number(heroLevelConfig.value?.attUp ?? 0.05))
const heroBreakthroughTotalRate = computed(() => {
  return heroRankOptions.value.filter(rank => rank < calcRank.value)
    .reduce((sum, rank) => sum + Number(heroRankConfig.value?.heroRank?.[String(rank)]?.attUp || 0), 0)
})
const starGrowthRate = computed(() => Number(selectedHero.value?.starGrowthRate ?? 0.01))
const maxStarCount = computed(() => Number(selectedHero.value?.maxStarCount ?? 0))

// Renders only clean, numeric attributes in computedStats
const calculatorAttributes = computed(() => {
  if (!selectedHero.value) return []
  const unit = selectedHero.value.unitData
  // Exclude strings, arrays, or administrative properties
  const exclude = ['level', 'name', 'name2', 'spType', 'tags', 'addSp']
  return Object.keys(unit).filter(key => !exclude.includes(key))
})

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
    heroRankConfig.value,
    calcStarCount.value,
    starGrowthRate.value
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
  // 角色原始 unitData 的 atkSpeed 是次/秒；装备、档案等同名字段仍为百分比加成。
  if (key === 'atkSpeed') return '基础攻速'
  return translateStatName(key)
}

// Favorite Gifts computed property// Favorite Gifts computed property
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

const openItemDetail = (itemId) => {
  if (!itemId) return
  router.push({ query: { ...route.query, itemId } })
}

const handleGiftClick = (giftId) => {
  openItemDetail(giftId)
}
</script>

<style scoped>
/* ====== 页面骨架与筛选面板 ====== */
.heroes-page {
  height: 100%;
  display: flex;
  flex-direction: column;
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
.portrait-section--protagonist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  height: 340px;
}
.protagonist-portrait-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 100%;
}
.protagonist-portrait-slot .chara-portrait-img {
  width: 90%;
  height: 340px;
}
/* 模型图（Q 版小人）：与立绘同区二选一，不设 max-width 让 90% 生效 */
.chara-model-img {
  max-height: 340px;
  width: 90%;
  height: 340px;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}
/* 切换「立绘 / 模型图」：叠在立绘区右上角（与主角的性别切换同一位置）；仅对有模型图的角色渲染 */
.hero-model-toggle {
  position: absolute;
  right: 8px;
  top: 8px;
  z-index: 1;
  min-height: 32px;
}
.protagonist-portrait-toggle { display: none; }
@media (max-width: 640px) {
  .portrait-section--protagonist {
    grid-template-columns: minmax(0, 1fr);
  }
  .protagonist-portrait-slot:not(.is-selected) { display: none; }
  .protagonist-portrait-toggle {
    display: inline-flex;
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    min-height: 32px;
  }
  /* 主角页手机端两个按钮都在右上角：模型切换放在性别切换**下面**避免重叠 */
  .portrait-section--protagonist .hero-model-toggle {
    top: 46px;
  }
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
.job-badge-button {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.job-badge-button:focus-visible {
  outline: 2px solid var(--accent-ink, #557574);
  outline-offset: 3px;
  border-radius: 4px;
}
.job-badge-button .job-badge {
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}
.job-badge-button:hover .job-badge,
.job-badge-button.is-expanded .job-badge {
  border-color: var(--accent-ink, #557574);
  background: rgba(85, 117, 116, 0.12);
  box-shadow: 0 2px 5px rgba(43, 31, 21, 0.16);
}
.job-badge-chevron {
  width: 6px;
  height: 6px;
  margin: -3px 1px 0 4px;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.18s ease, margin 0.18s ease;
}
.job-badge-button.is-expanded .job-badge-chevron {
  margin-top: 3px;
  transform: rotate(225deg);
}
.job-traits-panel {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 16px;
  margin: -2px 0 14px;
  padding: 13px 14px;
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 4px;
  background: rgba(85, 117, 116, 0.07);
  box-shadow: 0 1px 3px rgba(43, 31, 21, 0.1);
}
.job-traits-heading {
  display: flex;
  align-items: center;
  justify-self: center;
  gap: 9px;
  color: var(--text-main, #3e2a14);
}
.job-traits-icon {
  width: 30px;
  height: 30px;
  object-fit: contain;
}
.job-traits-heading strong,
.job-traits-kicker {
  display: block;
}
.job-traits-heading strong {
  margin-top: 2px;
  font-size: 14px;
}
.job-traits-kicker {
  color: var(--text-muted, #6b5134);
  font-size: 11px;
}
.job-traits-list {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.job-trait-item + .job-trait-item {
  padding-top: 10px;
  border-top: 1px dashed var(--border-faint, rgba(143, 115, 81, 0.25));
}
.job-trait-name {
  margin-bottom: 4px;
  color: var(--text-main, #3e2a14);
  font-size: 13px;
  font-weight: 700;
}
.job-trait-description {
  margin: 0;
  color: var(--text-muted, #6b5134);
  font-size: 13px;
  line-height: 1.65;
}
.job-traits-enter-active,
.job-traits-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.job-traits-enter-from,
.job-traits-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
@media (max-width: 560px) {
  .job-traits-panel {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 12px;
  }
  .job-traits-heading {
    justify-self: center;
  }
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
.skill-panel-header {
  justify-content: flex-start;
  column-gap: 12px;
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
.lvl-slider-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
}
.dual-slider-labels {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.dual-level-slider {
  position: relative;
  height: 28px;
  margin: 0 8px;
  cursor: pointer;
}
.dual-slider-track,
.dual-slider-fill {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: 999px;
  transform: translateY(-50%);
  pointer-events: none;
}
.dual-slider-track {
  background: var(--border-color, #8f7351);
}
.dual-slider-fill {
  left: var(--skill-level-start);
  right: calc(100% - var(--skill-level-end));
  background: var(--accent-bright, #7a9a99);
}
.dual-slider-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 28px;
  margin: 0;
  appearance: none;
  background: transparent;
  pointer-events: none;
  cursor: pointer;
}
.dual-slider-input--current {
  z-index: 2;
}
.dual-slider-input--target {
  z-index: 3;
}
.dual-slider-input:focus-visible {
  outline: none;
}
.dual-slider-input::-webkit-slider-runnable-track {
  height: 6px;
  background: transparent;
}
.dual-slider-input::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -5px;
  appearance: none;
  border: 2px solid var(--paper-soft, #e9dcc3);
  border-radius: 50%;
  background: var(--accent-bright, #7a9a99);
  box-shadow: 0 1px 4px rgba(43, 31, 21, 0.3);
  pointer-events: auto;
  cursor: grab;
}
.dual-slider-input:active::-webkit-slider-thumb {
  cursor: grabbing;
  box-shadow: 0 2px 7px rgba(43, 31, 21, 0.38);
}
.dual-slider-input::-moz-range-track {
  height: 6px;
  background: transparent;
}
.dual-slider-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid var(--paper-soft, #e9dcc3);
  border-radius: 50%;
  background: var(--accent-bright, #7a9a99);
  box-shadow: 0 1px 4px rgba(43, 31, 21, 0.3);
  pointer-events: auto;
  cursor: grab;
}
.dual-slider-input:active::-moz-range-thumb {
  cursor: grabbing;
  box-shadow: 0 2px 7px rgba(43, 31, 21, 0.38);
}
.dual-slider-input:focus-visible::-webkit-slider-thumb,
.dual-slider-input:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--accent-ink, #557574);
  outline-offset: 2px;
}
.dual-slider-scale {
  display: flex;
  justify-content: space-between;
  margin: 2px 8px 0;
  color: var(--text-muted, #6b5134);
  font-size: 11px;
}
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

.skill-mechanics-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: -2px 0 10px;
  padding: 9px 12px;
  border-left: 3px solid var(--accent-bright, #7a9a99);
  background: rgba(122, 154, 153, 0.08);
  border-radius: 3px;
}
.mechanics-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 9px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.55;
}
.mechanics-label {
  flex: 0 0 auto;
  min-width: 62px;
  color: var(--text-muted, #6b5134);
  font-weight: 700;
}
.mechanics-text {
  min-width: 0;
  color: var(--text-main, #3e2a14);
  overflow-wrap: anywhere;
}
.mechanics-muted-row .mechanics-text {
  color: var(--text-muted, #6b5134);
}
.mechanics-condition-row {
  color: var(--gold, #8a6a1f);
}
.mechanics-note-row {
  color: var(--text-muted, #6b5134);
}
@media (max-width: 640px) {
  .skill-mechanics-box {
    padding: 8px 10px;
  }
  .mechanics-label {
    min-width: 56px;
  }
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
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  line-height: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.cost-item-pill:hover,
.mat-item-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}
.cost-item-pill:focus-visible,
.mat-item-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
  flex-wrap: wrap;
  gap: 6px;
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
.level-growth-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 9px;
  color: var(--text-muted);
  font-size: 12px;
}
.calculator-explanation {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.growth-formula {
  color: var(--text-main);
}
.breakthrough-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.6;
}
.breakthrough-toggle input[type="checkbox"] {
  appearance: none;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  margin: 0;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  background: var(--paper-soft);
  cursor: pointer;
  position: relative;
}
.breakthrough-toggle input[type="checkbox"]:checked {
  border-color: var(--border-color);
  background: var(--paper-soft);
}
.breakthrough-toggle input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  width: 5px;
  height: 9px;
  border: solid var(--wood-deep);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.breakthrough-toggle input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: 2px;
}
@media (max-width: 520px) {
  .level-growth-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
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
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
.attr-val-calc {
  color: var(--text-main, #3e2a14);
  font-weight: 700;
}
.static-color {
  color: var(--text-main, #3e2a14);
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

</style>
