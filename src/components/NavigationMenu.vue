<template>
  <div class="navigation-wrapper">
    <!-- 1. 侧边栏模式 (默认) -->
    <template v-if="menuMode === 'side'">
      <div v-if="isOpen && !isDesktop" class="nav-mask" @click="handleClose"></div>
      <Transition :name="isDesktop ? '' : 'slide-side'">
        <div v-if="isOpen || isDesktop" class="side-panel" :class="{ 'desktop-panel': isDesktop }">
          <div v-if="!isDesktop" class="side-header">
            <div class="side-header-title">
              <h2>功能导航</h2>
              <span class="side-header-sub">深渊之歌助手</span>
            </div>
            <button class="close-btn" @click="handleClose">✕</button>
          </div>
          <div class="side-body">
            <div class="side-category-title">核心功能</div>
            
            <div
              class="side-item"
              :class="{ active: currentRoute === '/petseggs' }"
              @click="handleNavigate('/petseggs')"
            >
              <img :src="getImageUrl('/ui/pet_079.png')" class="icon-img game-sprite" />
              <span class="item-name">魔物收益</span>
              <span class="arrow">›</span>
            </div>

            <div
              class="side-item"
              :class="{ active: currentRoute === '/achievement' }"
              @click="handleNavigate('/achievement')"
            >
              <img :src="getImageUrl('/ui/achv_icon_adv.png')" class="icon-img game-sprite" />
              <span class="item-name">成就查询</span>
              <span class="arrow">›</span>
            </div>

            <div
              class="side-item"
              :class="{ active: currentRoute === '/recipes' }"
              @click="handleNavigate('/recipes')"
            >
              <img :src="getImageUrl('/ui/item_30047.png')" class="icon-img game-sprite" />
              <span class="item-name">菜谱查询</span>
              <span class="arrow">›</span>
            </div>

            <div
              class="side-item"
              :class="{ active: currentRoute === '/items' }"
              @click="handleNavigate('/items')"
            >
              <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
              <span class="item-name">物品图鉴</span>
              <span class="arrow">›</span>
            </div>

            <div
              class="side-item"
              :class="{ active: currentRoute === '/monsters' }"
              @click="handleNavigate('/monsters')"
            >
              <img :src="getImageUrl('/images/PicHandBookPanel/colect_mon_059.png')" class="icon-img game-sprite" />
              <span class="item-name">怪物图鉴</span>
              <span class="arrow">›</span>
            </div>

            <div
              class="side-item"
              :class="{ active: currentRoute === '/rewards' }"
              @click="handleNavigate('/rewards')"
            >
              <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
              <span class="item-name">奖励</span>
              <span class="arrow">›</span>
            </div>

          </div>
        </div>
      </Transition>
    </template>

    <!-- 2. 底部抽屉模式 -->
    <template v-else-if="menuMode === 'bottom'">
      <div v-if="isOpen" class="nav-mask" @click="handleClose"></div>
      <Transition name="slide-bottom">
        <div v-if="isOpen" class="bottom-sheet">
          <div class="sheet-handle" @click="handleClose"></div>
          <div class="sheet-header">
            <h3>功能导航</h3>
            <button class="close-btn" @click="handleClose">✕</button>
          </div>
          <div class="sheet-content">
            <div class="grid-section">
              <div class="grid-category-title">核心功能</div>
              <div class="tools-grid">
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/petseggs' }"
                  @click="handleNavigate('/petseggs')"
                >
                  <img :src="getImageUrl('/ui/pet_079.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">魔物收益</span>
                </div>
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/achievement' }"
                  @click="handleNavigate('/achievement')"
                >
                  <img :src="getImageUrl('/ui/achv_icon_adv.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">成就查询</span>
                </div>
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/recipes' }"
                  @click="handleNavigate('/recipes')"
                >
                  <img :src="getImageUrl('/ui/item_30047.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">菜谱查询</span>
                </div>
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/items' }"
                  @click="handleNavigate('/items')"
                >
                  <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
                  <span class="item-name">物品图鉴</span>
                </div>

                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/monsters' }"
                  @click="handleNavigate('/monsters')"
                >
                  <img :src="getImageUrl('/images/PicHandBookPanel/colect_mon_059.png')" class="icon-img game-sprite" />
                  <span class="item-name">怪物图鉴</span>
                </div>

                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/rewards' }"
                  @click="handleNavigate('/rewards')"
                >
                  <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
                  <span class="item-name">奖励</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <!-- 3. 顶部下拉模式 -->
    <template v-else-if="menuMode === 'top'">
      <Transition name="fade-top">
        <div v-if="isOpen" class="top-overlay" @click="handleClose">
          <div class="top-panel" @click.stop>
            <div class="grid-section">
              <div class="grid-category-title">核心功能</div>
              <div class="tools-grid">
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/petseggs' }"
                  @click="handleNavigate('/petseggs')"
                >
                  <img :src="getImageUrl('/ui/pet_079.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">魔物收益</span>
                </div>
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/achievement' }"
                  @click="handleNavigate('/achievement')"
                >
                  <img :src="getImageUrl('/ui/achv_icon_adv.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">成就查询</span>
                </div>
                <div
                  class="grid-item"
                  :class="{ active: currentRoute === '/recipes' }"
                  @click="handleNavigate('/recipes')"
                >
                  <img :src="getImageUrl('/ui/item_30047.png')" class="icon-img game-sprite" />
                  <span class="grid-item-name">菜谱查询</span>
                </div>
                <div
              class="grid-item"
              :class="{ active: currentRoute === '/items' }"
              @click="handleNavigate('/items')"
            >
              <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
              <span class="item-name">物品图鉴</span>
            </div>

            <div
              class="grid-item"
              :class="{ active: currentRoute === '/monsters' }"
              @click="handleNavigate('/monsters')"
            >
              <img :src="getImageUrl('/images/PicHandBookPanel/colect_mon_059.png')" class="icon-img game-sprite" />
              <span class="item-name">怪物图鉴</span>
            </div>

            <div
              class="grid-item"
              :class="{ active: currentRoute === '/rewards' }"
              @click="handleNavigate('/rewards')"
            >
              <img :src="getImageUrl('/ui/item_00002.png')" class="icon-img game-sprite" />
              <span class="item-name">奖励</span>
            </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getImageUrl } from '../utils/env.js'

