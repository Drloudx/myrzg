<template>
  <div class="navigation-wrapper" :class="{ 'is-desktop': isDesktop }">
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
          <div class="side-body paper-panel corner-nails" :class="{ 'is-mobile': !isDesktop }">
            <div class="side-category-title">导航目录</div>

            <!-- 使用 v-for 统一渲染侧边栏列表 -->
            <div
              v-for="item in navList"
              :key="item.path"
              class="side-item"
              :class="{ active: currentRoute === item.path }"
              @click="handleNavigate(item.path)"
            >
              <img :src="getImageUrl(item.icon)" class="icon-img game-sprite" />
              <span class="item-name">{{ item.name }}</span>
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
        <div v-if="isOpen" class="bottom-sheet paper-panel corner-nails">
          <div class="sheet-handle" @click="handleClose"></div>
          <div class="sheet-header">
            <h3>功能导航</h3>
            <button class="close-btn" @click="handleClose">✕</button>
          </div>
          <div class="sheet-content">
            <div class="grid-section">
              <div class="grid-category-title">导航目录</div>
              <div class="tools-grid">
                <div
                  v-for="item in navList"
                  :key="item.path"
                  class="grid-item"
                  :class="{ active: currentRoute === item.path }"
                  @click="handleNavigate(item.path)"
                >
                  <img :src="getImageUrl(item.icon)" class="icon-img game-sprite" />
                  <span class="grid-item-name">{{ item.name }}</span>
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
          <div class="top-panel paper-panel" @click.stop>
            <div class="grid-section">
              <div class="grid-category-title">导航目录</div>
              <div class="tools-grid">
                <div
                  v-for="item in navList"
                  :key="item.path"
                  class="grid-item"
                  :class="{ active: currentRoute === item.path }"
                  @click="handleNavigate(item.path)"
                >
                  <img :src="getImageUrl(item.icon)" class="icon-img game-sprite" />
                  <span class="grid-item-name">{{ item.name }}</span>
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

// --- 统一配置导航数据 ---
const navList = [
  { name: '角色图鉴', path: '/heroes', icon: '/ui/class_icon_s_zs.png' },
  { name: '魔物图鉴', path: '/pets', icon: '/ui/colect_mon_072.png' },
  { name: '菜谱查询', path: '/recipes', icon: '/ui/item_30047.png' },
  { name: '魔物收益', path: '/petseggs', icon: '/ui/pet_079.png' },
  { name: '成就查询', path: '/achievement', icon: '/ui/achv_icon_adv.png' }
]

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

/* 侧边栏过渡 */
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
.navigation-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 非桌面（移动端/原生端）时，外层容器不参与父级弹性布局：
   其内部面板（side/bottom/top）均为 fixed 定位，height:100% 会占满
   主区域高度，导致 .app-main 被压缩为 0、页面内容不可见。 */
.navigation-wrapper:not(.is-desktop) {
  height: 0;
  flex: 0 0 0;
  overflow: visible;
}

.nav-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--modal-overlay, rgba(24, 14, 6, 0.5));
  z-index: 3500;
}

/* --- 1. 侧边栏样式（模板 sidebar 风格） --- */
.side-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: 62%;
  max-width: 270px;
  z-index: 3501;
  display: flex;
  flex-direction: column;
}

