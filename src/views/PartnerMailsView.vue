<template>
  <div class="page-view-container partner-mails-page">
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索角色或邮件标题..." />
      </template>
      <UiFilterRow label="稀有度：">
        <UiFilterPill :active="selectedRarity === null" @click="selectedRarity = null">全部</UiFilterPill>
        <UiFilterPill v-for="r in [5,4,3]" :key="r" :quality="r" :active="selectedRarity === r" @click="selectedRarity = r">{{ r }}星</UiFilterPill>
      </UiFilterRow>
      <UiFilterRow label="职业：">
        <UiFilterPill :active="selectedJob === null" @click="selectedJob = null">全部</UiFilterPill>
        <UiFilterPill v-for="(name, index) in jobsList" :key="name" :active="selectedJob === index + 1" @click="selectedJob = index + 1">{{ name }}</UiFilterPill>
      </UiFilterRow>
      <UiFilterRow label="属性：">
        <UiFilterPill :active="selectedElement === null" @click="selectedElement = null">全部</UiFilterPill>
        <UiFilterPill v-for="(name, key) in ELEMENT_NAMES" :key="key" :active="selectedElement === Number(key)" @click="selectedElement = Number(key)">{{ name }}</UiFilterPill>
      </UiFilterRow>
    </UiFilterPanel>

    <UiEmptyState v-if="loading" type="loading" text="正在读取伙伴邮件..." />
    <UiEmptyState v-else-if="error" type="error" :text="error" />
    <div v-else class="partner-mails-scroll">
      <PartnerMailReader :heroes="filteredHeroes" :selected-hero="selectedHero"
        :mails="selectedMails" :selected-mail="selectedMail"
        @select-hero="selectedHero = $event" @select-mail="selectedMail = $event" @select-reward="openReward" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiFilterPanel, UiSearchInput, UiFilterRow, UiFilterPill, UiEmptyState } from '../components/ui/index.js'
import { fetchHeroData } from '../utils/heroParser.js'
import { ELEMENT_NAMES, JOB_NAMES } from '../utils/gameMappings.js'
import PartnerMailReader from '../components/heroes/PartnerMailReader.vue'
import { isBlacklisted } from '../config/blacklist.js'

const route = useRoute(), router = useRouter()
const openReward = item => {
  if (item.typeId) router.push({ query: { ...route.query, itemId: item.typeId } })
}

const heroes = ref([]), selectedHero = ref(null), selectedMail = ref(null), searchQuery = ref('')
const selectedRarity = ref(null), selectedJob = ref(null), selectedElement = ref(null), loading = ref(true), error = ref('')
const jobsList = Object.values(JOB_NAMES)
const filteredHeroes = computed(() => heroes.value.filter(h => !isBlacklisted({ id: h.id, name: h.name, label: h.name2 }) && (!selectedRarity.value || h.rare === selectedRarity.value) && (!selectedJob.value || h.job === selectedJob.value) && (!selectedElement.value || h.element === selectedElement.value) && (!searchQuery.value.trim() || `${h.name} ${h.name2 || ''} ${h.mails.map(mail => mail.title).join(' ')}`.toLowerCase().includes(searchQuery.value.trim().toLowerCase()))))
const selectedMails = computed(() => selectedHero.value?.mails || [])

const applyRouteSelection = () => {
  const targetHeroId = route.query.hero
  const targetMailId = route.query.mail
  if (targetHeroId && heroes.value.length) {
    const foundHero = heroes.value.find(h => h.id === targetHeroId)
    if (foundHero) {
      if (!filteredHeroes.value.includes(foundHero)) {
        selectedRarity.value = null
        selectedJob.value = null
        selectedElement.value = null
        searchQuery.value = ''
      }
      selectedHero.value = foundHero
      if (targetMailId) {
        const foundMail = (foundHero.mails || []).find(m => m.id === targetMailId)
        if (foundMail) selectedMail.value = foundMail
      }
    }
  }
}

watch(filteredHeroes, list => {
  if (route.query.hero && heroes.value.some(h => h.id === route.query.hero)) return
  if (!list.includes(selectedHero.value)) { selectedHero.value = list[0] || null; selectedMail.value = null }
})
watch(selectedHero, () => {
  if (route.query.mail && selectedHero.value?.mails?.some(m => m.id === route.query.mail)) return
  selectedMail.value = selectedMails.value[0] || null
})
watch(() => [route.query.hero, route.query.mail], applyRouteSelection)

onMounted(async () => {
  try {
    const data = await fetchHeroData()
    heroes.value = data.mailboxes || []
    applyRouteSelection()
  } catch (e) {
    error.value = '伙伴邮件数据加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.partner-mails-page { height: 100%; min-height: 0; overflow: hidden; }
.partner-mails-page > .filter-panel { flex: 0 0 auto; max-height: 50%; overflow-y: auto; overscroll-behavior: contain; }
.partner-mails-scroll { flex: 1 1 0; min-height: 0; display: flex; overflow: hidden; }
.partner-mails-scroll > :deep(.mail-columns) { flex: 1; min-height: 0; }
</style>
