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

/**
 * 精简导航条目。
 *
 * 用于热更/上架版本：只保留最常看的几项，避免导航过长。
 * 条目顺序与完整导航（NavigationMenu.vue）保持一致，便于对照增删；
 * 图标沿用完整导航里的同一批（`/ui/*` 与公共图集）。
 *
 * 注：完整导航里的「贸易小车」（`/freight`）**刻意不放进精简版**（按用户要求）；
 * 路由本身仍在，需要时直接访问 `/#/freight`。以后若又要加回，照抄完整导航那条即可。
 */
const liteNavList = [
  { name: '角色图鉴', path: '/heroes', icon: '/ui/class_icon_s_zs.webp' },
  { name: '伙伴邮件', path: '/partner-mails', icon: '/ui/mail_list_new_task_pt.webp' },
  { name: '魔物图鉴', path: '/pets', icon: '/ui/colect_mon_072.webp' },
  { name: '菜谱查询', path: '/recipes', icon: '/ui/item_30047.webp' },
  { name: '魔物收益', path: '/petseggs', icon: '/ui/pet_079.webp' },
  { name: '模拟招募', path: '/gacha', icon: '/images/HeroPoolPanel_Atlas/gacha_at_chara062_0.webp' },
  { name: '成就查询', path: '/achievement', icon: '/ui/achv_icon_adv.webp' }
]
</script>
