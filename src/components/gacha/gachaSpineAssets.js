/**
 * 抽卡演出骨骼资源清单（路径为 public 相对路径，使用方再过 `getImageUrl`）。
 * 单独成模块：`<script setup>` 不能 export，GachaView 预热与演出面板共用这份定义。
 */
export const PET_SPINE_ASSETS = [
  {
    key: 'bag',
    atlas: '/images/gacha/spine/perform_bag.atlas',
    skeleton: '/images/gacha/spine/perform_bag.skel',
    binary: true,
    skin: 'def',
    premultiply: true
  }
]

export const HERO_SPINE_ASSETS = [
  {
    key: 'elsa',
    atlas: '/images/gacha/spine/elsa_rawcard.atlas',
    skeleton: '/images/gacha/spine/elsa_rawcard.json',
    yOffset: 65,
    premultiply: true
  },
  {
    key: 'desk',
    atlas: '/images/gacha/spine/elsa_rawcard_desk.atlas',
    skeleton: '/images/gacha/spine/elsa_rawcard_desk.json',
    yOffset: 65,
    stretchX: 1.25
  }
]
