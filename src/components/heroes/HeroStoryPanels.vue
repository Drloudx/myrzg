<template>
  <div v-if="activeTab === 'archives'" class="hero-story-panel">
    <UiSection title="角色档案">
      <div class="archives-list">
        <div v-for="arch in hero.archives" :key="arch.title" class="archive-item-card paper-panel-solid">
          <div v-if="arch.type !== 1">
            <div class="archive-card-header">
              <h4 class="archive-title">{{ arch.title }}</h4>
              <span class="fav-unlock-tag">好感要求: <span class="unlock-fav-val">{{ arch.unlockFav }}</span></span>
            </div>
            <div class="archive-desc-box"><p class="archive-desc-txt">{{ arch.desc }}</p></div>
            <div v-if="arch.type === 3 && Object.keys(arch.stats).length > 0" class="archive-buff-banner">
              <span class="buff-title">解锁属性增益:</span>
              <div class="buff-stats-flex">
                <UiTag v-for="(val, statKey) in arch.stats" :key="statKey" tone="accent">{{ translateStatName(statKey) }} +{{ val }}</UiTag>
              </div>
            </div>
          </div>

          <div v-else>
            <div class="archive-card-header">
              <div class="title-side-group">
                <UiTag tone="danger">剧情</UiTag>
                <h4 class="archive-title inline">{{ arch.taskName || arch.title }}</h4>
              </div>
              <span class="fav-unlock-tag">好感要求: <span class="unlock-fav-val">{{ arch.unlockFav }}</span></span>
            </div>
            <div class="archive-desc-box mb-2"><p class="archive-desc-txt">{{ arch.desc }}</p></div>
            <div v-if="arch.taskDesc" class="story-task-gate mb-2">
              <span class="gate-label">任务目标:</span>
              <p class="gate-txt">{{ cleanDialogueLine(arch.taskDesc) }}</p>
            </div>
            <div v-if="arch.mail" class="mail-body-inline-box mb-2">
              <div class="mail-inline-header">专属信件:《{{ arch.mail.title }}》</div>
              <p class="mail-inline-content">{{ cleanMailContent(arch.mail.content) }}</p>
            </div>
            <div v-if="arch.reward?.items?.length > 0" class="story-reward-box mb-2">
              <span class="reward-lbl">通关剧情奖励:</span>
              <div class="reward-items-flex">
                <UiRewardCard
                  v-for="item in arch.reward.items"
                  :key="item.id"
                  :clickable="false"
                  :rule="{
                    targetName: item.name,
                    targetImg: getImageUrl(item.img),
                    targetQuality: item.quality,
                    min: item.count ?? item.num ?? 1,
                    max: item.count ?? item.num ?? 1,
                    typeId: item.id
                  }"
                />
              </div>
            </div>
            <div v-if="arch.dialogs?.length" class="story-dialogue-inline-list mt-2">
              <template v-for="(segment, segmentIndex) in arch.dialogs" :key="segment.id">
                <button class="toggle-dialogue-btn" :class="{ 'seg-mid': segmentIndex > 0 }" @click="toggleDialogue(segment.id)">
                  <span class="btn-left">
                    {{ isDialogueExpanded(segment.id) ? '▲ 收起剧情文本' : '▼ 展开剧情文本' }}
                    <span v-if="arch.dialogs.length > 1" class="seg-label">（第 {{ segmentIndex + 1 }}/{{ arch.dialogs.length }} 段）</span>
                  </span>
                  <span v-if="segment.name" class="btn-right">{{ segment.name }}</span>
                </button>
                <DialogueContent
                  v-if="isDialogueExpanded(segment.id)"
                  :loading="loadingDialogs[segment.id]"
                  :lines="dialogsCache[segment.id]"
                  loading-text="剧情读取中，请稍候..."
                  error-text="剧情读取失败。"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </UiSection>
  </div>

  <div v-else-if="activeTab === 'voicelines'" class="hero-story-panel">
    <UiTabs v-model="voiceSubTab" class="voice-subtabs" :options="VOICE_TABS" />

    <UiSection v-if="voiceSubTab === 'chat'" title="好感对话">
      <div class="explore-voice-list">
        <div v-for="(chat, index) in hero.behavior.chat" :key="index" class="voice-group-card paper-panel-solid inline-dialogue-task">
          <div class="voice-group-title header-between">
            <span class="fav-requirement-label">好感度要求: {{ chat.min }}-{{ chat.max }}</span>
            <UiButton variant="secondary" size="sm" @click="toggleDialogue(chat.dialog)">{{ isDialogueExpanded(chat.dialog) ? '▲ 收起对话' : '▼ 展开对话' }}</UiButton>
          </div>
          <DialogueContent v-if="isDialogueExpanded(chat.dialog)" inline :loading="loadingDialogs[chat.dialog]" :lines="dialogsCache[chat.dialog]" loading-text="对话读取中..." error-text="无法加载对话文本。" />
        </div>
      </div>
    </UiSection>

    <UiSection v-if="voiceSubTab === 'heroEvent'" title="营地事件">
      <div class="explore-voice-list">
        <div v-for="(event, index) in visibleCampEvents" :key="index" class="voice-group-card paper-panel-solid inline-dialogue-task">
          <div class="voice-group-title header-between">
            <span class="event-title-label">事件: {{ event.title }} (触发天数: 第 {{ event.day }} 天)</span>
            <UiButton variant="secondary" size="sm" @click="toggleDialogue(event.dialog)">{{ isDialogueExpanded(event.dialog) ? '▲ 收起剧情' : '▼ 展开剧情' }}</UiButton>
          </div>
          <DialogueContent v-if="isDialogueExpanded(event.dialog)" inline :loading="loadingDialogs[event.dialog]" :lines="dialogsCache[event.dialog]" loading-text="剧情读取中..." error-text="无法加载剧情文本。" />
        </div>
      </div>
    </UiSection>

    <UiSection v-if="activeVoiceGroups" :title="activeVoiceSectionTitle">
      <div class="explore-voice-list">
        <div v-for="group in activeVoiceGroups" :key="group.key" class="voice-group-card paper-panel-solid">
          <div class="voice-group-title">{{ group.label }}</div>
          <div class="voice-lines-container">
            <div v-for="(line, index) in group.lines" :key="index" class="voice-line-item">
              <p class="line-content-txt">{{ line }}</p>
            </div>
          </div>
        </div>
      </div>
    </UiSection>

    <UiSection v-if="activeSimpleVoiceLines" :title="activeSimpleVoiceSectionTitle">
      <div class="voicelines-grid">
        <div v-for="(line, index) in activeSimpleVoiceLines" :key="index" class="voiceline-card paper-panel-solid static-v-card">
          <div class="v-card-header">
            <span class="fav-requirement-label">好感度要求: {{ line.min }}-{{ line.max }}</span>
          </div>
          <p class="v-text-content">"{{ line.text }}"</p>
        </div>
      </div>
    </UiSection>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from 'vue'
