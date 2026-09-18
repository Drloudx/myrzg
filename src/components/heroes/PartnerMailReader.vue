<template>
  <div class="mail-columns" :style="skinStyle">
    <aside ref="heroScroll" class="mail-heroes" aria-label="伙伴列表" tabindex="0" @scroll.passive="syncScrollCues">
      <UiButton v-for="hero in heroes" :key="hero.id" variant="ghost"
        class="mail-hero" :class="{ active: selectedHero?.id === hero.id }"
        :aria-label="hero.name" :aria-pressed="selectedHero?.id === hero.id" :title="hero.name"
        @click="emit('select-hero', hero)">
        <img class="hero-portrait" :src="getImageUrl(`/images/HeadIconAtals/${hero.icon}.webp`)" alt="" @error="avatarFallback" />
        <img class="hero-frame" :src="skin('at_f_M')" alt="" />
        <img v-if="selectedHero?.id === hero.id" class="hero-selection" :src="skin('chara_srat_now')" alt="" />
      </UiButton>
    </aside>
    <div class="mail-selector">
    <section ref="listScroll" class="mail-list" aria-label="信件列表" tabindex="0" @scroll.passive="onMailListScroll">
      <UiButton v-for="mail in mails" :key="mail.id" variant="ghost" class="mail-title"
        :class="{ active: selectedMail?.id === mail.id }" :aria-pressed="selectedMail?.id === mail.id"
        :title="mail.title" @click="emit('select-mail', mail)">
        <img class="mail-kind" :src="skin(getPartnerMailPresentation(mail).icon)" alt="" />
        <span class="mail-subject">{{ mail.title || '未命名邮件' }}</span>
        <small>{{ selectedHero?.name }}的来信</small>
      </UiButton>
      <UiEmptyState v-if="!mails.length" :text="heroes.length ? '暂无伙伴邮件' : '暂无匹配角色'" />
    </section>
    <nav v-if="mails.length > 1" class="mail-switcher" aria-label="切换邮件">
      <span class="mail-position" aria-live="polite">{{ selectedIndex + 1 }}/{{ mails.length }}</span>
      <div class="mail-switch-buttons">
        <UiButton variant="ghost" aria-label="上一封邮件" :disabled="selectedIndex <= 0" @click="stepMail(-1)">‹</UiButton>
        <UiButton variant="ghost" aria-label="下一封邮件" :disabled="selectedIndex >= mails.length - 1" @click="stepMail(1)">›</UiButton>
      </div>
    </nav>
    </div>
    <article class="mail-content" aria-label="邮件正文">
      <template v-if="selectedMail">
        <h2 :title="selectedMail.title">{{ selectedMail.title || '伙伴邮件' }}</h2>
        <div class="mail-meta">来自：{{ selectedHero.name }}</div>
        <div class="mail-body-area">
          <div ref="body" class="mail-body" tabindex="0" @scroll.passive="syncScrollCues">
            <div>{{ cleanMailContent(selectedMail.content || '') }}</div>
            <img v-if="selectedMail.image" class="mail-illustration" :src="getImageUrl(selectedMail.image)" alt="信件附图" @load="syncScrollCues" />
          </div>
          <span v-if="cues.body" class="mail-scroll-cue mail-scroll-cue--body" aria-hidden="true"></span>
        </div>
        <section v-if="selectedMail.reward?.items?.length" class="mail-rewards" aria-label="邮件奖励">
          <img class="mail-reward-label" :src="skin(rewardLabel.sprite)" :alt="rewardLabel.text" />
          <div class="mail-reward-list">
            <UiItemCard v-for="item in selectedMail.reward.items" :key="`${item.id}-${item.name}`"
              class="mail-reward-item" :name="item.name" :img="getImageUrl(item.img)" :quality="item.quality"
              :show-name="false" role="button" tabindex="0" :aria-label="`查看${item.name}详情`"
              @click="emit('select-reward', item)" @keydown.enter.prevent="emit('select-reward', item)"
              @keydown.space.prevent="emit('select-reward', item)" @img-error="avatarFallback">
              <template v-if="item.count != null" #extra>{{ item.count }}</template>
            </UiItemCard>
          </div>
        </section>
      </template>
      <UiEmptyState v-else class="mail-placeholder" text="请选择一封邮件" />
    </article>
    <span v-if="cues.heroes" class="mail-scroll-cue mail-scroll-cue--heroes" aria-hidden="true"></span>
    <span v-if="cues.list" class="mail-scroll-cue mail-scroll-cue--list" aria-hidden="true"></span>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { UiButton, UiEmptyState, UiItemCard } from '../ui/index.js'