const props = defineProps({
  isOpen: Boolean,
  menuMode: {
    type: String,
    default: 'side' // 'side', 'bottom', 'top'
  },
  isDesktop: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['close'])

const route = useRoute()
const router = useRouter()

const currentRoute = computed(() => route.path)

const handleClose = () => {
  emit('close')
}

const handleNavigate = (path) => {
  if (currentRoute.value !== path) {
    router.push(path)
  }
  handleClose()
}
</script>

<style scoped>
/* 蒙版动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 侧边栏过?*/
.slide-side-enter-active, .slide-side-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-side-enter-from, .slide-side-leave-to {
  transform: translateX(100%);
}



/* 顶部下拉过渡 */
.fade-top-enter-active, .fade-top-leave-active {
  transition: opacity 0.2s ease;
}
.fade-top-enter-from, .fade-top-leave-to {
  opacity: 0;
}
.fade-top-enter-active .top-panel, .fade-top-leave-active .top-panel {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-top-enter-from .top-panel, .fade-top-leave-to .top-panel {
  transform: translateY(-15px);
}

/* --- 基础样式 --- */
.nav-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--modal-overlay, rgba(0, 0, 0, 0.4));
  z-index: 1500;
}

/* --- 1. 侧边栏样?--- */
.side-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: 60%;
  max-width: 260px;
  background: var(--bg-color, #ffffff);
  border-left: 1px solid var(--border-color);
  z-index: 1501;
  display: flex;
  flex-direction: column;
}

.side-panel.desktop-panel {
  position: relative;
  width: 170px;
  max-width: none;
  border-left: none;
  background: transparent;
  z-index: 1;
  box-shadow: none;
}

.dark-mode .side-panel:not(.desktop-panel) {
  background: #1e1e1e;
}