import TaskDialogLines from '../TaskDialogLines.vue'
import { UiButton, UiRewardCard, UiSection, UiTabs, UiTag } from '../ui/index.js'
import { fetchWithFallback } from '../../utils/request.js'
import { cleanDialogueBase, cleanMailContent, translateStatName } from '../../utils/gameMappings.js'
import { getImageUrl } from '../../utils/env.js'

const props = defineProps({ hero: { type: Object, required: true }, activeTab: { type: String, required: true } })
const VOICE_TABS = [
  { value: 'chat', label: '好感对话' }, { value: 'heroEvent', label: '营地事件' },
  { value: 'explore', label: '野外探索' }, { value: 'battleTalk', label: '战斗' },
  { value: 'acquireTalk', label: '赠礼与获取' }, { value: 'touch', label: '摸头' },
  { value: 'walk', label: '路过' }, { value: 'ziyanziyu', label: '自言自语' }
]
const voiceSubTab = ref('chat')
const dialogsCache = ref({})
const loadingDialogs = ref({})
const expandedDialogs = ref(new Set())
// 按事件标题过滤测试条目，不限定角色；保留页签和章节标题。
const visibleCampEvents = computed(() => (props.hero.behavior?.heroEvent || []).filter(event => !String(event.title || '').includes('测试')))