.side-panel.desktop-panel {
  position: relative;
  width: 100%;
  max-width: none;
  z-index: 1;
  margin: 0;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.side-header {
  padding: 18px 16px 14px;
  background: linear-gradient(180deg, var(--wood-soft, #463424), var(--wood, #2b1f15));
  border-bottom: 3px solid var(--accent-bright, #7a9a99);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.side-header-title h2 {
  margin: 0;
  font-size: 17px;
  color: var(--paper, #dfceb3);
  font-weight: 700;
  letter-spacing: 2px;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
}

.side-header-sub {
  font-size: 11px;
  color: rgba(223, 206, 179, 0.65);
  margin-top: 3px;
  display: block;
  letter-spacing: 2px;
}

.close-btn {
  background: transparent;
  border: 1px solid rgba(223, 206, 179, 0.35);
  border-radius: 4px;
  font-size: 15px;
  color: var(--paper, #dfceb3);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.close-btn:hover {
  background: rgba(223, 206, 179, 0.15);
}

/* 侧栏面板：移动端铺满可用空间 */
.side-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  border-radius: 0;
  border: none;
  border-left: 2px solid var(--border-color, #8f7351);
  background-color: rgba(223, 206, 179, 0.94);
}
.dark-mode .side-body {
  background-color: rgba(46, 34, 23, 0.95);
}
.side-panel.desktop-panel .side-body {
  flex: 1;
  height: 100%;
  border: 2px solid var(--border-color, #8f7351);
  border-radius: 4px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(135, 107, 72, 0.12);
  box-sizing: border-box;
  overflow-y: auto;
}

.side-category-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  padding: 6px 10px 8px;
  border-bottom: 2px solid var(--border-color, #8f7351);
  margin-bottom: 10px;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  letter-spacing: 2px;
}

.side-item {
  display: flex;
  align-items: center;
  padding: 11px 10px;
  color: var(--text-main, #3e2a14);
  cursor: pointer;
  transition: all 0.18s;
  position: relative;
  border-radius: 4px;
  border-bottom: 1px dashed var(--border-faint, rgba(143, 115, 81, 0.25));
}

.side-item:hover {
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}

.side-item .icon-img {
  width: 28px;
  height: 28px;
  margin-right: 10px;
  flex-shrink: 0;
  border-radius: 5px;
  padding: 0;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.side-panel.desktop-panel .side-item .icon-img {
  width: 34px;
  height: 34px;
}

.side-item .item-name {
  font-size: 15px;
  font-weight: 600;
}

.side-item .arrow {
  margin-left: auto;
  color: var(--border-color, #8f7351);
  font-size: 16px;
  font-weight: bold;
}

.side-item.active {
  color: var(--accent-ink, #557574);
  font-weight: bold;
  background-color: rgba(122, 154, 153, 0.14);
}
.dark-mode .side-item.active {
  color: var(--accent-bright, #93b3b2);
}

.side-item.active::before {
  content: '▸';
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent-bright, #7a9a99);
  font-size: 14px;
}

/* --- 2. 底部抽屉样式 --- */
.bottom-sheet {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 860px;
  border-radius: 10px 10px 0 0;
  border-bottom: none;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  z-index: 3501;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}

.sheet-handle {
  width: 40px;
  height: 5px;
  background: var(--border-color, #8f7351);
  border-radius: 3px;
  margin: 8px auto 6px;
  cursor: pointer;
}

.sheet-header {
  padding: 8px 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--border-color, #8f7351);
}

.sheet-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-main, #3e2a14);
  font-weight: 700;
  letter-spacing: 2px;
}

.sheet-content {
  padding: 12px 16px calc(24px + var(--safe-bottom, 0px));
  overflow-y: auto;
}

.grid-category-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  margin: 14px 0 8px 4px;
  letter-spacing: 1px;
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
  background: rgba(233, 220, 195, 0.7);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 5px;
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.18s;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);
}
.dark-mode .grid-item {
  background: rgba(63, 48, 32, 0.6);
}

.grid-item:hover {
  background: rgba(233, 220, 195, 1);
  border-color: var(--accent-bright, #7a9a99);
}

.grid-item .icon-img {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: rgba(43, 31, 21, 0.08);
  border-radius: 5px;
  padding: 4px;
  object-fit: contain;
  box-sizing: border-box;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.grid-item-name {
  font-size: 12px;
  color: var(--text-main, #3e2a14);
  line-height: 1.3;
  font-weight: 600;
}

.grid-item.active {
  background: var(--wood, #2b1f15);
  border-color: #17100a;
}
.grid-item.active .grid-item-name {
  color: var(--paper, #dfceb3);
  font-weight: 700;
}

/* --- 3. 顶部下拉样式 --- */
.top-overlay {
  position: fixed;
  top: calc(var(--header-height, 60px) + var(--safe-top, 0px));
  left: 0; right: 0; bottom: 0;
  background: var(--modal-overlay, rgba(24, 14, 6, 0.45));
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 3501;
}

.top-panel {
  padding: 16px;
  border-radius: 0 0 10px 10px;
  border-top: none;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  max-height: 75vh;
  overflow-y: auto;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 767px) {
  .top-overlay {
    top: calc(var(--header-height, 60px) + 46px + var(--safe-top, 0px));
  }
}
</style>
