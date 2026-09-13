import { createRouter, createWebHashHistory } from 'vue-router'
import { closeItemDetail } from '../utils/itemModalState'

const routes = [
  {
    path: '/runes',
    name: 'runes',
    component: () => import('../views/RunesView.vue')
  },
  {
    path: '/',
    redirect: '/recipes'
  },
  {
    path: '/petseggs',
    name: 'PetsEggsView',
    component: () => import('../views/PetsEggsView.vue')
  },
  {
    path: '/achievement',
    name: 'AchievementView',
    component: () => import('../views/AchievementView.vue')
  },
  {
    path: '/recipes',
    name: 'RecipesView',
    component: () => import('../views/RecipesView.vue')
  },
  {
    path: '/items',
    name: 'items',
    component: () => import('../views/ItemsView.vue')
  },
  {
    path: '/furniture',
    name: 'furniture',
    component: () => import('../views/FurnitureView.vue')
  },
  {
    path: '/facilities',
    name: 'facilities',
    component: () => import('../views/FacilitiesView.vue')
  },
  {
    path: '/monsters',
    name: 'monsters',
    component: () => import('../views/MonstersView.vue')
  },
  {
    path: '/pets',
    name: 'pets',
    component: () => import('../views/PetsView.vue')
  },
  {
    path: '/equip',
    name: 'equip',
    component: () => import('../views/EquipsView.vue')
  },
  {
    path: '/rewards',
    name: 'RewardsView',
    component: () => import('../views/RewardsView.vue')
  },
  {
    path: '/heroes',
    name: 'heroes',
    component: () => import('../views/HeroesView.vue')
  },
  {
    path: '/partner-mails',
    name: 'partner-mails',
    component: () => import('../views/PartnerMailsView.vue')
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('../views/TasksView.vue')
  },
  {
    path: '/events',
    name: 'events',
    component: () => import('../views/EventsView.vue')
  },
  {
    path: '/exchange',
    name: 'exchange',
    component: () => import('../views/ExchangeView.vue')
  },
  {
    path: '/dungeons',
    name: 'dungeons',
    component: () => import('../views/DungeonsView.vue')
  },
  {
    path: '/gacha',
    name: 'gacha',
    component: () => import('../views/GachaView.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  closeItemDetail()
  next()
})

export default router
