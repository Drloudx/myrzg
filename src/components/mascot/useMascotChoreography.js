import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createPoseTracks } from './mascotRig.js'
import { accessoryTracks } from './mascotModels.js'
import { useMascotSequence } from './useMascotSequence.js'
import { FISH_LINE, fishingLineTracks, fishingPickupTracks } from './hilFishingMotion.js'

export function useMascotChoreography(props, root, model) {
  const poseTracks = (from, to) => createPoseTracks(model, from, to)
  const scene = ref(props.action), pose = ref(props.action), stage = ref('loop')
  const placement = ref(props.action === 'fish' ? 'translate(0 32)' : 'translate(40 32)')
  const clips = useMascotSequence(root, () => props.playing)
  let requested = props.action, settled = props.action, revision = 0, busy = false
  const track = (selector, frames) => ({ selector, frames })
  const move = points => track('.hil-model-placement', points.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })))
  const propsOpacity = (from, to) => ['.hil-environment', '.hil-seat-props'].map(selector => track(selector, [{ opacity: from }, { opacity: to }]))

  function snap() {
    revision++
    clips.stop()
    busy = false
    scene.value = pose.value = settled = requested
    placement.value = requested === 'fish' ? 'translate(0 32)' : 'translate(40 32)'
    stage.value = 'loop'
  }
  async function changePose(target, duration, extras = []) {
    const complete = await clips.run([...poseTracks(pose.value, target), ...accessoryTracks(model, pose.value, target), ...extras], duration)
    if (complete) pose.value = target
    return complete
  }
  async function walk(points, duration) {
    const legs = model.legs.idle.flatMap(leg => {
      const angle = leg.thighAngle, direction = leg.side === 'left' ? 1 : -1
      return [track(`.mascot-leg[data-side="${leg.side}"] .rig-thigh`, [angle, angle + direction * 16, angle - direction * 12, angle].map(value => ({ transform: `rotate(${value}deg)` })))]
    })
    return clips.run([move(points), ...legs], duration)
  }

  // Capture the live swing/head/knee angles before stopping their CSS loops, then ease to rest.
  async function brake() {
    const selectors = ['.hil-swing-pendulum', '.hil-shin', '.hil-head', '.hil-right-forearm', '.hil-standing']
    const frozen = selectors.flatMap(selector => [...root.value.querySelectorAll(selector)].map((element, index) => ({
      selector: selector === '.hil-shin' ? `.hil-shin-${index === 0 ? 'left' : 'right'}` : selector,
      transform: getComputedStyle(element).transform
    })))
    stage.value = 'brake'
    await nextTick()
    return clips.run(frozen.map(({ selector, transform }) => track(selector, [{ transform }, { transform: 'none' }])), 600)
  }
  async function leaveSwing() {
    if (!await brake()) return false
    stage.value = 'release'
    if (!await changePose('jump', 320)) return false
    stage.value = 'jump'
    if (!await clips.run([move([[40, 32], [34, 8], [22, 18], [16, 44]])], 580, 'linear')) return false
    stage.value = 'land'
    if (!await changePose('idle', 420, [move([[16, 44], [16, 48], [16, 32]])])) return false
    stage.value = 'depart'
    if (!await walk([[16, 32], [28, 30], [40, 32]], 420)) return false
    stage.value = 'hide'
    return clips.run(propsOpacity(1, 0), 300)
  }
  async function enterSwing() {
    stage.value = 'appear'
    scene.value = 'swing'
    pose.value = 'idle'
    await nextTick()
    if (!await clips.run([...propsOpacity(0, 1), move([[40, 32], [12, 44]])], 400)) return false
    stage.value = 'approach'
    if (!await walk([[12, 44], [26, 41], [40, 44]], 520)) return false
    stage.value = 'grip'
    // Hands reach first, while both feet still stand on the ground.
    const armTracks = poseTracks('idle', 'swing').filter(item => item.selector.includes('.mascot-arm'))
    if (!await clips.run(armTracks, 480)) return false
    stage.value = 'sit'
    const legTracks = poseTracks('idle', 'swing').filter(item => item.selector.includes('.mascot-leg'))
    if (!await clips.run([...legTracks, ...accessoryTracks(model, 'idle', 'swing'), move([[40, 44], [40, 27], [40, 32]])], 600)) return false
    pose.value = 'swing'
    // Start the loop from its exact -6 degree endpoint, so the seat never snaps sideways.
    stage.value = 'settle'
    return clips.run([track('.hil-swing-pendulum', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-6deg)' }]),
      track('.hil-shin-left', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)' }]),
      track('.hil-shin-right', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)' }]),
      track('.hil-head', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2deg)' }])], 500)
  }
  async function enterFish() {
    stage.value = 'fish-appear'
    scene.value = 'fish'
    pose.value = 'idle'
    await nextTick()
    if (!await clips.run([...propsOpacity(0, 1), track('.hil-fishing-front', [{ opacity: 0 }, { opacity: 1 }])], 400)) return false
    stage.value = 'fish-turn'
    if (!await clips.run([move([[40, 32], [20, 30], [0, 32]]),
      track('.hil-facing', [{ transform: 'none' }, { transform: 'scaleX(.88) skewY(2deg)' }]),
      track('.hil-head', [{ transform: 'none' }, { transform: 'translateX(3px) rotate(-3deg)' }])], 600)) return false
    stage.value = 'fish-sit'
    if (!await changePose('fish-rest', 600, [move([[0, 32], [0, 37], [0, 32]]),
      track('.hil-facing', [{ transform: 'scaleX(.88) skewY(2deg)' }, { transform: 'none' }]),
      track('.hil-head', [{ transform: 'translateX(3px) rotate(-3deg)' }, { transform: 'none' }])])) return false
    stage.value = 'fish-reach'
    if (!await changePose('fish-reach', 400)) return false
    stage.value = 'fish-pickup'
    if (!await clips.run(fishingPickupTracks(model), 800)) return false
    pose.value = 'fish'
    stage.value = 'fish-cast'
    await nextTick()
    if (!await clips.run([...fishingLineTracks(), track('.hil-water-effects', [{ opacity: 0 }, { opacity: 0, offset: .75 }, { opacity: 1 }])], 1000, 'linear')) return false
    stage.value = 'fish-watch'
    const complete = await clips.run([track('.hil-head', [{ transform: 'none' }, { transform: 'rotate(3deg)' }])], 300)
    if (complete) placement.value = 'translate(0 32)'
    return complete
  }
  async function leaveFish() {
    // A request may arrive during a bite: capture rod, line and float together before stopping the loop.
    const defaults = [
      ['.hil-rod', 'd', "path('M106 210Q166 150 216 150')"],
      ['.hil-fishing-line', 'd', `path('${FISH_LINE}')`],
      ['.hil-bobber', 'transform', 'none'], ['.hil-caught-fish', 'opacity', '0'],
      ['.hil-reel', 'transform', 'none'], ['.hil-reeling-hand', 'transform', 'none'],
      ['.hil-rod-hand', 'transform', 'none'], ['.hil-head', 'transform', 'none']
    ]
    const frozen = defaults.map(([selector, property, value]) => track(selector, [
      { [property]: getComputedStyle(root.value.querySelector(selector)).getPropertyValue(property) }, { [property]: value }
    ]))
    stage.value = 'fish-brake'
    await nextTick()
    if (!await clips.run(frozen, 500)) return false
    stage.value = 'fish-reel'
    if (!await clips.run([...fishingLineTracks(true),
      track('.hil-reel', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-720deg)' }]),
      track('.hil-reeling-hand', [0, -10, 6, -10, 6, 0].map(angle => ({ transform: `rotate(${angle}deg)` }))),
      track('.hil-water-effects', [{ opacity: 1 }, { opacity: 0 }])], 1100, 'linear')) return false
    stage.value = 'fish-put'
    if (!await clips.run(fishingPickupTracks(model, true), 850)) return false
    pose.value = 'fish-reach'
    stage.value = 'fish-release'
    if (!await changePose('fish-rest', 350)) return false
    stage.value = 'fish-rise'
    if (!await changePose('idle', 600, [move([[0, 32], [0, 24], [0, 32]])])) return false
    stage.value = 'fish-depart'
    if (!await walk([[0, 32], [20, 30], [40, 32]], 500)) return false
    stage.value = 'fish-hide'
    return clips.run([...propsOpacity(1, 0), track('.hil-fishing-front', [{ opacity: 1 }, { opacity: 0 }])], 350)
  }
  async function enterThink() {
    scene.value = 'think'
    pose.value = 'idle'
    stage.value = 'think-raise'
    await nextTick()
    if (!await changePose('think-raise', 400)) return false
    stage.value = 'think-chin'
    if (!await changePose('think', 500)) return false
    stage.value = 'think-tilt'
    if (!await clips.run([track('.hil-head', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(4deg)' }])], 400)) return false
    pose.value = 'think'
    return true
  }
  async function leaveThink() {
    const head = getComputedStyle(root.value.querySelector('.hil-head')).transform
    const reset = ['.hil-right-forearm', '.hil-pupils', '.hil-thinking-hand .mascot-thumb', '.hil-standing'].map(selector => {
      const element = root.value.querySelector(selector)
      return track(selector, [{ transform: getComputedStyle(element).transform }, { transform: 'none' }])
    })
    stage.value = 'think-lower'
    await nextTick()
    if (!await changePose('idle', 600, [...reset, track('.hil-head', [{ transform: head }, { transform: head }])])) return false
    stage.value = 'think-reset'
    return clips.run([track('.hil-head', [{ transform: head }, { transform: 'none' }])], 350)
  }
  async function drive() {
    if (busy || requested === settled) return
    if (props.preview || props.reducedMotion || props.paused) return snap()
    busy = true
    const version = revision
    while (requested !== settled && version === revision) {
      if (settled === 'swing') {
        if (!await leaveSwing()) return
      } else if (settled === 'fish') {
        if (!await leaveFish()) return
      } else if (settled === 'think') {
        if (!await leaveThink()) return
      }
      if (version !== revision) return
      // Complete an exit before reading the latest request. A new click never tears down a live clip.
      clips.clear()
      scene.value = pose.value = 'idle'
      placement.value = 'translate(40 32)'
      settled = 'idle'
      const target = requested
      if (target === 'swing') {
        if (!await enterSwing()) return
      } else if (target === 'fish') {
        if (!await enterFish()) return
      } else if (target === 'think') {
        if (!await enterThink()) return
      } else {
        scene.value = pose.value = target
        placement.value = target === 'fish' ? 'translate(0 32)' : 'translate(40 32)'
      }
      if (version !== revision) return
      settled = target
      stage.value = 'loop'
      await nextTick()
      clips.clear()
    }
    busy = false
  }
  watch(() => props.action, value => { requested = value; drive() })
  watch(() => props.reducedMotion, reduced => { if (reduced) snap() })
  onBeforeUnmount(() => { revision++ })
  return { scene, pose, stage, placement }
}
