import hilSource from '../../assets/mascot/hero-001-idle.svg?raw'
import canaanSource from '../../assets/mascot/hero-055-idle.svg?raw'
import mitoraSource from '../../assets/mascot/hero-002-idle.svg?raw'
import rubySource from '../../assets/mascot/hero-062-idle.svg?raw'
import ivySource from '../../assets/mascot/hero-053-idle.svg?raw'
import lupaSource from '../../assets/mascot/hero-034-idle.svg?raw'
import filinaSource from '../../assets/mascot/hero-049-idle.svg?raw'
import { HIL_ARM_POSES, HIL_LEG_POSES } from './mascotRig.js'
import { fishingGripPoint } from './hilFishingMotion.js'

// Scene-space hand targets remain shared; each model supplies its own shoulders, limb lengths and costume.
const canaanArms = Object.fromEntries(Object.entries(HIL_ARM_POSES).map(([pose, arms]) => [pose, arms.map(arm => ({
  ...arm, shoulder: arm.side === 'left' ? [86, 171] : [158, 160], upperLength: 42, forearmLength: 30
}))]))
canaanArms.idle = canaanArms.idle.map(arm => ({ ...arm, hand: arm.side === 'left' ? [76, 252] : [174, 242] }))
canaanArms.think[0] = { ...canaanArms.think[0], hand: [86, 251] }
canaanArms.think[1] = { ...canaanArms.think[1], hand: [144, 143], upperLength: 32, forearmLength: 40 }
canaanArms['think-raise'][0] = canaanArms.think[0]
const canaanFishing = { parkedOffsetX: 40 }
canaanArms['fish-reach'][1] = { ...canaanArms['fish-reach'][1], hand: fishingGripPoint(0, canaanFishing.parkedOffsetX) }
const mitoraArms = Object.fromEntries(Object.entries(HIL_ARM_POSES).map(([pose, arms]) => [pose, arms.map(arm => ({ ...arm }))]))
mitoraArms.idle = mitoraArms.idle.map(arm => ({ ...arm, hand: arm.side === 'left' ? [76, 246] : [174, 242] }))
mitoraArms.think[1] = { ...mitoraArms.think[1], hand: [142, 152], upperLength: 32, forearmLength: 35 }
const mitoraFishing = { parkedOffsetX: 40 }
mitoraArms['fish-reach'][1] = { ...mitoraArms['fish-reach'][1], hand: fishingGripPoint(0, mitoraFishing.parkedOffsetX) }
const adaptArms = (chin, shoulders = [[88, 166], [158, 166]]) => {
  const arms = Object.fromEntries(Object.entries(HIL_ARM_POSES).map(([pose, pair]) => [pose, pair.map((arm, i) => ({ ...arm, shoulder: shoulders[i] }))]))
  arms.think[1] = { ...arms.think[1], hand: chin, upperLength: 30, forearmLength: 37 }
  arms['fish-reach'][1] = { ...arms['fish-reach'][1], hand: fishingGripPoint(0, 40) }
  return arms
}
const models = {
  '062': {
    id: '062', source: rubySource, partAttribute: 'data-rig-part', artOffset: -10,
    parts: ['satchel', 'torso', 'front', 'head'], arms: adaptArms([141, 151]), legs: HIL_LEG_POSES,
    pupilColors: ['#718b49', '#a5bf67', '#52683c', '#f8f6d8'], sleeve: 'garden', legVariant: 'garden', fishing: { parkedOffsetX: 40 },
    accessories: [{ selector: '.rig-satchel', standing: 'none', seated: 'translate(-3px, -8px) scaleY(.85)' }],
    styles: {
      '--rig-outline': '#615b45', '--rig-sleeve': '#d5d5b9', '--rig-fold': '#aaa78b', '--rig-cuff': '#ece4cb',
      '--rig-glove': '#998064', '--rig-thumb': '#92785e', '--rig-trim': '#d4c7a3', '--rig-shoulder': '#93a65e',
      '--rig-thigh': '#f2cbb0', '--rig-stocking': '#f2cbb0', '--rig-boot': '#8c8468', '--rig-boot-trim': '#ad7468',
      '--rig-knee-trim': '#e7e4cf', '--rig-leg-fold': '#e7e4cf', '--mascot-eyes-origin': '136px 116px'
    }
  },
  '053': {
    id: '053', source: ivySource, partAttribute: 'data-rig-part', artOffset: -16,
    parts: ['sword', 'hairRight', 'torso', 'head'], arms: adaptArms([140, 154]), legs: HIL_LEG_POSES,
    pupilColors: ['#548e79', '#81b199', '#365f53', '#dce4ce'], sleeve: 'leaf', legVariant: 'gaiter', fishing: { parkedOffsetX: 40 },
    accessories: [
      { selector: '.rig-sword', standing: 'translate(3px, 18px) rotate(-9deg)', seated: 'translate(3px, -5px) rotate(-9deg)' },
      { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.7)' }
    ],
    styles: {
      '--rig-outline': '#504c47', '--rig-sleeve': '#353c35', '--rig-fold': '#70806d', '--rig-cuff': '#9daa75',
      '--rig-glove': '#ebcbb0', '--rig-thumb': '#ebcbb0', '--rig-trim': '#ae8d76',
      '--rig-thigh': '#e4dfd0', '--rig-stocking': '#e4dfd0', '--rig-knee-trim': '#b6a569', '--rig-leg-fold': '#c8c5b6',
      '--rig-boot': '#928478', '--rig-boot-trim': '#eee7d6', '--rig-hair-right-origin': '123px 164px',
      '--mascot-eyes-origin': '139px 123px', '--mascot-pendant-origin': '42px 104px'
    }
  },
  '034': {
    id: '034', source: lupaSource, partAttribute: 'data-rig-part', artOffset: -3,
    parts: ['hairLeft', 'hairRight', 'sword', 'torso', 'head'], arms: adaptArms([139, 143]), legs: HIL_LEG_POSES,
    pupilColors: ['#a192a5', '#73677e', '#efe8df'], sleeve: 'fur', legVariant: 'gaiter', fishing: { parkedOffsetX: 40 },
    accessories: [
      { selector: '.rig-sword', standing: 'translate(15px, -12px) scale(0.85) rotate(35deg)', seated: 'translate(15px, -12px) scale(0.85) rotate(35deg)' },
      { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.85)' },
      { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.8)' }
    ],
    styles: {
      '--rig-outline': '#635767', '--rig-sleeve': '#ede8da', '--rig-fold': '#9bc0ba', '--rig-cuff': '#a5c9c2',
      '--rig-glove': '#f0cdb2', '--rig-thumb': '#f0cdb2', '--rig-trim': '#bd9582',
      '--rig-thigh': '#efd0b8', '--rig-stocking': '#e1e0d8', '--rig-knee-trim': '#a3c8c3', '--rig-leg-fold': '#b3b6b2',
      '--rig-boot': '#a8a6bc', '--rig-boot-trim': '#eee6e4', '--rig-hair-left-origin': '81px 96px',
      '--rig-hair-right-origin': '168px 140px', '--mascot-eyes-origin': '130px 105px'
    }
  },
  '049': {
    id: '049', source: filinaSource, partAttribute: 'data-rig-part', artOffset: -40,
    parts: ['hairLeft', 'hairRight', 'satchel', 'skirt', 'torso', 'head'], arms: adaptArms([135, 151]), legs: HIL_LEG_POSES,
    pupilColors: ['#9c7445', '#ddb879', '#604334', '#f8e5ba'], sleeve: 'fur', legVariant: 'paw', fishing: { parkedOffsetX: 40 },
    accessories: [
      { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.82)' },
      { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.82)' },
      { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.7)' }
    ],
    styles: {
      '--rig-outline': '#70563c', '--rig-sleeve': '#dfc49e', '--rig-fold': '#a77b55', '--rig-cuff': '#e5dcc0',
      '--rig-glove': '#f1cca8', '--rig-thumb': '#f1cca8', '--rig-trim': '#b38967',
      '--rig-thigh': '#f1c9a4', '--rig-stocking': '#edc39c', '--rig-knee-trim': '#846951', '--rig-leg-fold': '#edc39c',
      '--rig-boot': '#9a6a43', '--rig-boot-trim': '#e1d1a5', '--rig-sole': '#68432f',
      '--rig-hair-left-origin': '91px 97px', '--rig-hair-right-origin': '149px 103px', '--mascot-eyes-origin': '160px 123px'
    }
  },
  '001': {
    id: '001', source: hilSource, partAttribute: 'data-hil-part',
    parts: ['hairLeft', 'hairRight', 'satchel', 'torso', 'head'],
    pupilColors: ['#b45e53', '#ed9473', '#8c4946', '#fff4df'],
    arms: HIL_ARM_POSES, legs: HIL_LEG_POSES, styles: {}, accessories: []
  },
  '055': {
    id: '055', source: canaanSource, partAttribute: 'data-rig-part',
    parts: ['hairLeft', 'hairRight', 'sword', 'torso', 'front', 'head'],
    pupilColors: ['#a88b4c', '#d7b767', '#695441', '#fff4dd'],
    arms: canaanArms, legs: HIL_LEG_POSES, sleeve: 'ruffle', legVariant: 'gaiter', fishing: canaanFishing,
    accessories: [
      { selector: '.rig-sword', standing: 'rotate(0deg)', seated: 'rotate(-12deg)' },
      { selector: '.rig-cape', standing: 'scaleY(1)', seated: 'scaleY(.86)' }
    ],
    styles: {
      '--rig-outline': '#444957', '--rig-sleeve': '#eee9d8', '--rig-fold': '#c1c4b8',
      '--rig-cuff': '#f6efdf', '--rig-glove': '#f0c8a7', '--rig-thumb': '#f0c8a7', '--rig-trim': '#bb8e79',
      '--rig-thigh': '#f0caae', '--rig-stocking': '#6c6060', '--rig-knee-trim': '#a09483',
      '--rig-leg-fold': '#817472', '--rig-boot': '#394459', '--rig-boot-trim': '#a9b5b5',
      '--rig-sole': '#30394b', '--rig-hair-left-origin': '84px 82px', '--rig-hair-right-origin': '125px 147px',
      '--mascot-eyes-origin': '125px 107px'
    }
  },
  '002': {
    id: '002', source: mitoraSource, partAttribute: 'data-rig-part',
    parts: ['hairLeft', 'hairRight', 'torso', 'front', 'head'],
    pupilColors: ['#68454b', '#a77265', '#46353e', '#fff8e8', '#f5d4b3'],
    arms: mitoraArms, legs: HIL_LEG_POSES, sleeve: 'wrap', legVariant: 'mitora', fishing: mitoraFishing,
    accessories: [
      { selector: '.rig-hair-left', standing: 'scaleY(1)', seated: 'scaleY(.82)' },
      { selector: '.rig-hair-right', standing: 'scaleY(1)', seated: 'scaleY(.84)' }
    ],
    styles: {
      '--rig-outline': '#59403c', '--rig-sleeve': '#55535a', '--rig-fold': '#39323b',
      '--rig-cuff': '#eee4cd', '--rig-glove': '#f4c7a7', '--rig-thumb': '#f4c7a7', '--rig-trim': '#bd8773',
      '--rig-shoulder': '#6e5961', '--rig-seam': '#9aa879', '--rig-wrap-stitch': '#b9b5a5',
      '--rig-thigh': '#f0c4a3', '--rig-stocking': '#483e4b', '--rig-knee-trim': '#d8b99f',
      '--rig-boot': '#49414b', '--rig-boot-trim': '#567391', '--rig-sole': '#38313b',
      '--rig-hair-left-origin': '77px 111px', '--rig-hair-right-origin': '172px 109px',
      '--mascot-eyes-origin': '120px 116px', '--mascot-ear-origin': '172px 63px',
      '--mascot-pendant-origin': '129px 178px'
    }
  }
}
models['034'].arms.think[1] = { ...models['034'].arms.think[1], upperLength: 26, forearmLength: 41 }
export const hasMascotRig = id => Boolean(models[id])
export const getMascotModel = id => models[id] || models['001']
export const accessoryTransform = (accessory, pose) => ['idle', 'think', 'think-raise'].includes(pose) ? accessory.standing : accessory.seated
export function accessoryTracks(model, from, to) {
  return model.accessories.map(accessory => ({ selector: accessory.selector,
    frames: [from, to].map(pose => ({ transform: accessoryTransform(accessory, pose) })) }))
}
