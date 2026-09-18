<template>
  <NavigationMenu
    :is-open="isOpen"
    :menu-mode="menuMode"
    :is-desktop="isDesktop"
    :items="liteNavList"
    @close="emit('close')"
  />
</template>

<script setup>
import NavigationMenu from './NavigationMenu.vue'

defineProps({
  isOpen: Boolean,
  menuMode: {
    type: String,
    default: 'side'
  },
  isDesktop: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const liteNavList = [
  { name: '角色图鉴', path: '/heroes', icon: '/ui/class_icon_s_zs.png' },
  { name: '魔物图鉴', path: '/pets', icon: '/ui/colect_mon_072.webp' },
  { name: '菜谱查询', path: '/recipes', icon: '/ui/item_30047.webp' },
  { name: '魔物收益', path: '/petseggs', icon: '/ui/pet_079.webp' },
  { name: '成就查询', path: '/achievement', icon: '/ui/achv_icon_adv.webp' }
]
</script>