import { cleanMailContent } from '../../utils/gameMappings.js'
import { getImageUrl } from '../../utils/env.js'
import { getPartnerMailPresentation } from '../../utils/partnerMailData.js'

const props = defineProps({ heroes: Array, selectedHero: Object, mails: Array, selectedMail: Object })
const emit = defineEmits(['select-hero', 'select-mail', 'select-reward'])
const body = ref(null)
const heroScroll = ref(null)
const listScroll = ref(null)
const selectedIndex = computed(() => props.mails.findIndex(mail => mail.id === props.selectedMail?.id))
const stepMail = delta => {
  const mail = props.mails[selectedIndex.value + delta]
  if (mail) emit('select-mail', mail)
}
const isMobile = () => window.matchMedia('(max-width: 700px)').matches
let layoutFrame = 0
let selectionTimer = 0
let disposed = false
const fitMailTitles = () => {
  for (const title of listScroll.value?.querySelectorAll('.mail-subject') || []) {
    if (!title.clientWidth) continue
    let size = 13
    title.style.fontSize = `${size}px`
    while (title.scrollWidth > title.clientWidth + 1 && size > 1) {
      title.style.fontSize = `${--size}px`
    }
  }
}
const revealSelectedMail = () => {
  if (!isMobile() || !listScroll.value) return
  const active = listScroll.value.querySelector('.mail-title.active')
  if (active) listScroll.value.scrollLeft = active.offsetLeft - 4
}
const scheduleLayout = () => {
  if (disposed) return
  cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(() => {
    fitMailTitles()
    revealSelectedMail()
    syncScrollCues()
  })
}
const onMailListScroll = () => {
  syncScrollCues()
  clearTimeout(selectionTimer)
  if (!isMobile()) return
  selectionTimer = setTimeout(() => {
    const list = listScroll.value
    if (!list) return
    const cards = [...list.querySelectorAll('.mail-title')]
    const nearest = cards.reduce((best, card, index) => {
      const distance = Math.abs(card.offsetLeft - 4 - list.scrollLeft)
      return distance < best.distance ? { index, distance } : best
    }, { index: -1, distance: Infinity }).index
    if (nearest >= 0 && nearest !== selectedIndex.value) emit('select-mail', props.mails[nearest])
  }, 140)
}
const cues = ref({ heroes: false, list: false, body: false })
const hasMore = el => !!el && (el.scrollHeight - el.clientHeight - el.scrollTop > 2 || el.scrollWidth - el.clientWidth - el.scrollLeft > 2)
const syncScrollCues = () => {
  cues.value = { heroes: hasMore(heroScroll.value), list: hasMore(listScroll.value), body: hasMore(body.value) }
}
// Observe the viewport and content; filters, letter switches and resizes all change overflow.
const observer = new ResizeObserver(scheduleLayout)
watch([heroScroll, listScroll, body, () => props.heroes, () => props.mails, () => props.selectedMail], async () => {
  await nextTick()
  observer.disconnect()
  for (const el of [heroScroll.value, listScroll.value, body.value]) {
    if (!el) continue
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
  }
  scheduleLayout()
}, { flush: 'post' })
onMounted(() => {
  document.fonts?.ready.then(scheduleLayout)
  document.fonts?.addEventListener('loadingdone', scheduleLayout)
})
onBeforeUnmount(() => {
  disposed = true
  observer.disconnect()
  cancelAnimationFrame(layoutFrame)
  clearTimeout(selectionTimer)
  document.fonts?.removeEventListener('loadingdone', scheduleLayout)
})
/**
 * 邮件 sprite 名 → URL。
 *
 * 全站图片已统一为 `.webp`（内容为 WebP，无损；见 `scripts/dev/convert-remaining-to-webp.mjs`），
 * 故这里可以直接拼 `.webp`，不再需要按名查扩展名的例外表。
 */
const skin = name => {
  const folder = name === 'mail_botm' ? 'uipanel/emailpanel'
    : (name.startsWith('mail_') ? 'EmailPanel_Atlas' : 'Common_Atlas')
  return getImageUrl(`/images/${folder}/${name}.webp`)
}
const rewardLabel = computed(() => getPartnerMailPresentation(props.selectedMail).rewardLabel)
const skinStyle = computed(() => Object.fromEntries(['mail_at', 'mail_page', 'mail_page_on', 'mail_botm']
  .map(name => [`--${name.replaceAll('_', '-')}`, `url("${skin(name)}")`])))
