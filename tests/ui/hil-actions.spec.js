import { expect, test } from '@playwright/test'
import { MASCOTS } from '../../src/config/mascots.js'

const shots = process.env.MASCOT_SCREENSHOT_DIR || 'test-results/hil-actions'
for (const character of MASCOTS.filter(entry => !entry.idleOnly)) {
test.describe(character.name + ' model adaptation', () => {
test.skip(({ isMobile }) => isMobile, 'Desktop mascot only')
test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
  await page.addInitScript(id => localStorage.setItem('sidebar-mascot-character', id), character.id)
  await page.goto('/#/runes')
  await page.getByRole('button', { name: `暂停${character.name}待机动画` }).click()
})
async function choose(page, name) {
  await page.getByRole('button', { name: '选择吉祥物动作' }).click()
  await page.getByRole('button', { name: `使用${name}动作` }).click()
}
async function seek(page, time) {
  await page.locator('.mascot-art').evaluate((el, time) => {
    for (const animation of el.getAnimations({ subtree: true })) animation.currentTime = time
  }, time)
}
test('thinking holds her chin with moving fingers and eyes, and pauses all details', async ({ page }) => {
  await choose(page, '思考')
  const pose = await page.locator('.hil-figure').evaluate(figure => {
    const arm = figure.querySelector('.mascot-arm[data-side="right"]')
    const point = selector => new DOMPoint(0, 0).matrixTransform(arm.querySelector(selector).getScreenCTM()).matrixTransform(figure.getScreenCTM().inverse())
    return { shoulder: point('.rig-upper').toJSON(), elbow: point('.rig-forearm').toJSON(), palm: point('.mascot-grip-anchor').toJSON() }
  })
  // The reference supports the chin diagonally with the elbow outside the chest,
  // rather than holding a vertical fist beneath the face.
  expect(pose.elbow.x).toBeGreaterThan(pose.shoulder.x - 2)
  expect(pose.elbow.x - pose.palm.x).toBeGreaterThan(12)
  const fingers = [], gazes = []
  for (const time of [0, 3500, 7500]) {
    await seek(page, time)
    fingers.push(await page.locator('.hil-thinking-hand .mascot-finger-index').evaluate(el => getComputedStyle(el).d))
    gazes.push(await page.locator('.hil-pupils').evaluate(el => getComputedStyle(el).transform))
    await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-think-detail-${time}.png` })
    if (time === 3500) await expect(page.locator('.mascot-thought-bubble')).toHaveCSS('opacity', '1')
  }
  expect(new Set(fingers).size).toBeGreaterThan(1)
  expect(new Set(gazes).size).toBe(3)
  await page.getByRole('button', { name: `播放${character.name}思考动画` }).click()
  const joint = page.locator('.hil-right-forearm')
  const started = await joint.evaluate(el => el.getAnimations()[0].currentTime)
  await expect.poll(() => joint.evaluate(el => el.getAnimations()[0].currentTime)).toBeGreaterThan(started)
  await page.getByRole('button', { name: `暂停${character.name}思考动画` }).click()
  const state = () => page.locator('.hil-scene').evaluate(el => el.getAnimations({ subtree: true }).map(a => a.currentTime))
  const stopped = await state()
  await page.waitForTimeout(150)
  expect(await state()).toEqual(stopped)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.hil-scene').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
})
test('swing keeps ropes, hands and seat attached throughout the arc', async ({ page }) => {
  await choose(page, '秋千')
  const poses = []
  for (const time of [0, 1400, 2800, 4200]) {
    await seek(page, time)
    const frame = await page.locator('.hil-scene').evaluate(svg => {
      const pendulum = svg.querySelector('.hil-swing-pendulum')
      const figure = svg.querySelector('.hil-figure')
      const point = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getScreenCTM())
      const grips = [...figure.querySelectorAll('.mascot-grip-anchor')].map((el, index) => {
        const palm = point(el, 0, 0).matrixTransform(pendulum.getScreenCTM().inverse())
        return Math.abs(palm.x - (index === 0 ? 114 : 208))
      })
      const body = figure.getBoundingClientRect(), canvas = svg.getBoundingClientRect()
      return { gap: Math.max(...grips), x: body.x,
        body: body.toJSON(), canvas: canvas.toJSON(),
        fits: body.x >= canvas.x && body.right <= canvas.right && body.y >= canvas.y && body.bottom <= canvas.bottom }
    })
    expect(frame.gap).toBeLessThan(1)
    expect(frame.fits, JSON.stringify(frame)).toBe(true)
    poses.push(frame.x)
    await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-swing-${time}.png` })
  }
  expect(Math.max(...poses) - Math.min(...poses)).toBeGreaterThan(10)
})

