import { createRouter, createWebHashHistory } from 'vue-router'
import MonstersEggsView from '../views/MonstersEggsView.vue'
import AchievementView from '../views/AchievementView.vue'
import RecipesView from '../views/RecipesView.vue'

const routes = [
  {
    path: '/',
    redirect: '/recipes'
  },

  {
    path: '/monsterseggs',
    name: 'MonstersEggsView',
    component: MonstersEggsView
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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