.side-header {
  padding: 24px 16px 16px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.05) 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color, #eee);
}
.dark-mode .side-header {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-bottom-color: #333;
}

.side-header-title h2 {
  margin: 0;
  font-size: 17px;
  color: #2196f3;
  font-weight: 700;
}

.side-header-sub {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  display: block;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.side-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.side-category-title {
  font-size: 14px;
  font-weight: 700;
  color: #999;
  padding: 12px 16px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.side-item {
  display: flex;
  align-items: center;
  padding: 12px 12px 12px 20px;
  color: var(--text-color, #333);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.dark-mode .side-item {
  color: #fff;
}

.side-item:hover {
  background: rgba(0, 0, 0, 0.02);
}
.dark-mode .side-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.side-item .icon-img {
  width: 28px;
  height: 28px;
  margin-right: 12px;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 0;
  object-fit: contain;
}

/* 电脑端独立控制图标大小 */
.side-panel.desktop-panel .side-item .icon-img {
  width: 38px;
  height: 38px;
}

.side-item .item-name {
  font-size: 16px;
  font-weight: 700;

}

.side-item .arrow {
  margin-left: auto;
  color: #ccc;
  font-size: 14px;
}

.side-item.active {
  color: #2196f3;
  font-weight: bold;
  background-color: rgba(33, 150, 243, 0.05);
}

.side-item.active::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background-color: #2196f3;
}

/* --- 2. 底部抽屉样式 --- */
.bottom-sheet {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 800px;
  background: var(--bg-color, #ffffff);
  border-radius: 20px 20px 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  z-index: 1501;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
  border-top: 1px solid var(--border-color, #e2e8f0);
  box-sizing: border-box;
}
.dark-mode .bottom-sheet {
  background: #1e1e1e;
  border-top-color: #333;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin: 10px auto 4px;
  cursor: pointer;
}
.dark-mode .sheet-handle {
  background: #444;
}

.sheet-header {
  padding: 8px 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color, #eee);
}
.dark-mode .sheet-header {
  border-bottom-color: #333;
}

.sheet-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-color, #333);
  font-weight: 600;
}
.dark-mode .sheet-header h3 {
  color: #fff;
}

.sheet-content {
  padding: 12px 16px 30px;
  overflow-y: auto;
}

.grid-category-title {
  font-size: 12px;
  font-weight: 700;
  color: #999;
  margin: 14px 0 8px 4px;
}

.grid-section:first-child .grid-category-title {
  margin-top: 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
@media (max-width: 400px) {
  .tools-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.grid-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.dark-mode .grid-item {
  background: #252525;
  border-color: #333;
}

.grid-item:hover {
  background: #f1f5f9;
}
.dark-mode .grid-item:hover {
  background: #333;
}

.grid-item .icon-img {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: var(--input-bg);
  border-radius: 8px;
  padding: 4px;
  object-fit: contain;
}

.grid-item-name {
  font-size: 12px;
  color: var(--text-color, #334155);
  line-height: 1.3;
}
.dark-mode .grid-item-name {
  color: #ccc;
}

.grid-item.active {
  background: rgba(33, 150, 243, 0.05);
  border-color: #2196f3;
  color: #2196f3;
}
.dark-mode .grid-item.active {
  background: rgba(33, 150, 243, 0.15);
}

.grid-item.active .grid-item-name {
  color: #2196f3;
  font-weight: 600;
}

/* --- 3. 顶部下拉样式 --- */
.top-overlay {
  position: fixed;
  top: calc(var(--header-height, 56px) + var(--safe-top, 0px)); /* 从标题栏底部开始 */
  left: 0; right: 0; bottom: 0;
  background: var(--modal-overlay, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 99;
}

.top-panel {
  background: var(--bg-color, #ffffff);
  padding: 16px;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid var(--border-color, #eee);
  max-height: 75vh;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
.dark-mode .top-panel {
  background: #1e1e1e;
  border-bottom-color: #333;
}

</style>

<style scoped>
@media (max-width: 767px) {
  .top-overlay {
    top: calc(var(--header-height, 56px) + 46px + var(--safe-top, 0px));
  }
}
</style>
