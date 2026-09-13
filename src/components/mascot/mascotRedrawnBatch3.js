import bardur from '../../assets/mascot/hero-015-idle.svg?raw'
import kiwa from '../../assets/mascot/hero-019-idle.svg?raw'
import kaf from '../../assets/mascot/hero-023-idle.svg?raw'
import gariti from '../../assets/mascot/hero-025-idle.svg?raw'
import belladonna from '../../assets/mascot/hero-026-idle.svg?raw'
import meriri from '../../assets/mascot/hero-027-idle.svg?raw'
import anna from '../../assets/mascot/hero-029-idle.svg?raw'
import { costume } from './mascotCostumePalette.js'

export function createBatch3(make) {
  const hair = (left = .82, right = .75) => [
    { selector: '.rig-hair-left', standing: 'none', seated: `scaleY(${left})` },
    { selector: '.rig-hair-right', standing: 'none', seated: `scaleY(${right})` }
  ]
  const skirt = scale => ({ selector: '.rig-skirt', standing: 'none', seated: `scaleY(${scale})` })
  const stow = (transform = 'translate(0px, -8px) rotate(-5deg)') => ({ selector: '.rig-sword', standing: 'none', seated: transform })
  return {
    '015': make('015', bardur, {
      parts: ['hairLeft', 'hairRight', 'sword', 'skirt', 'torso', 'head'], sleeve: 'fur', legVariant: 'furBoot',
      iris: '#b69b3f', irisLight: '#dfc969',
      accessories: [...hair(), skirt(.75), stow('translate(-7px, -16px) rotate(-3deg)')],
      styles: costume('#bf874e', '#d5b585', '#777657', '#9c7951', '#80765a', '#7e7255', '#b4a67d')
    }),
    '019': make('019', kiwa, {
      parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'front', 'head'], sleeve: 'fur', legVariant: 'silk',
      iris: '#749eae', irisLight: '#c0d4d3',
      accessories: [...hair(), skirt(.65), { selector: '.rig-satchel', standing: 'none', seated: 'translate(-7px, -15px)' }],
      styles: costume('#557481', '#ead2b5', '#e7dbbc', '#e5d7be', '#e5d7be', '#616878', '#b6a273')
    }),
    '023': make('023', kaf, {
      parts: ['hairLeft', 'sword', 'skirt', 'torso', 'head'], sleeve: 'spiked', legVariant: 'wolf',
      iris: '#7caaae', irisLight: '#b5d3cf',
      accessories: [...hair(), skirt(.65), stow('translate(2px, -4px) rotate(3deg)')],
      styles: costume('#d1d3ce', '#d1d3ce', '#565b5d', '#b5a04b', '#9caaaa', '#d1d3ce', '#6f7779')
    }),
    '025': make('025', gariti, {
      parts: ['hairLeft', 'satchel', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'ranger', legVariant: 'archer',
      iris: '#6da491', irisLight: '#b5ce9b',
      accessories: [...hair(), skirt(.65), stow(), { selector: '.rig-satchel', standing: 'none', seated: 'rotate(-8deg)' }],
      styles: { ...costume('#4d4542', '#604c3f', '#756249', '#e8c2ad', '#424749', '#5d4f46', '#a58c70'),
        '--rig-right-stocking': '#e8dfcd', '--rig-right-boot': '#e8dfcd' }
    }),
    '026': make('026', belladonna, {
      satchelLayer: 'shield',
      parts: ['hairLeft', 'hairRight', 'sword', 'satchel', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'archer',
      iris: '#657b9f', irisLight: '#a9abc9',
      accessories: [...hair(), stow(), { selector: '.rig-satchel', standing: 'none', seated: 'translate(10px, -12px) rotate(10deg)' }],
      styles: { ...costume('#434650', '#edc6ad', '#6c81a7', '#edc6ad', '#edc6ad', '#6a6470', '#b0a68c'),
        '--rig-right-stocking': '#e7dfd1' }
    }),
    '027': make('027', meriri, {
      satchelLayer: 'waist',
      parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'silk',
      iris: '#719c83', irisLight: '#b3ce9d',
      accessories: [...hair(), skirt(.6), { selector: '.rig-satchel', standing: 'none', seated: 'translate(-6px, -6px)' }],
      styles: costume('#3f5352', '#e9ccab', '#e7e3cc', '#e4dfcf', '#e4dfcf', '#4b5954', '#a0aea1')
    }),
    '029': make('029', anna, {
      parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'front', 'head'], sleeve: 'fur', legVariant: 'archer',
      iris: '#9186a4', irisLight: '#c3b4cd',
      accessories: [...hair(), skirt(.64), { selector: '.rig-satchel', standing: 'none', seated: 'translate(8px, -8px)' }],
      styles: { ...costume('#474257', '#e7cba9', '#e9e1c5', '#e5dec9', '#e5dec9', '#4c4962', '#b5a06a'),
        '--rig-right-stocking': '#887586' }
    })
  }
}