const avatarFallback = event => {
  event.target.onerror = null
  const fallback = getImageUrl('/ui/visibility-off.svg')
  if (event.target.getAttribute('src') !== fallback) event.target.src = fallback
}
watch(() => props.selectedMail?.id, async () => {
  await nextTick()
  if (body.value) body.value.scrollTop = 0
  revealSelectedMail()
  syncScrollCues()
})
</script>

<style scoped>
/* Game-specific skin: original EmailPanel prefab sprites, not a global theme override.
   The original light paper keeps its own ink even when the surrounding app is dark. */
.mail-columns {
  position: relative;
  --mail-ink: #533e26;
  --mail-muted: rgb(83 62 38 / 69.803923%);
  --mail-label: #e5d6b5;
  font-family: var(--font-ui);
  display: grid;
  grid-template-columns: 70px minmax(150px, 27%) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: auto;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: rgba(221, 205, 176, .94);
  border: 2px solid #8f7958;
  box-shadow: inset 0 0 0 1px rgba(255, 244, 213, .65), 0 3px 10px rgba(45, 30, 12, .28);
  border-radius: 4px;
}
.mail-heroes, .mail-list { min-width: 0; min-height: 0; overflow-y: auto; background: transparent !important; }
.mail-heroes, .mail-list, .mail-body { overscroll-behavior: contain; scrollbar-width: none; }
.mail-heroes::-webkit-scrollbar, .mail-list::-webkit-scrollbar, .mail-body::-webkit-scrollbar { display: none; }
.mail-heroes { scrollbar-width: none; -ms-overflow-style: none; }
.mail-heroes::-webkit-scrollbar { display: none; width: 0; height: 0; }
.mail-heroes { position: relative; padding: 8px 3px; border-style: solid; border-color: transparent; border-width: 0 1px 0 0; border-image: var(--mail-at) 40 0 fill / 24px 1px stretch; }
.mail-hero.ui-btn { display: block; width: 60px; height: 60px; padding: 0; position: relative; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.mail-hero img { position: absolute; object-fit: contain; pointer-events: none; }
.hero-portrait { width: 44px; height: 44px; top: 8px; left: 8px; border-radius: 50%; }
.hero-frame { width: 60px; height: 60px; inset: 0; }
.hero-selection { width: 60px; height: 60px; inset: 0; }
.mail-hero:hover { filter: brightness(1.12); }
.mail-hero:focus-visible, .mail-title:focus-visible, .mail-body:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }
.mail-selector { display: flex; min-width: 0; min-height: 0; }
.mail-switcher { display: none; }
.mail-list { position: relative; flex: 1; padding: 10px 8px; }
.mail-title.ui-btn {
  display: grid; position: relative; grid-template-columns: 43px minmax(0, 1fr); grid-template-rows: 20px 17px; align-content: center;
  width: 100%; height: 66px; min-height: 66px; box-sizing: border-box; margin-bottom: 5px; padding: 12px 12px 12px 7px; gap: 2px 5px;
  border: 0; border-radius: 0; background: transparent; box-shadow: none; text-shadow: none;
  color: var(--mail-label); text-align: left; letter-spacing: 0;
  font-family: inherit; font-weight: 400;
}
/* NGUI mail_page slices: left 90, right 50; top/bottom 0. Preserve end caps. */
.mail-title.ui-btn:hover:not(.is-disabled) { color: var(--mail-label); background: transparent; }
.mail-title::before { content: ''; position: absolute; inset: 0; border-image: var(--mail-page) 0 50 0 90 fill / 0 28px 0 50px stretch; pointer-events: none; }
.mail-title.active::before { border-image-source: var(--mail-page-on); }
.mail-title > * { position: relative; }
.mail-kind { width: 36px; height: 36px; grid-row: 1 / 3; align-self: center; }
.mail-subject { display: block; min-width: 0; white-space: nowrap; overflow: hidden; font-size: 13px; line-height: 20px; color: #cfba96; }
.mail-title small { grid-column: 2; font-size: 11px; line-height: 17px; color: rgb(248 238 220 / 50.196081%); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* The actual 512px mail_botm includes the header, separator and paper edges.
   Original mBorder is 150; give its top slice 12px more room for the sender. */
/* 横屏等"高度不足"场景：标题+发件人+正文+奖励四项的固定高度之和会超过容器高度，
   把 flex:1 的 .mail-body-area 压成 0（实测 844x390 下 clientHeight=0，正文完全读不到，
   奖励区还溢出到视口外）。故：容器允许纵向滚动兜底，正文保留最小可读高度。 */
.mail-content { position: relative; min-width: 0; min-height: 0; margin: 0 5px 0 0; display: flex; flex-direction: column; color: var(--mail-ink); overflow-y: auto; }
.mail-content::before { content: ''; position: absolute; inset: 0; border-image: var(--mail-botm) 150 fill / 102px 90px 90px stretch; pointer-events: none; }
.mail-content > * { position: relative; }
/* The black strip is centered at source y=44, or about 30px in the 102px top slice.
   Offset only the title to align its 25px line box without moving the sender below. */
.mail-content h2 { top: 3px; flex: 0 0 25px; margin: 14px 28px 0 39px; font-family: inherit; font-size: 14px; font-weight: 400; line-height: 25px; color: #cfba96; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.mail-meta { flex: 0 0 23px; margin: 8px 25px 0; color: var(--mail-muted); font-size: 12px; font-weight: 700; line-height: 23px; }
/* min-height 96px：保证正文至少有可读高度；空间不足时由 .mail-content 的纵向滚动兜底 */
.mail-body-area { position: relative; display: flex; flex: 1; min-height: 96px; margin: 9px 24px 23px; }
.mail-body { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; font-weight: 700; line-height: 1.4; }
.mail-rewards { flex: 0 0 64px; margin: 0 6px 24px; padding: 4px 8px; display: flex; align-items: center; gap: 8px; background: rgba(112, 105, 87, .42); }
.mail-illustration { display: block; max-width: 100%; height: auto; margin: 12px auto 0; }
.mail-reward-label { flex-shrink: 0; width: 30px; height: 60px; object-fit: contain; }
.mail-reward-list { display: flex; gap: 8px; align-items: center; min-width: 0; overflow-x: auto; }
.mail-reward-item.ui-item-card { flex: 0 0 60px; width: 60px; height: 60px; padding: 0; margin: 0; cursor: pointer; }
.mail-reward-item:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }
.mail-reward-item :deep(.ui-item-card__badge) { right: 7px; color: #f8eedc; font-size: 13px; text-shadow: 0 1px 2px var(--wood-deep), 1px 0 2px var(--wood-deep); }
.mail-reward-item.ui-item-card:hover, .mail-reward-item.ui-item-card:active { transform: none; filter: none; }
.mail-placeholder { margin-top: 80px; color: var(--mail-ink); }
.mail-scroll-cue { position: absolute; bottom: 4px; width: 8px; height: 8px; border-right: 2px solid var(--mail-ink); border-bottom: 2px solid var(--mail-ink); transform: rotate(45deg); pointer-events: none; }
.mail-scroll-cue--heroes { left: 31px; }
.mail-scroll-cue--list { left: calc(70px + max(150px, 27%) / 2 - 4px); }
.mail-scroll-cue--body { left: 50%; bottom: -15px; transform: translateX(-50%) rotate(45deg); }
@media (max-width: 700px) {
  .mail-scroll-cue--heroes { top: 28px; right: 4px; left: auto; bottom: auto; transform: rotate(-45deg); }
  .mail-scroll-cue--list { display: none; }
  .mail-columns { grid-template-columns: minmax(0, 1fr); grid-template-rows: 68px 64px minmax(0, 1fr); height: auto; }
  .mail-heroes { grid-column: 1 / -1; display: flex; padding: 4px; overflow-x: auto; overflow-y: hidden; border-image: none; }
  .mail-hero.ui-btn { flex: 0 0 60px; }
  .mail-selector { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  .mail-list { display: flex; gap: 6px; padding: 4px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; }
  .mail-title.ui-btn { flex: 0 0 100%; width: 100%; height: 56px; min-height: 56px; margin: 0; padding: 6px 12px 6px 7px; scroll-snap-align: start; }
  .mail-switcher { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-right: 4px; color: var(--mail-ink); }
  .mail-position { font-size: 11px; line-height: 16px; }
  .mail-switch-buttons { display: flex; }
  .mail-switch-buttons .ui-btn { width: 30px; height: 36px; padding: 0; font-size: 24px; line-height: 1; color: var(--mail-ink); }
  .mail-content { margin: 0 4px 0; }
  .mail-content h2 { font-size: 13px; }
  .mail-body-area { margin-left: 17px; margin-right: 17px; }
  .mail-body { font-size: 13px; }
}
</style>
