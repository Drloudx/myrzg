import { createRouter, createWebHashHistory } from 'vue-router'
import PetsEggsView from '../views/PetsEggsView.vue'
import AchievementView from '../views/AchievementView.vue'
import RecipesView from '../views/RecipesView.vue'
// Static import removed to allow dynamic import
const routes = [
  {
    path: '/',
    redirect: '/recipes'
  },

  {
    path: '/petseggs',
    name: 'PetsEggsView',
    component: PetsEggsView
  },
  {
    path: '/achievement',
    name: 'AchievementView',
    component: AchievementView
  },
  {
    path: '/recipes',
    name: 'RecipesView',
    component: RecipesView
  },
  {
    path: '/items',
    name: 'items',
    component: () => import('../views/ItemsView.vue')
  },
  {
    path: '/monsters',
    name: 'monsters',
    component: () => import('../views/MonstersView.vue')
  },
  {
    path: '/rewards',
    name: 'RewardsView',
    component: () => import('../views/RewardsView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
