import portwin from '../../assets/mascot/hero-031-idle.svg?raw'
import upa from '../../assets/mascot/hero-033-idle.svg?raw'
import belka from '../../assets/mascot/hero-036-idle.svg?raw'
import ke from '../../assets/mascot/hero-037-idle.svg?raw'
import editi from '../../assets/mascot/hero-041-idle.svg?raw'
import analoje from '../../assets/mascot/hero-043-idle.svg?raw'
import elfipa from '../../assets/mascot/hero-045-idle.svg?raw'
import { costume } from './mascotCostumePalette.js'

export function createBatch4(make) {
  const cape = { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.78)' }
  const skirt = { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.66)' }
  const tail = { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.76)' }
  return {
    '031': make('031', portwin, {
      parts: ['hairLeft', 'satchel', 'torso', 'front', 'head'], sleeve: 'ranger', legVariant: 'sita',
      iris: '#9181ac', irisLight: '#c0b0d1',
      accessories: [cape, { selector: '.rig-satchel', standing: 'none', seated: 'translate(0px, -18px) rotate(7deg)' }],
      styles: costume('#e7deca', '#766050', '#73604c', '#63734f', '#e3ddc9', '#665847', '#ad9776')
    }),
    '033': make('033', upa, {
      parts: ['hairLeft', 'hairRight', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'knight', legVariant: 'plate',
      iris: '#987a9e', irisLight: '#ca9aba',
      accessories: [cape, tail, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(-9px, -10px) rotate(-3deg)' }],
      styles: { ...costume('#e6bcaa', '#e6bcaa', '#bec9c5', '#e6bcaa', '#566179', '#4d5368', '#a8b6bc'), '--rig-armor': '#515c7b' }
    }),
    '036': make('036', belka, {
      parts: ['hairLeft', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'sita',
      iris: '#899b5b', irisLight: '#c2c787',
      accessories: [cape, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(4px, -12px) rotate(-3deg)' }],
      styles: costume('#414844', '#e6c7a8', '#e0dcc6', '#e6c7a8', '#565b53', '#50544d', '#b09b62')
    }),
    '037': make('037', ke, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'tiger', legVariant: 'tiger',
      iris: '#a5a04d', irisLight: '#d8d18a',
      accessories: [cape, tail, skirt],
      styles: { ...costume('#e3ddc9', '#515455', '#625d51', '#b3a15d', '#d4cdb5', '#e5dfcd', '#b49d60'), '--rig-stripe': '#b6a069' }
    }),
    '041': make('041', editi, {
      parts: ['hairLeft', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'knight', legVariant: 'plate',
      iris: '#a86c93', irisLight: '#d29bb7',
      accessories: [cape, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(4px, -12px) rotate(-3deg)' }],
      styles: { ...costume('#475777', '#9baab1', '#c9d2cc', '#e2bca8', '#748691', '#9baab1', '#d1d8cd'), '--rig-armor': '#9baab1' }
    }),
    '043': make('043', analoje, {
      parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'furBoot',
      iris: '#599abb', irisLight: '#a2d4d5',
      accessories: [cape, tail, skirt, { selector: '.rig-satchel', standing: 'none', seated: 'translate(-2px, -12px) scaleY(.9)' }],
      styles: costume('#3c4c64', '#edcdae', '#e8dfc7', '#edcdae', '#edcdae', '#486785', '#91c0bb')
    }),
    '045': make('045', elfipa, {
      parts: ['hairLeft', 'hairRight', 'sword', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'archer',
      iris: '#ae6f9a', irisLight: '#d6a1c1',
      accessories: [cape, tail, skirt, { selector: '.rig-sword', standing: 'none', seated: 'translate(-8px, -8px) rotate(-2deg)' }],
      styles: { ...costume('#6b528b', '#e8c4ad', '#a37bad', '#e8c4ad', '#e7dfcc', '#716087', '#b8a377'), '--rig-right-stocking': '#a47daa' }
    })
  }
}
