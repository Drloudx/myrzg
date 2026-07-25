<template>
  <div v-if="isOpen" class="nav-overlay" @click.self="$emit('close')">
    <div class="nav-drawer">
      <div class="drawer-header">
        <h3 class="drawer-title">功能导航</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="drawer-body">
        <div class="nav-section-title">核心功能</div>
        <div class="nav-grid">
          <router-link
            to="/monsterseggs"
            class="nav-item"
            :class="{ active: currentRoute === '/monsterseggs' }"
            @click="$emit('close')"
          >
            <div class="icon-box">
              <img src="/pet/eggs/pet_079.png" class="nav-egg-img" alt="魔物收益" />
            </div>
            <span>魔物收益</span>
          </router-link>

          <router-link
            to="/achievement"
            class="nav-item"
            :class="{ active: currentRoute === '/achievement' }"
            @click="$emit('close')"
          >
            <div class="icon-box">
              <img src="/AchievementPanel/achv_icon_adv.png" class="nav-achv-img" alt="成就查询" />
            </div>
            <span>成就查询</span>
          </router-link>

          <router-link
            to="/recipes"
            class="nav-item"
            :class="{ active: currentRoute === '/recipes' }"
            @click="$emit('close')"
          >
            <div class="icon-box">
              <img src="/Common_ItemIcon/item_30047.png" class="nav-recipe-img" alt="菜谱查询" />
            </div>
            <span>菜谱查询</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineProps({
  isOpen: Boolean
})
defineEmits(['close'])

const route = useRoute()
const currentRoute = computed(() => route.path)
</script>

<style scoped>
.nav-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 999;
  display: flex;
  justify-content: flex-end;
}

.nav-drawer {
  width: 280px;
  max-width: 80vw;
  height: 100%;
  background: var(--card-bg, #ffffff);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: slideLeft 0.25s ease;
}

@keyframes slideLeft {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(16px + var(--safe-top)) 20px 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-sub);
  cursor: pointer;
  padding: 4px 8px;
}

.drawer-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.nav-section-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-sub);
  margin-bottom: 12px;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14px 10px;
  border-radius: 12px;
  background: var(--bg);
  color: var(--text-main);
  text-decoration: none;
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.08);
  color: var(--primary);
}

.icon-box {
  font-size: 24px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-egg-img,
.nav-achv-img,
.nav-recipe-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}
</style>
