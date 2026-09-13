import { computed, ref } from 'vue'
import { isBlacklisted } from '../../config/blacklist.js'
import { fetchWithFallback } from '../../utils/request.js'

const VALID_TYPES = new Set(['recipe', 'achievement', 'pet', 'pet_egg', 'item', 'furniture', 'role', 'equip', 'monster', 'task', 'event', 'explore', 'exchange', 'hidden'])

export function useGlobalSearch(route, router) {
  const globalQuery = ref('')
  const isSearchOpen = ref(false)
  const searchIndex = ref([])
  const isIndexLoaded = ref(false)

  const fetchSearchIndex = async () => {
    if (isIndexLoaded.value) return
    try {
      searchIndex.value = await fetchWithFallback('data/parsed/search-index.json')
      isIndexLoaded.value = true
    } catch (error) {
      console.error('Fetch search-index.json error:', error)
    }
  }

  const handleSearchFocus = () => {
    isSearchOpen.value = true
    fetchSearchIndex()
  }

  const filteredSearchIndex = computed(() => {
    const query = globalQuery.value.trim().toLowerCase()
    if (!query) return []
    const parts = query.split(/\s+/).filter(Boolean)
    return searchIndex.value
      .filter(item => VALID_TYPES.has(item.type) && !isBlacklisted(item) && item.keywords && parts.every(part => item.keywords.includes(part)))
      .sort((a, b) => {
        const aName = String(a.name || '').toLowerCase()
        const bName = String(b.name || '').toLowerCase()
        return Number(bName === query) - Number(aName === query)
          || Number(bName.startsWith(query)) - Number(aName.startsWith(query))
          || Number(bName.includes(query)) - Number(aName.includes(query))
      })
  })

  const handleSelectSearchResult = async item => {
    isSearchOpen.value = false
    await router.push({ path: route.path, query: {} })
    setTimeout(() => {
      const directRoutes = {
        item: { path: route.path, query: { itemId: item.id } },
        furniture: { path: '/furniture', query: { id: item.id } },
        equip: { path: '/equip', query: { itemId: item.id } },
        task: { path: '/tasks', query: { task: item.id } },
        event: { path: '/events', query: { event: item.id } },
        explore: { path: '/events', query: { tab: 'explore', explore: item.id } },
        exchange: { path: '/exchange' },
        hidden: { path: '/rewards' }
      }
      const pageRoutes = {
        pet: '/pets', pet_egg: '/petseggs', achievement: '/achievement', recipe: '/recipes',
        monster: '/monsters', role: '/heroes'
      }
      const target = directRoutes[item.type] || { path: pageRoutes[item.type] || '/', query: { id: item.id, q: item.name } }
      router.push(target)
      globalQuery.value = ''
    }, 150)
  }

  return { globalQuery, isSearchOpen, filteredSearchIndex, handleSearchFocus, handleSelectSearchResult }
}
