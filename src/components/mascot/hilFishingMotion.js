import { createPoseTracks } from './mascotRig.js'

export const FISH_LINE = 'M216 150Q203 227 180 310'
export const FISH_LINE_STOWED = 'M216 150Q215 162 214 174'
// A matrix is valid both as an SVG presentation attribute and a CSS animation value.
// The prop therefore has its parked pose at creation, before any stylesheet is applied.
export function fishingParkedTransform(offsetX = 0) {
  const angle = -50 * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  return `matrix(${cos}, ${sin}, ${-sin}, ${cos}, ${6 + offsetX}, 87)`
}

// Keep the stowed prop, reach pose and pickup/put-down tracks on the same grip path.
export function fishingGripPoint(progress, parkedOffsetX = 0) {
  const angle = -50 * (1 - progress) * Math.PI / 180
  const x = 144 - 28 * progress - 88, y = 184 + 16 * progress - 225
  const rodX = 88 + (6 + parkedOffsetX) * (1 - progress) + x * Math.cos(angle) - y * Math.sin(angle)
  const rodY = 225 + 87 * (1 - progress) + x * Math.sin(angle) + y * Math.cos(angle)
  return [(rodX * .9 + 24) / .7, (rodY - 87) / .7]
}

// The right hand slides along the shaft while lifting/putting down the same rod.
// These coordinates use the actual tackle transform, so the wrist follows its grip point.
export function fishingPickupTracks(model, reverse = false) {
  const tracks = createPoseTracks(model, reverse ? 'fish' : 'fish-reach', reverse ? 'fish-reach' : 'fish', (side, progress) => {
    if (side !== 1) return
    const t = reverse ? 1 - progress : progress
    return { hand: fishingGripPoint(t, model.fishing?.parkedOffsetX) }
  })
  const parked = fishingParkedTransform(model.fishing?.parkedOffsetX)
  tracks.push({ selector: '.hil-tackle', frames: (reverse ? ['none', parked] : [parked, 'none']).map(transform => ({ transform })) })
  return tracks
}

export function fishingLineTracks(reverse = false) {
  const points = [
    { d: FISH_LINE_STOWED, transform: 'translate(34px, -136px)' },
    { d: 'M216 150Q210 185 198 225', transform: 'translate(18px, -85px)' },
    { d: FISH_LINE, transform: 'translate(0px, 0px)' }
  ]
  if (reverse) points.reverse()
  return [
    { selector: '.hil-fishing-line', frames: points.map(({ d }) => ({ d: `path('${d}')` })) },
    { selector: '.hil-line-end', frames: points.map(({ transform }) => ({ transform })) }
  ]
}