const groupByKeys = (source, definitions) => definitions.map(([key, label]) => ({ key, label, lines: source?.[key] || [] })).filter(group => group.lines.length)
const exploreVoiceGroups = computed(() => groupByKeys(props.hero.behavior?.explore, [
  ['start', '探索出发'], ['fight', '遭遇战斗'], ['win', '战斗胜利'], ['exploreTalk', '探索途中'], ['loopEnd', '单轮探索结束'], ['readyGoHome', '准备返程'], ['over', '返回营地']
]))
const battleVoiceGroups = computed(() => groupByKeys(props.hero.behavior?.explore, [['roomFinishLeader', '战斗结束（队长）'], ['roomFinishMember', '战斗结束（队员）']]))
const acquireVoiceGroups = computed(() => groupByKeys(props.hero.behavior?.explore, [['getGift', '收到赠礼'], ['gacha', '招募获得']]))
const groupedVoiceSections = computed(() => ({
  explore: { title: '野外探索', groups: exploreVoiceGroups.value },
  battleTalk: { title: '战斗', groups: battleVoiceGroups.value },
  acquireTalk: { title: '赠礼与获取', groups: acquireVoiceGroups.value }
}))
const simpleVoiceSections = computed(() => ({
  touch: { title: '摸头', lines: props.hero.behavior?.touch || [] },
  walk: { title: '路过', lines: props.hero.behavior?.walk || [] },
  ziyanziyu: { title: '自言自语', lines: props.hero.behavior?.ziyanziyu || [] }
}))
const activeVoiceGroups = computed(() => groupedVoiceSections.value[voiceSubTab.value]?.groups || null)
const activeVoiceSectionTitle = computed(() => groupedVoiceSections.value[voiceSubTab.value]?.title || '')
const activeSimpleVoiceLines = computed(() => simpleVoiceSections.value[voiceSubTab.value]?.lines || null)
const activeSimpleVoiceSectionTitle = computed(() => simpleVoiceSections.value[voiceSubTab.value]?.title || '')

const normalizeDialogue = data => (data?.exps || []).filter(entry => entry.key === 'text' || entry.key === 'option').map(entry => {
  if (entry.key === 'option') return { isOption: true, options: (entry.para.options || []).map(option => cleanDialogueBase(option.text)) }
  const text = cleanDialogueBase(entry.para.text || '')
  if (!text) return null
  let speaker = entry.para.charaName || ''
  if (['主角', '[myName]', '{myName}'].includes(speaker)) speaker = '小工匠'
  return { isOption: false, speaker, text }
}).filter(Boolean)

const toggleDialogue = async scriptId => {
  if (!scriptId) return
  const next = new Set(expandedDialogs.value)
  if (next.has(scriptId)) {
    next.delete(scriptId)
    expandedDialogs.value = next
    return
  }
  next.add(scriptId)
  expandedDialogs.value = next
  if (dialogsCache.value[scriptId]) return
  loadingDialogs.value[scriptId] = true
  try {
    dialogsCache.value[scriptId] = normalizeDialogue(await fetchWithFallback(`data/dialogs/${encodeURIComponent(scriptId)}.json`))
  } catch (error) {
    console.error('Failed to load dialogue script:', error)
  } finally {
    loadingDialogs.value[scriptId] = false
  }
}

const isDialogueExpanded = scriptId => expandedDialogs.value.has(scriptId)
const cleanDialogueLine = cleanDialogueBase
watch(() => props.hero.id, () => {
  voiceSubTab.value = 'chat'
  dialogsCache.value = {}
  loadingDialogs.value = {}
  expandedDialogs.value = new Set()
})

const DialogueContent = defineComponent({
  props: { loading: Boolean, lines: Array, loadingText: String, errorText: String, inline: Boolean },
  setup(componentProps) {
    return () => h('div', { class: ['dialogue-lines-container', { 'inline-chat': componentProps.inline }] }, [
      componentProps.loading ? h('div', { class: 'dialogue-loading-indicator' }, componentProps.loadingText)
        : componentProps.lines?.length ? h(TaskDialogLines, { lines: componentProps.lines })
          : h('div', { class: 'dialogue-error-indicator' }, componentProps.errorText)
    ])
  }
})
</script>