test('both elbows stay lowered and wrists follow the forearms in seated and thinking poses', async ({ page }) => {
  for (const name of ['思考', '秋千', '钓鱼']) {
    await choose(page, name)
    await seek(page, 0)
    const arms = await page.locator('.hil-figure').evaluate(figure => {
      const local = el => new DOMPoint(0, 0).matrixTransform(el.getScreenCTM()).matrixTransform(figure.getScreenCTM().inverse())
      return [...figure.querySelectorAll('.mascot-arm')].map(arm => {
        const forearm = arm.querySelector('.rig-forearm'), wrist = arm.querySelector('.rig-wrist')
        const shoulder = local(arm.querySelector('.rig-upper')), elbow = local(forearm)
        const rotation = wrist.getScreenCTM().multiply(forearm.getScreenCTM().inverse())
        return { elbowDrop: elbow.y - shoulder.y, wristAngle: Math.atan2(rotation.b, rotation.a) * 180 / Math.PI }
      })
    })
    for (const arm of arms) {
      expect(arm.elbowDrop, `${character.name} ${name}`).toBeGreaterThan(12)
      expect(Math.abs(arm.wristAngle), `${character.name} ${name}`).toBeLessThan(12)
    }
  }
})
test('fishing line follows the bending rod and float through a bite and lift', async ({ page }) => {
  await choose(page, '钓鱼')
  const tips = []
  for (const time of [0, 8400, 9120, 9840, 10560, 11280]) {
    await seek(page, time)
    const frame = await page.locator('.hil-scene').evaluate(svg => {
      const rod = svg.querySelector('.hil-rod'), line = svg.querySelector('.hil-fishing-line')
      const rodTip = rod.getPointAtLength(rod.getTotalLength()).matrixTransform(rod.getScreenCTM())
      const lineTop = line.getPointAtLength(0).matrixTransform(line.getScreenCTM())
      const lineEnd = line.getPointAtLength(line.getTotalLength()).matrixTransform(line.getScreenCTM())
      const floatTop = new DOMPoint(208, 309).matrixTransform(svg.querySelector('.hil-bobber').getScreenCTM())
      return { rodGap: Math.hypot(rodTip.x - lineTop.x, rodTip.y - lineTop.y), floatGap: Math.hypot(lineEnd.x - floatTop.x, lineEnd.y - floatTop.y), top: rodTip.y }
    })
    expect(frame.rodGap).toBeLessThan(1)
    expect(frame.floatGap).toBeLessThan(1)
    tips.push(frame.top)
    await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-fish-${time}.png` })
  }
  expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(12)
  await seek(page, 10560)
  await expect(page.locator('.hil-caught-fish')).toHaveCSS('opacity', '1')
  await page.reload()
  await expect(page.locator('.hil-scene')).toHaveAttribute('data-scene', 'fish')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.hil-scene').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1280, height: 700 })
  await page.screenshot({ path: `${shots}/${character.id}-fish-short.png` })
  await page.getByRole('button', { name: '切换吉祥物角色' }).click()
  const next = page.getByRole('button', { name: '下一批角色' })
  await (await next.isEnabled() ? next : page.getByRole('button', { name: '上一批角色' })).click()
  await page.locator('.mascot-option').first().click()
  await expect(page.locator('.mascot-art .hil-scene')).toHaveAttribute('data-scene', 'fish')
  await page.getByRole('button', { name: '选择吉祥物动作' }).click()
  await expect(page.getByRole('button', { name: '使用秋千动作' })).toBeVisible()
  await expect(page.getByRole('button', { name: '使用钓鱼动作' })).toBeVisible()
})

test('the character keeps the same model and glove scale across actions, with dry shore before the pond', async ({ page }) => {
  for (const height of [900, 700]) {
    await page.setViewportSize({ width: 1440, height })
    let baseline
    for (const name of ['待机', '思考', '秋千', '钓鱼']) {
      await choose(page, name)
      await seek(page, 0)
      const frame = await page.locator('.sidebar-mascot').evaluate(host => {
        const svg = host.querySelector('.hil-scene'), figure = svg.querySelector('.hil-figure')
        const scale = el => {
          const m = el.getScreenCTM()
          return [Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)]
        }
        const rect = el => {
          const { x, y, width, height } = el.getBoundingClientRect()
          return { x, y, width, height }
        }
        const gloves = [...figure.querySelectorAll('.mascot-grip-anchor')].map(el => {
          const glove = el.querySelector('.mascot-palm'), box = glove.getBBox()
          return { width: box.width, height: box.height, scale: scale(glove) }
        })
        const pond = svg.querySelector('.hil-pond')
        let shoreGap, floatInside, floatCenterGap, elbowBelowShoulder
        if (pond) {
          const landRight = Math.max(...[...svg.querySelectorAll('.hil-shin, .hil-stool')].map(el => el.getBoundingClientRect().right))
          shoreGap = pond.getBoundingClientRect().left - landRight
          const float = svg.querySelector('.hil-bobber')
          const waterPoint = new DOMPoint(208, 318).matrixTransform(float.getScreenCTM()).matrixTransform(pond.getScreenCTM().inverse())
          floatInside = ((waterPoint.x - pond.cx.baseVal.value) / pond.rx.baseVal.value) ** 2 + ((waterPoint.y - pond.cy.baseVal.value) / pond.ry.baseVal.value) ** 2 <= 1
          floatCenterGap = Math.hypot(waterPoint.x - pond.cx.baseVal.value, waterPoint.y - pond.cy.baseVal.value)
          const arm = svg.querySelector('.mascot-arm[data-side="left"]')
          const shoulder = new DOMPoint(0, 0).matrixTransform(arm.querySelector('.rig-upper').getScreenCTM())
          const elbow = new DOMPoint(0, 0).matrixTransform(arm.querySelector('.rig-forearm').getScreenCTM())
          elbowBelowShoulder = elbow.y > shoulder.y + 10
        }
        return { host: rect(host), canvas: rect(svg), note: rect(document.querySelector('.info-note')), scale: scale(figure), gloves, shoreGap, floatInside, floatCenterGap, elbowBelowShoulder }
      })
      baseline ||= frame
      expect(frame.host).toEqual(baseline.host)
      expect(frame.canvas).toEqual(baseline.canvas)
      expect(frame.note).toEqual(baseline.note)
      for (let axis = 0; axis < 2; axis++) {
        expect(frame.scale[axis]).toBeCloseTo(baseline.scale[axis], 5)
        for (const glove of frame.gloves) expect(glove.scale[axis]).toBeCloseTo(baseline.gloves[0].scale[axis], 5)
      }
      expect(frame.gloves[0].width).toBeCloseTo(frame.gloves[1].width, 3)
      expect(frame.gloves[0].height).toBeCloseTo(frame.gloves[1].height, 3)
      if (name === '钓鱼') {
        expect(frame.shoreGap).toBeGreaterThan(14)
        expect(frame.floatInside).toBe(true)
        expect(frame.floatCenterGap).toBeLessThan(.01)
        expect(frame.elbowBelowShoulder).toBe(true)
      }
      await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-rig-final-${height}-${name}.png` })
    }
  }
})


})
}
