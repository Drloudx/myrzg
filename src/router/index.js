import { createRouter, createWebHashHistory } from 'vue-router'
import RoleView from '../views/RoleView.vue'
import EquipView from '../views/EquipView.vue'
import MonstersEggsView from '../views/MonstersEggsView.vue'
import AchievementView from '../views/AchievementView.vue'
import RecipesView from '../views/RecipesView.vue'

const routes = [
  {
    path: '/',
    redirect: '/role'
  },
  {
    path: '/role',
    name: 'RoleView',
    component: RoleView
  },
  {
    path: '/equip',
    name: 'EquipView',
    component: EquipView
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
