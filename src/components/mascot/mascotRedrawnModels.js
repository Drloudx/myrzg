import lapis from '../../assets/mascot/hero-007-idle.svg?raw'
import shakutara from '../../assets/mascot/hero-008-idle.svg?raw'
import cocona from '../../assets/mascot/hero-009-idle.svg?raw'
import tisa from '../../assets/mascot/hero-011-idle.svg?raw'
import wolfga from '../../assets/mascot/hero-012-idle.svg?raw'
import pita from '../../assets/mascot/hero-014-idle.svg?raw'
import { createBatch3 } from './mascotRedrawnBatch3.js'
import { createBatch4 } from './mascotRedrawnBatch4.js'
import { createBatch5 } from './mascotRedrawnBatch5.js'

// Drawings are individually authored; only joint solving and scene coordinates
// are shared. Every color here belongs to a checked reference costume.
export function createRedrawnModels(adaptArms, legs) {
  const make = (id, source, options) => ({
    id, source, partAttribute: 'data-rig-part', legs,
    arms: adaptArms(options.chin || [138, 150]),
    pupilColors: [options.iris, options.irisLight, '#4d4c52', '#fff5dd'],
    fishing: { parkedOffsetX: 40 }, accessories: [], ...options,
    styles: {
      '--rig-outline': '#514b48', '--mascot-eyes-origin': '125px 110px',
      '--rig-hair-left-origin': '123px 100px', '--rig-hair-right-origin': '123px 208px',
      ...options.styles
    }
  })
  return {
    ...createBatch3(make),
    ...createBatch4(make),
    ...createBatch5(make),
    '007': make('007', lapis, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'ruffle', legVariant: 'silk',
      iris: '#929cb3', irisLight: '#c9c3d6',
      accessories: [
        { selector: '.rig-hair-left', standing: 'none', seated: 'scale(.92, .88)' },
        { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.75)' },
        { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.75)' }
      ],
      styles: {
        '--rig-sleeve': '#a9c4b4', '--rig-fold': '#77958e', '--rig-cuff': '#c0a666',
        '--rig-glove': '#efd0ba', '--rig-thumb': '#e7bda7', '--rig-trim': '#b59378',
        '--rig-thigh': '#eed8c5', '--rig-stocking': '#eed8c5', '--rig-knee-trim': '#86a99c',
        '--rig-leg-fold': '#dbc7b5', '--rig-boot': '#ecd3be', '--rig-boot-trim': '#86a99c', '--rig-sole': '#a18b7a'
      }
    }),
    '008': make('008', shakutara, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'flame', legVariant: 'silk',
      iris: '#689e92', irisLight: '#a3d0b7',
      accessories: [
        { selector: '.rig-hair-left', standing: 'none', seated: 'scale(.94, .88)' },
        { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.7)' },
        { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.8)' }
      ],
      styles: {
        '--rig-sleeve': '#423e48', '--rig-fold': '#bc5e4e', '--rig-cuff': '#b59a50',
        '--rig-glove': '#ad806b', '--rig-thumb': '#9e715f', '--rig-trim': '#765a52', '--rig-shoulder': '#b29651',
        '--rig-thigh': '#ad806b', '--rig-stocking': '#ad806b', '--rig-knee-trim': '#57454a',
        '--rig-leg-fold': '#a07764', '--rig-boot': '#a67b67', '--rig-boot-trim': '#c0a65c', '--rig-sole': '#665c53'
      }
    }),
    '009': make('009', cocona, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'bandage', legVariant: 'furBoot',
      iris: '#8a8eaf', irisLight: '#c4bfd5',
      accessories: [
        { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.8)' },
        { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.65)' },
        { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.7)' }
      ],
      styles: {
        '--rig-sleeve': '#e6dac0', '--rig-fold': '#ada997', '--rig-cuff': '#cab16c',
        '--rig-glove': '#a6b7c8', '--rig-thumb': '#98a9bd', '--rig-trim': '#78899e',
        '--rig-armlet': '#c1a45e', '--rig-armlet-trim': '#e3cc89',
        '--rig-thigh': '#a6b7c8', '--rig-stocking': '#a6b7c8', '--rig-knee-trim': '#686775',
        '--rig-leg-fold': '#96a7bb', '--rig-boot': '#575762', '--rig-boot-trim': '#c6b579', '--rig-sole': '#444752'
      }
    }),
    '011': make('011', tisa, {
      parts: ['hairLeft', 'hairRight', 'skirt', 'torso', 'front', 'head'], sleeve: 'coat', legVariant: 'silk',
      iris: '#a69ea6', irisLight: '#d0c3c3',
      accessories: [
        { selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.88)' },
        { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.64)' },
        { selector: '.rig-skirt', standing: 'none', seated: 'scaleY(.58)' }
      ],
      styles: {
        '--rig-sleeve': '#444246', '--rig-fold': '#77716c', '--rig-cuff': '#34383b',
        '--rig-glove': '#e9b7af', '--rig-thumb': '#d7a69f', '--rig-trim': '#ac827b',
        '--rig-thigh': '#e9b7af', '--rig-stocking': '#e9b7af', '--rig-knee-trim': '#ab576d',
        '--rig-leg-fold': '#d9a69f', '--rig-boot': '#dca59e', '--rig-boot-trim': '#68464e', '--rig-sole': '#996e69'
      }
    }),
    '012': make('012', wolfga, {
      parts: ['hairLeft', 'hairRight', 'satchel', 'torso', 'front', 'head'], sleeve: 'ranger', legVariant: 'wolf',
      iris: '#a76e3f', irisLight: '#d6a967', chin: [139, 150],
      accessories: [
        { selector: '.rig-hair-left', standing: 'none', seated: 'rotate(8deg)' },
        { selector: '.rig-hair-right', standing: 'none', seated: 'scaleY(.75)' },
        { selector: '.rig-satchel', standing: 'none', seated: 'rotate(-5deg)' }
      ],
      styles: {
        '--rig-sleeve': '#c9c9be', '--rig-fold': '#89968f', '--rig-cuff': '#695847',
        '--rig-glove': '#4a4745', '--rig-thumb': '#615649', '--rig-trim': '#a28c68',
        '--rig-thigh': '#356f70', '--rig-stocking': '#737c7e', '--rig-knee-trim': '#534b46',
        '--rig-leg-fold': '#5a656d', '--rig-boot': '#696b6e', '--rig-boot-trim': '#716052', '--rig-sole': '#434b54'
      }
    }),
    '014': make('014', pita, {
      parts: ['hairLeft', 'torso', 'front', 'head'], sleeve: 'ranger', legVariant: 'fox',
      iris: '#aa893c', irisLight: '#e3c573',
      accessories: [{ selector: '.rig-hair-left', standing: 'none', seated: 'scaleY(.78)' }],
      styles: {
        '--rig-sleeve': '#bc754d', '--rig-fold': '#e1ab7a', '--rig-cuff': '#76573f',
        '--rig-glove': '#805e45', '--rig-thumb': '#9b714e', '--rig-trim': '#c19763',
        '--rig-thigh': '#d7a547', '--rig-stocking': '#bc754d', '--rig-knee-trim': '#3c494e',
        '--rig-leg-fold': '#ac673f', '--rig-boot': '#b9744b', '--rig-boot-trim': '#73543e', '--rig-sole': '#6a513f'
      }
    })
  }
}