<style scoped>
.hero-story-panel { display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; }
.archives-list, .explore-voice-list, .voice-lines-container, .voicelines-grid { display: flex; flex-direction: column; }
.archives-list { gap: 12px; }
.archive-item-card, .voice-group-card { padding: 12px 14px; }
.archive-card-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.title-side-group, .story-reward-box, .reward-items-flex, .buff-stats-flex { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.archive-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--text-main); letter-spacing: 1px; }
.archive-title.inline { display: inline; }
.fav-unlock-tag { font-size: 12px; color: var(--text-muted); }
.unlock-fav-val, .fav-requirement-label { font-weight: 700; color: var(--gold); }
.archive-desc-box { background: rgba(43,31,21,.06); border-left: 3px solid var(--border-color); border-radius: 0 4px 4px 0; padding: 8px 12px; margin-bottom: 8px; }
.archive-desc-txt, .gate-txt, .mail-inline-content, .line-content-txt, .v-text-content { margin: 0; font-size: 13px; line-height: 1.7; color: var(--text-main); }
.archive-desc-txt, .mail-inline-content { white-space: pre-wrap; }
.archive-buff-banner { background: rgba(122,154,153,.14); border: 1px solid rgba(122,154,153,.4); border-radius: 4px; padding: 8px 12px; }
.buff-title, .gate-label, .reward-lbl { font-size: 12px; font-weight: 700; color: var(--text-muted); }
.buff-stats-flex { display: inline-flex; margin-top: 6px; }
.story-task-gate, .mail-body-inline-box { border: 1px solid var(--border-faint); border-radius: 4px; padding: 8px 12px; }
.story-task-gate { background: rgba(43,31,21,.06); }
.gate-txt { margin-top: 4px; }
.mail-body-inline-box { background: var(--paper-solid); box-shadow: inset 0 2px 5px rgba(43,31,21,.12); }
.mail-inline-header { margin-bottom: 6px; font-size: 13px; font-weight: 700; color: var(--text-main); }
.reward-items-flex :deep(.ui-reward-card) { min-width: 150px; }
.toggle-dialogue-btn { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; background: var(--wood); color: var(--paper); border: 1px solid #17100a; border-radius: 4px; padding: 8px 12px; cursor: pointer; font: 700 13px 'HarmonyOS','Microsoft YaHei',sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,.3); }
.toggle-dialogue-btn:hover { background: var(--wood-soft); }
.toggle-dialogue-btn.seg-mid { margin-top: 6px; }
.btn-left { display: inline-flex; align-items: center; gap: 6px; }
.seg-label, .btn-right { font-size: 11px; color: rgba(223,206,179,.75); }
.dialogue-lines-container { margin-top: 8px; }
.dialogue-loading-indicator, .dialogue-error-indicator { padding: 8px 0; color: var(--text-muted); font-size: 13px; font-style: italic; }
.dialogue-error-indicator { color: var(--danger); }
.voice-subtabs { margin-bottom: 12px; }
.explore-voice-list, .voicelines-grid { gap: 10px; }
.voice-group-title { margin-bottom: 8px; border-bottom: 1px dashed var(--border-soft); padding-bottom: 6px; color: var(--text-main); font-size: 14px; font-weight: 700; }
.voice-group-title.header-between { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 0; border: 0; padding: 0; }
.fav-requirement-label { font-size: 12px; }
.event-title-label { font-size: 13px; color: var(--text-main); }
.voice-lines-container { gap: 8px; }
.voice-line-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px; background: rgba(43,31,21,.06); border-radius: 4px; }
.voiceline-card { display: grid; grid-template-columns: 1fr; gap: 5px; padding: 12px 14px; }
.v-card-header { margin-bottom: 1px; }
.v-text-content { font-size: 14px; font-style: italic; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }
</style>
