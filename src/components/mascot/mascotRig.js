// Model-space joints: camera/layout changes never alter a character's limb or hand size.
export function solveArm({ shoulder, hand, handAngle, upperLength = 40, forearmLength = 27, bend = 1 }) {
  // With a relaxed wrist the palm continues the forearm. Solve to the palm,
  // including its 14px offset, instead of forcing an unrelated wrist rotation.
  const relaxedWrist = handAngle == null
  const lowerReach = forearmLength + (relaxedWrist ? 14 : 0)
  handAngle ??= 0
  const rad = handAngle * Math.PI / 180
  const wrist = relaxedWrist ? hand : [hand[0] + Math.sin(rad) * 14, hand[1] - Math.cos(rad) * 14]
  const dx = wrist[0] - shoulder[0], dy = wrist[1] - shoulder[1]
  const rawDistance = Math.hypot(dx, dy)
  const distance = Math.max(Math.abs(upperLength - lowerReach) + .001, Math.min(upperLength + lowerReach - .001, rawDistance))
  const ux = dx / (rawDistance || 1), uy = dy / (rawDistance || 1)
  const along = (upperLength ** 2 - lowerReach ** 2 + distance ** 2) / (2 * distance)
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)) * bend
  const elbow = [shoulder[0] + ux * along - uy * height, shoulder[1] + uy * along + ux * height]
  const reachedWrist = [shoulder[0] + ux * distance, shoulder[1] + uy * distance]
  const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI - 90
  const forearmAngle = angle(elbow, reachedWrist)
  return { elbow, upperLength, forearmLength, upperAngle: angle(shoulder, elbow), forearmAngle,
    handAngle: relaxedWrist ? forearmAngle : handAngle }
}

export const HIL_ARM_POSES = {
  idle: [
    { side: 'left', shoulder: [88, 166], hand: [70, 241], bend: 1 },
    { side: 'right', shoulder: [158, 166], hand: [176, 241], bend: -1 }
  ],
  swing: [
    { side: 'left', shoulder: [88, 166], hand: [74, 158], bend: -1, grip: 'rope' },
    { side: 'right', shoulder: [158, 166], hand: [168, 158], bend: 1, grip: 'rope' }
  ],
  fish: [
    { side: 'left', shoulder: [88, 166], hand: [147, 197], bend: 1, grip: 'rod' },
    { side: 'right', shoulder: [158, 166], hand: [(116 * .9 + 24) / .7, (200 - 87) / .7], bend: 1, grip: 'rod' }
  ]
}

HIL_ARM_POSES.think = [
  { side: 'left', shoulder: [88, 166], hand: [82, 244], bend: 1 },
  { side: 'right', shoulder: [158, 166], hand: [143, 148], upperLength: 30, forearmLength: 37, bend: -1, grip: 'chin' }
]
HIL_ARM_POSES['think-raise'] = [HIL_ARM_POSES.think[0],
  { side: 'right', shoulder: [158, 166], hand: [172, 207], bend: -1, grip: 'chin' }
]

HIL_ARM_POSES.jump = [
  { side: 'left', shoulder: [88, 166], hand: [56, 216], bend: 1 },
  { side: 'right', shoulder: [158, 166], hand: [193, 216], bend: -1 }
]
HIL_ARM_POSES.land = HIL_ARM_POSES.jump
HIL_ARM_POSES['fish-rest'] = [
  { side: 'left', shoulder: [88, 166], hand: [114, 236], bend: 1 },
  { side: 'right', shoulder: [158, 166], hand: [172, 240], bend: -1 }
]
HIL_ARM_POSES['fish-reach'] = [
  HIL_ARM_POSES['fish-rest'][0],
  { side: 'right', shoulder: [158, 166], hand: [161, 222], bend: 1, grip: 'rod' }
]

export const HIL_LEG_POSES = {
  idle: [
    { side: 'left', hip: [106, 249], thighAngle: 10, shinAngle: 8 },
    { side: 'right', hip: [145, 247], thighAngle: 0, shinAngle: -3 }
  ],
  swing: [
    { side: 'left', hip: [106, 249], thighAngle: -55, shinAngle: 8 },
    { side: 'right', hip: [145, 247], thighAngle: -60, shinAngle: 0 }
  ],
  jump: [
    { side: 'left', hip: [106, 249], thighAngle: -32, shinAngle: 35 },
    { side: 'right', hip: [145, 247], thighAngle: -24, shinAngle: 28 }
  ]
}
HIL_LEG_POSES.fish = HIL_LEG_POSES.swing
HIL_LEG_POSES.land = HIL_LEG_POSES.jump
HIL_LEG_POSES['fish-rest'] = HIL_LEG_POSES.fish
HIL_LEG_POSES['fish-reach'] = HIL_LEG_POSES.fish

