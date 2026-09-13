import mainia from '../../assets/mascot/hero-046-idle.svg?raw'
import mirabel from '../../assets/mascot/hero-050-idle.svg?raw'
import alexia from '../../assets/mascot/hero-051-idle.svg?raw'
import galatea from '../../assets/mascot/hero-064-idle.svg?raw'
import ulle from '../../assets/mascot/hero-065-idle.svg?raw'
import og from '../../assets/mascot/hero-066-idle.svg?raw'
import { costume } from './mascotCostumePalette.js'

export function createBatch5(make) {
  const left = { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.8)' }
  const right = { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.78)' }
  const skirt = { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.64)' }
  return {
    '046': make('046', mainia, {
      satchelLayer: 'waist',
      parts: ['hairLeft', 'sword', 'satchel', 'skirt', 'torso', 'head'], sleeve: 'miner', legVariant: 'silk',
      iris: '#b66444', irisLight: '#dba865',
      accessories: [left, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(4px, -8px) rotate(3deg)' },
        { selector: '.rig-satchel', standing: 'none', seated: 'scaleY(.82)' }],
      styles: costume('#b4bd76', '#b4bd76', '#8a959a', '#b4bd76', '#b4bd76', '#8c9366', '#82725b')
    }),
    '050': make('050', mirabel, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'horned', legVariant: 'plate',
      iris: '#b65b61', irisLight: '#e89988',
      accessories: [left, right, skirt],
      styles: { ...costume('#ece3cb', '#655546', '#675a4b', '#e5dcc6', '#e4d8bd', '#b7aa82', '#c0a058'),
        '--rig-right-stocking': '#655547', '--rig-right-boot': '#655547', '--rig-armor': '#4a514c', '--rig-spike': '#b3694c' }
    }),
    '051': make('051', alexia, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'silk',
      iris: '#b2974e', irisLight: '#d7c583',
      accessories: [left, right, skirt],
      styles: costume('#41577d', '#e5c5ab', '#e6e0c9', '#e5c5ab', '#e2d9bf', '#837364', '#aeb6a3')
    }),
    '064': make('064', galatea, {
      parts: ['hairLeft', 'hairRight', 'sword', 'torso', 'front', 'head'], sleeve: 'knight', legVariant: 'rune',
      iris: '#9584af', irisLight: '#c8afd2',
      accessories: [left, right, { selector: '.rig-sword', standing: 'none', seated: 'translate(0px, -16px) rotate(3deg)' }],
      styles: { ...costume('#e2d6b6', '#edc7ab', '#b49b70', '#edc7ab', '#edc7ab', '#5e4d49', '#b5a786'), '--rig-armor': '#ae9267' }
    }),
    '065': make('065', ulle, {
      parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'front', 'head'], sleeve: 'coat', legVariant: 'furBoot',
      iris: '#6097b7', irisLight: '#a4d0dc',
      accessories: [left, right, skirt, { selector: '.rig-satchel', standing: 'none', seated: 'translate(0px, -12px)' }],
      styles: costume('#47566e', '#ecccad', '#bba06b', '#e4dec8', '#e4dec8', '#596070', '#d9dccd')
    }),
    '066': make('066', og, {
      parts: ['hairLeft', 'satchel', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'snow', legVariant: 'furBoot',
      iris: '#80b7c6', irisLight: '#b8d7d4',
      accessories: [left, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(0px, -15px) rotate(-4deg)' },
        { selector: '.rig-satchel', standing: 'none', seated: 'translate(-4px, -12px)' }],
      styles: costume('#8293ad', '#e5e3d3', '#e5e3d3', '#635a53', '#665c52', '#7e6a57', '#a95e50')
    })
  }
}
