import { expect, test } from '@playwright/test'
import { MASCOTS } from '../../src/config/mascots.js'

const shots = process.env.MASCOT_SCREENSHOT_DIR || 'test-results/hil-sequence'
for (const character of MASCOTS.filter(entry => !entry.idleOnly)) {
test.describe(character.name + ' shared choreography', () => {
test.skip(({ isMobile }) => isMobile, 'Desktop mascot only')
test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
  await page.addInitScript(id => localStorage.setItem('sidebar-mascot-character', id), character.id)
  await page.goto('/#/runes')
  await expect(page.locator('.mascot-art .hil-figure')).toBeVisible()
  await page.evaluate(() => {
    window.originalHilFigure = document.querySelector('.mascot-art .hil-figure')
    window.hilStages = []
    const svg = document.querySelector('.mascot-art .hil-scene')
    new MutationObserver(() => window.hilStages.push(`${svg.dataset.scene}:${svg.dataset.stage}`)).observe(svg, { attributes: true, attributeFilter: ['data-scene', 'data-stage'] })
  })
})
async function choose(page, name) {
  await page.getByRole('button', { name: '选择吉祥物动作' }).click()
  await page.getByRole('button', { name: `使用${name}动作` }).click()
}
async function inspectStagesManually(page) {
  // Hold finite clips at creation so browser/tool latency cannot skip a short stage.
  // finishStage seeks and finishes the real clips; playback tests below run in real time.
  await page.evaluate(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.closest('.mascot-art') && animation.effect.getTiming().iterations === 1) animation.pause()
      return animation
    }
  })
}
async function checkLongHair(page, seated) {
  if (character.id !== '002') return
  const scales = await page.locator('.mascot-art .hil-figure').evaluate(el =>
    ['.rig-hair-left', '.rig-hair-right'].map(selector => new DOMMatrix(getComputedStyle(el.querySelector(selector)).transform).d))
  for (const [index, value] of scales.entries()) expect(value).toBeCloseTo(seated ? [.82, .84][index] : 1, 4)
}
async function finishStage(page, stage, inspect) {
  const svg = page.locator('.mascot-art .hil-scene')
  await expect(svg).toHaveAttribute('data-stage', stage)
  await expect.poll(() => svg.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations === 1).length)).toBeGreaterThan(0)
  await svg.evaluate(el => {
    for (const a of el.getAnimations({ subtree: true })) {
      a.pause()
      if (a.effect.getTiming().iterations === 1) a.currentTime = a.effect.getTiming().duration / 2
    }
  })
  const bounds = await svg.evaluate(el => {
    const figure = el.querySelector('.hil-figure'), body = figure.getBoundingClientRect(), canvas = el.getBoundingClientRect()
    return { same: figure === window.originalHilFigure, visible: getComputedStyle(figure).opacity === '1',
      fits: body.left >= canvas.left && body.right <= canvas.right && body.top >= canvas.top && body.bottom <= canvas.bottom }
  })
  expect(bounds).toEqual({ same: true, visible: true, fits: true })
  if (['grip', 'release', 'think-raise', 'think-chin', 'think-lower', 'fish-reach', 'fish-release'].includes(stage)) {
    // Inspect the actual finite tracks: crossing +/-180 folds the elbow back
    // through the upper arm even when the first and last poses look correct.
    const flexes = await svg.evaluate(el => {
      const result = []
      for (const progress of [.25, .5, .75]) {
        for (const a of el.getAnimations({ subtree: true })) a.currentTime = a.effect.getTiming().duration * progress
        for (const arm of el.querySelectorAll('.mascot-arm')) {
          const upper = arm.querySelector('.rig-upper'), forearm = arm.querySelector('.rig-forearm')
          const relative = upper.getScreenCTM().inverse().multiply(forearm.getScreenCTM())
          result.push(Math.abs(Math.atan2(relative.b, relative.a) * 180 / Math.PI))
        }
      }
      for (const a of el.getAnimations({ subtree: true })) a.currentTime = a.effect.getTiming().duration / 2
      return result
    })
    expect(Math.max(...flexes)).toBeLessThan(175)
    if (stage.startsWith('think-')) {
      const cuffGap = await svg.evaluate(el => {
        let gap = 0
        for (const progress of [.25, .5, .75]) {
          for (const a of el.getAnimations({ subtree: true })) a.currentTime = a.effect.getTiming().duration * progress
          const arm = el.querySelector('.mascot-arm[data-side="right"]')
          const sleeve = arm.querySelector('.rig-forearm-sleeve'), box = sleeve.getBBox()
          const sleeveEnd = new DOMPoint(0, box.y + box.height).matrixTransform(sleeve.getScreenCTM())
          const wrist = new DOMPoint(0, 0).matrixTransform(arm.querySelector('.rig-wrist').getScreenCTM())
          gap = Math.max(gap, Math.hypot(sleeveEnd.x - wrist.x, sleeveEnd.y - wrist.y))
        }
        for (const a of el.getAnimations({ subtree: true })) a.currentTime = a.effect.getTiming().duration / 2
        return gap
      })
      expect(cuffGap).toBeLessThan(.6)
    }
  }
  if (inspect) await inspect(svg)
  if (character.id === '002' && stage === 'sit') {
    const scale = await svg.locator('.rig-hair-left').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).d)
    expect(scale).toBeGreaterThan(.82)
    expect(scale).toBeLessThan(1)
  }
  await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-sequence-${stage}.png` })
  await svg.evaluate(el => {
    for (const a of el.getAnimations({ subtree: true })) if (a.effect.getTiming().iterations === 1) a.finish()
  })
}
test('the same figure approaches, grips, sits, swings and jumps down before the props disappear', async ({ page }) => {
  await inspectStagesManually(page)
  await choose(page, '秋千')
  for (const stage of ['appear', 'approach', 'grip', 'sit', 'settle']) await finishStage(page, stage)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  await expect(page.locator('.hil-figure')).toHaveAttribute('data-pose', 'swing')
  await checkLongHair(page, true)
  await choose(page, '待机')
  for (const stage of ['brake', 'release', 'jump', 'land', 'depart', 'hide']) await finishStage(page, stage)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'idle')
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  await expect(page.locator('.hil-seat-props')).toHaveCount(0)
  await checkLongHair(page, false)
  expect(await page.evaluate(() => document.querySelector('.hil-figure') === window.originalHilFigure)).toBe(true)
})

test('the rod stays parked after leaving the swing until the pickup starts', async ({ page }) => {
  await inspectStagesManually(page)
  await choose(page, '秋千')
  for (const stage of ['appear', 'approach', 'grip', 'sit', 'settle']) await finishStage(page, stage)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  await choose(page, '钓鱼')
  for (const stage of ['brake', 'release', 'jump', 'land', 'depart', 'hide']) await finishStage(page, stage)
  let parked
  const compareParked = async svg => {
    const points = await svg.evaluate(el => {
      const rod = el.querySelector('.hil-rod'), tackle = el.querySelector('.hil-tackle')
      return [new DOMPoint(85, 225).matrixTransform(tackle.getScreenCTM()),
        rod.getPointAtLength(rod.getTotalLength()).matrixTransform(rod.getScreenCTM())].map(p => [p.x, p.y])
    })
    parked ||= points
    for (let i = 0; i < points.length; i++) {
      expect(points[i][0]).toBeCloseTo(parked[i][0], 2)
      expect(points[i][1]).toBeCloseTo(parked[i][1], 2)
    }
  }
  for (const stage of ['fish-appear', 'fish-turn', 'fish-sit', 'fish-reach']) await finishStage(page, stage, compareParked)
  await finishStage(page, 'fish-pickup', async svg => {
    await svg.evaluate(el => { for (const a of el.getAnimations({ subtree: true })) a.currentTime = 0 })
    await compareParked(svg)
    const gap = await svg.evaluate(el => {
      const hand = new DOMPoint().matrixTransform(el.querySelector('.mascot-arm[data-side="right"] .mascot-grip-anchor').getScreenCTM())
      const grip = new DOMPoint(144, 184).matrixTransform(el.querySelector('.hil-tackle').getScreenCTM())
      return Math.hypot(hand.x - grip.x, hand.y - grip.y)
    })
    expect(gap).toBeLessThan(1)
  })
})

test('fishing turns and sits, lifts the same rod, casts, reels in, parks it and stands before thinking', async ({ page }) => {
  await inspectStagesManually(page)
  await choose(page, '钓鱼')
  const checkLine = async svg => {
    const gap = await svg.evaluate(el => {
      const line = el.querySelector('.hil-fishing-line'), rod = el.querySelector('.hil-rod')
      const start = line.getPointAtLength(0).matrixTransform(line.getScreenCTM())
      const tip = rod.getPointAtLength(rod.getTotalLength()).matrixTransform(rod.getScreenCTM())
      const end = line.getPointAtLength(line.getTotalLength()).matrixTransform(line.getScreenCTM())
      const float = new DOMPoint(208, 309).matrixTransform(el.querySelector('.hil-bobber').getScreenCTM())
      return Math.max(Math.hypot(start.x - tip.x, start.y - tip.y), Math.hypot(end.x - float.x, end.y - float.y))
    })
    expect(gap).toBeLessThan(.6)
  }
  const checkPickup = reverse => async svg => {
    for (const progress of [0, .125, .25, .5, .75, .875, 1]) {
      const frame = await svg.evaluate((el, { progress, reverse }) => {
        for (const a of el.getAnimations({ subtree: true })) a.currentTime = a.effect.getTiming().duration * progress
        const tackle = el.querySelector('.hil-tackle')
        const t0 = tackle.getAnimations()[0].effect.getComputedTiming().progress
        const t = reverse ? 1 - t0 : t0
        const rodPoint = new DOMPoint(144 - 28 * t, 184 + 16 * t).matrixTransform(tackle.getScreenCTM())
        const arm = el.querySelector('.mascot-arm[data-side="right"]'), figure = el.querySelector('.hil-figure')
        const point = selector => new DOMPoint().matrixTransform(arm.querySelector(selector).getScreenCTM())
        const palm = point('.mascot-grip-anchor')
        const shoulder = point('.rig-upper').matrixTransform(figure.getScreenCTM().inverse())
        const elbow = point('.rig-forearm').matrixTransform(figure.getScreenCTM().inverse())
        const wrist = arm.querySelector('.rig-forearm').getScreenCTM().inverse().multiply(arm.querySelector('.rig-wrist').getScreenCTM())
        // Sample visible rod/line paths; the group also bounds the hidden caught fish.
        const canvas = el.getBoundingClientRect()
        const rodFits = [...tackle.querySelectorAll(':scope > path, .hil-bobber path')].every(path =>
          Array.from({ length: 25 }, (_, i) => path.getPointAtLength(path.getTotalLength() * i / 24).matrixTransform(path.getScreenCTM()))
            .every(point => point.x >= canvas.left && point.x <= canvas.right && point.y >= canvas.top && point.y <= canvas.bottom))
        return { gap: Math.hypot(rodPoint.x - palm.x, rodPoint.y - palm.y),
          elbowOut: elbow.x - shoulder.x, elbowDrop: elbow.y - shoulder.y,
          wristAngle: Math.atan2(wrist.b, wrist.a) * 180 / Math.PI,
          rodFits }
      }, { progress, reverse })
      expect(frame.gap).toBeLessThan(1)
      if (character.id === '002') {
        expect(frame.elbowOut, `outside elbow at ${progress}, reverse=${reverse}`).toBeGreaterThan(0)
        expect(frame.elbowDrop).toBeGreaterThan(12)
        expect(Math.abs(frame.wristAngle)).toBeLessThan(12)
        expect(frame.rodFits).toBe(true)
      }
      await checkLine(svg)
    }
  }
  for (const stage of ['fish-appear', 'fish-turn', 'fish-sit', 'fish-reach']) await finishStage(page, stage, checkLine)
  await finishStage(page, 'fish-pickup', checkPickup(false))
  await finishStage(page, 'fish-cast', checkLine)
  await finishStage(page, 'fish-watch', checkLine)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  await expect(page.locator('.hil-model-placement')).toHaveAttribute('transform', 'translate(0 32)')
  await checkLongHair(page, true)
  // Leave at the bite's highest lift, not just the neutral loop frame.
  await page.locator('.hil-scene').evaluate(el => {
    for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = 10560 }
  })
  await choose(page, '思考')
  await finishStage(page, 'fish-brake', checkLine)
  await finishStage(page, 'fish-reel', checkLine)
  await finishStage(page, 'fish-put', checkPickup(true))
  for (const stage of ['fish-release', 'fish-rise', 'fish-depart', 'fish-hide']) await finishStage(page, stage, checkLine)
  const handTop = async () => (await page.locator('.hil-thinking-hand').boundingBox()).y
  const lowered = await handTop()
  for (const stage of ['think-raise', 'think-chin', 'think-tilt']) await finishStage(page, stage)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  expect(lowered - await handTop()).toBeGreaterThan(40)
  await expect(page.locator('.hil-stool')).toHaveCount(0)
  await checkLongHair(page, false)
  await choose(page, '待机')
  for (const stage of ['think-lower', 'think-reset']) await finishStage(page, stage)
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'idle')
  await expect(page.locator('.hil-figure')).toHaveAttribute('data-pose', 'idle')
})
test('pause freezes a transition and repeated choices settle on the last request after a complete exit', async ({ page }) => {
  await choose(page, '秋千')
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'approach')
  await page.getByRole('button', { name: `暂停${character.name}秋千动画` }).click()
  const snapshot = () => page.locator('.hil-scene').evaluate(el => ({ stage: el.dataset.stage, times: el.getAnimations({ subtree: true }).map(a => a.currentTime) }))
  const stopped = await snapshot()
  await page.waitForTimeout(180)
  expect(await snapshot()).toEqual(stopped)
  await choose(page, '钓鱼')
  await choose(page, '思考')
  expect((await snapshot()).stage).toBe(stopped.stage)
  await page.getByRole('button', { name: `播放${character.name}思考动画` }).click()
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'think', { timeout: 12000 })
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  const stages = await page.evaluate(() => window.hilStages)
  expect(stages).toContain('swing:land')
  expect(stages.some(stage => stage.startsWith('fish:'))).toBe(false)
  await page.reload()
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'think')
})
test('background freezes clips, reduced motion resolves safely, and unmount cancels pending work', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await choose(page, '秋千')
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'approach')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const times = () => page.locator('.hil-scene').evaluate(el => el.getAnimations({ subtree: true }).map(a => a.currentTime))
  const stopped = await times()
  await page.waitForTimeout(180)
  expect(await times()).toEqual(stopped)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  expect(await page.locator('.hil-scene').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await page.evaluate(() => {
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await choose(page, '待机')
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'brake')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.sidebar-mascot')).toHaveCount(0)
  await page.waitForTimeout(700)
  expect(errors).toEqual([])
})

test('pausing the rod pickup freezes its hand and tackle, then completes fishing before the last choice', async ({ page }) => {
  await choose(page, '钓鱼')
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'fish-pickup')
  await page.getByRole('button', { name: `暂停${character.name}钓鱼动画` }).click()
  const state = () => page.locator('.hil-scene').evaluate(el => ({
    stage: el.dataset.stage,
    times: el.getAnimations({ subtree: true }).map(a => a.currentTime),
    rod: getComputedStyle(el.querySelector('.hil-tackle')).transform,
    arm: getComputedStyle(el.querySelector('.mascot-arm[data-side="right"] .rig-forearm')).transform
  }))
  const stopped = await state()
  await page.waitForTimeout(180)
  expect(await state()).toEqual(stopped)
  await choose(page, '思考')
  await choose(page, '待机')
  expect(await state()).toEqual(stopped)
  await page.getByRole('button', { name: `播放${character.name}待机动画` }).click()
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'idle', { timeout: 14000 })
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'loop')
  const stages = await page.evaluate(() => window.hilStages)
  expect(stages).toContain('fish:fish-put')
  expect(stages).toContain('fish:fish-rise')
  expect(stages.some(stage => stage.startsWith('think:'))).toBe(false)
})


})
}