// Folded sleeves can redistribute their projected lengths without scaling the
// hands or changing the total arm length. Drawing and transition paths stay identical.
export function armSleevePaths(upper, forearm) {
  return {
    'upper-sleeve': `M-10 0Q0-7 10 0Q8 ${upper / 2} 8 ${upper - 3}Q0 ${upper + 7}-8 ${upper - 3}Q-10 ${upper / 2}-10 0Z`,
    'upper-fold': `M-4 10L-3 ${upper - 8}M5 12L4 ${upper - 6}`,
    'forearm-sleeve': `M-8 0Q0-8 8 0Q10 ${forearm / 2} 8 ${forearm}L-8 ${forearm}Q-10 ${forearm / 2}-8 0Z`,
    'forearm-fold': `M-4 7L-3 ${forearm - 5}M5 9L4 ${forearm - 7}`
  }
}

// Bake a short transition once; the browser interpolates the joints, with no JS frame loop.
export function createPoseTracks(model, fromPose, toPose, armAt) {
  const tracks = []
  const fromArms = model.arms[fromPose] || model.arms.idle
  const toArms = model.arms[toPose] || model.arms.idle
  const mix = (a, b, t) => a + (b - a) * t
  for (let i = 0; i < 2; i++) {
    const from = fromArms[i], to = toArms[i]
    const start = solveArm(from), end = solveArm(to)
    const nearest = (a, b) => a + ((b - a + 540) % 360) - 180
    const frames = { upper: [], forearm: [], wrist: [] }
    const changingSleeves = start.upperLength !== end.upperLength || start.forearmLength !== end.forearmLength
    if (changingSleeves) for (const part of Object.keys(armSleevePaths(start.upperLength, start.forearmLength))) frames[part] = []
    let previousAngles
    for (let sample = 0; sample <= 24; sample++) {
      const t = sample / 24
      const shoulder = from.shoulder.map((v, axis) => mix(v, to.shoulder[axis], t))
      const override = armAt?.(i, t)
      const hand = override?.hand || from.hand.map((v, axis) => mix(v, to.hand[axis], t))
      let joint
      if (armAt) {
        joint = solveArm({ ...to, shoulder, hand, handAngle: override?.handAngle })
      } else {
        // Interpolate the actual joints for free movement: switching the IK bend
        // branch at the first frame would otherwise pop the elbow through the body.
        const upperAngle = mix(start.upperAngle, nearest(start.upperAngle, end.upperAngle), t)
        const startFlex = nearest(0, start.forearmAngle - start.upperAngle)
        // When changing elbow direction, unfold through a straight arm rather
        // than taking the shorter route through a fully folded/backward elbow.
        const endFlex = nearest(0, end.forearmAngle - end.upperAngle)
        const forearmAngle = upperAngle + mix(startFlex, endFlex, t)
        const rad = (upperAngle + 90) * Math.PI / 180
        const upperLength = mix(start.upperLength, end.upperLength, t)
        joint = { upperAngle, forearmAngle, upperLength, forearmLength: mix(start.forearmLength, end.forearmLength, t),
          elbow: [shoulder[0] + Math.cos(rad) * upperLength, shoulder[1] + Math.sin(rad) * upperLength],
          handAngle: forearmAngle + mix(start.handAngle - start.forearmAngle, end.handAngle - end.forearmAngle, t) }
      }
      const angles = [joint.upperAngle, joint.forearmAngle, joint.handAngle - joint.forearmAngle]
      if (previousAngles) angles.forEach((angle, axis) => {
        while (angles[axis] - previousAngles[axis] > 180) angles[axis] -= 360
        while (angles[axis] - previousAngles[axis] < -180) angles[axis] += 360
      })
      previousAngles = angles
      frames.upper.push({ transform: `translate(${shoulder[0]}px, ${shoulder[1]}px) rotate(${angles[0]}deg)` })
      frames.forearm.push({ transform: `translate(${joint.elbow[0]}px, ${joint.elbow[1]}px) rotate(${angles[1]}deg)` })
      frames.wrist.push({ transform: `translate(0px, ${joint.forearmLength}px) rotate(${angles[2]}deg)` })
      if (changingSleeves) for (const [part, d] of Object.entries(armSleevePaths(joint.upperLength, joint.forearmLength))) frames[part].push({ d: `path('${d}')` })
    }
    for (const part of Object.keys(frames)) tracks.push({ selector: `.mascot-arm[data-side="${to.side}"] .rig-${part}`, frames: frames[part] })
  }
  const fromLegs = model.legs[fromPose] || model.legs.idle
  const toLegs = model.legs[toPose] || model.legs.idle
  for (let i = 0; i < 2; i++) {
    const from = fromLegs[i], to = toLegs[i]
    for (const part of ['thigh', 'shin']) {
      const angle = leg => part === 'thigh' ? leg.thighAngle : leg.shinAngle - leg.thighAngle
      tracks.push({ selector: `.mascot-leg[data-side="${to.side}"] .rig-${part}`, frames: [from, to].map(leg => ({ transform: `rotate(${angle(leg)}deg)` })) })
    }
  }
  return tracks
}
