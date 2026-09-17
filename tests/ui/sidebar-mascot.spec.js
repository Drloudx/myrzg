import { expect, test } from '@playwright/test'

const screenshotDir = process.env.MASCOT_SCREENSHOT_DIR || 'test-results/mascot-roster'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

const selectAction = async (page, name) => {
  await page.getByRole('button', { name: '选择吉祥物动作' }).click()
  await page.getByRole('button', { name: `使用${name}动作` }).click()
}

const openPage = async page => {
  await page.goto('/#/runes')
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
}

test.describe('desktop sidebar mascot', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop information panel only')

  test('fits below the notes, leaves the page interactive, and works in both themes', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    await expect(mascot).toBeVisible()
    const bounds = await page.evaluate(() => {
      const mascot = document.querySelector('.sidebar-mascot').getBoundingClientRect()
      const note = document.querySelector('.info-note').getBoundingClientRect()
      const panel = document.querySelector('.page-info-panel').getBoundingClientRect()
      const main = document.querySelector('.app-main').getBoundingClientRect()
      const svg = document.querySelector('.mascot-art svg').getBoundingClientRect()
      const target = document.elementFromPoint(svg.x + svg.width / 2, svg.y + svg.height / 2)
      return {
        belowNotes: mascot.top >= note.bottom,
        insidePanel: mascot.right <= panel.right && mascot.bottom <= panel.bottom,
        outsideMain: mascot.left >= main.right,
        pointerPassesThrough: !target.closest('.sidebar-mascot'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth
      }
    })
    expect(Object.values(bounds).every(Boolean)).toBe(true)
    await page.screenshot({ path: `${screenshotDir}/desktop-light.png` })
    await mascot.locator('svg').screenshot({ path: `${screenshotDir}/001-in-page.png`, scale: 'css' })
    await page.getByTitle('切换暗色模式').click()
    await expect(page.locator('html')).toHaveClass(/dark-mode/)
    await page.screenshot({ path: `${screenshotDir}/desktop-dark.png` })
    await page.locator('.app-main').hover()
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.locator('.app-container').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })

  test('pauses actual animation time, remembers the choice, and resumes', async ({ page }) => {
    await openPage(page)
    const body = page.locator('.sidebar-mascot .idle-body')
    await expect(body).toHaveCSS('animation-play-state', 'running')
    await page.getByRole('button', { name: '暂停希尔待机动画' }).click()
    await expect(body).toHaveCSS('animation-play-state', 'paused')
    const before = await body.evaluate(el => el.getAnimations()[0].currentTime)
    await page.waitForTimeout(150)
    const after = await body.evaluate(el => el.getAnimations()[0].currentTime)
    expect(Math.abs(after - before)).toBeLessThan(20)
    await page.reload()
    await expect(body).toHaveCSS('animation-play-state', 'paused')
    await page.getByRole('button', { name: '播放希尔待机动画' }).click()
    await expect(body).toHaveCSS('animation-play-state', 'running')
    const resumed = await body.evaluate(el => el.getAnimations()[0].currentTime)
    await expect.poll(() => body.evaluate(el => el.getAnimations()[0].currentTime)).toBeGreaterThan(resumed)
  })

  test('switching rigged characters cancels the old transition and preserves Canaan equipment through pose changes', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openPage(page)
    await selectAction(page, '钓鱼')
    await expect(page.locator('.hil-scene')).toHaveAttribute('data-stage', 'fish-pickup')
    await page.getByRole('button', { name: '切换吉祥物角色' }).click()
    await page.getByRole('button', { name: '选择迦南', exact: true }).click()
    await expect(page.locator('.mascot-art .hil-figure')).toHaveAttribute('data-model', '055')
    await expect(page.locator('.mascot-art .hil-scene')).toHaveAttribute('data-scene', 'fish')
    await expect(page.locator('.mascot-art .hil-scene')).toHaveAttribute('data-stage', 'loop')
    await page.getByRole('button', { name: '暂停迦南钓鱼动画' }).click()
    const costume = () => page.locator('.mascot-art').evaluate(el => ({
      sword: getComputedStyle(el.querySelector('.rig-sword')).transform,
      cape: getComputedStyle(el.querySelector('.rig-cape')).transform,
      finiteClips: el.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations === 1).length
    }))
    const seated = await costume()
    expect(seated.finiteClips).toBe(0)
    const sword = await page.locator('.mascot-art .rig-sword').elementHandle()
    await selectAction(page, '待机')
    const standing = await costume()
    expect(standing.sword).not.toEqual(seated.sword)
    expect(standing.cape).not.toEqual(seated.cape)
    await selectAction(page, '秋千')
    expect(await costume()).toEqual(seated)
    expect(await sword.evaluate(el => el === document.querySelector('.mascot-art .rig-sword'))).toBe(true)
    await page.getByRole('button', { name: '切换吉祥物角色' }).click()
    const picker = page.getByRole('dialog', { name: '选择吉祥物' })
    for (const id of ['001', '055', '002']) {
      const preview = picker.locator(`[data-character-option="${id}"] .hil-figure`)
      await expect(preview).toHaveAttribute('data-model', id)
      expect(await preview.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
    }
    await page.screenshot({ path: `${screenshotDir}/rigged-characters-picker.png` })
    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.locator('.mascot-art .hil-figure')).toHaveAttribute('data-model', '055')
    await expect(page.locator('.mascot-art .hil-scene')).toHaveAttribute('data-scene', 'swing')
    expect(await costume()).toEqual(seated)
    expect(errors).toEqual([])
  })

  test('all seven characters share the standing stage, ground anchor and right-side thought bubble', async ({ page }) => {
    await openPage(page)
    await page.getByRole('button', { name: '暂停希尔待机动画' }).click()
    for (const height of [900, 700]) {
      await page.setViewportSize({ width: 1440, height })
      let baseline
      for (const id of ['001', '055', '062', '053', '034', '049', '002']) {
        await page.getByRole('button', { name: '切换吉祥物角色' }).click()
        await page.locator(`[data-character-option="${id}"]`).click()
        for (const action of ['待机', '思考']) {
          await selectAction(page, action)
          const frame = await page.locator('.sidebar-mascot').evaluate(el => {
            const art = el.querySelector('.mascot-art'), svg = art.querySelector('svg')
            for (const a of art.getAnimations({ subtree: true })) a.currentTime = 4000
            const shadow = svg.querySelector('ellipse')
            const ground = new DOMPoint(shadow.cx.baseVal.value, shadow.cy.baseVal.value).matrixTransform(shadow.getScreenCTM())
            const rect = element => element.getBoundingClientRect().toJSON()
            const bubble = el.querySelector('.mascot-thought-bubble')
            return { host: rect(el), canvas: rect(svg), bodyHeight: rect(svg.querySelector('.idle-body')).height, ground: { x: ground.x, y: ground.y },
              scale: svg.getScreenCTM().a, bubble: bubble ? rect(bubble) : null }
          })
          baseline ||= frame
          expect(frame.host).toEqual(baseline.host)
          expect(frame.canvas).toEqual(baseline.canvas)
          expect(frame.scale).toBeCloseTo(baseline.scale, 5)
          expect(frame.ground.x).toBeCloseTo(baseline.ground.x, 2)
          expect(frame.ground.y).toBeCloseTo(baseline.ground.y, 2)
          if (action === '待机') expect(frame.bodyHeight, `standing height for ${id}`).toBeCloseTo(baseline.bodyHeight, 1)
          if (action === '思考') {
            expect(frame.bubble.left).toBeGreaterThan(frame.ground.x)
            expect(frame.bubble.right).toBeLessThan(frame.canvas.right)
            await page.locator('.sidebar-mascot').screenshot({ path: `${screenshotDir}/${id}-aligned-${height}.png` })
          }
        }
      }
    }
    await page.getByRole('button', { name: '切换吉祥物角色' }).click()
    await page.getByRole('dialog', { name: '选择吉祥物' }).screenshot({ path: `${screenshotDir}/aligned-picker.png` })
  })

  test('opens above the switch and selects all seven characters without shifting the layout', async ({ page }) => {
    const errors = []
    const assets = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (/mascot\/.*-idle\.svg/.test(request.url()) && !request.url().includes('raw')) assets.push(request.url())
    })
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    const art = mascot.locator('.mascot-art svg')
    const button = mascot.getByRole('button', { name: '切换吉祥物角色' })
    await expect(art).toHaveAttribute('data-character', '001')
    expect(assets.length).toBe(1)
    expect(assets[0]).toContain('hero-001-idle.svg')
    const pageGeometry = () => page.evaluate(() => ['.info-note', '.page-info-panel', '.app-main'].map(selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect()
      return { x, y, width, height }
    }))
    const baseline = await pageGeometry()
    const sequence = [
      ['055', '迦南'], ['062', '露比特·鲁特'], ['053', '艾薇杜尔'],
      ['034', '露帕·萝特'], ['049', '菲莉娜'], ['002', '米托拉'], ['001', '希尔']
    ]
    for (const [id, name] of sequence) {
      await button.click()
      const picker = page.getByRole('dialog', { name: '选择吉祥物' })
      await expect(picker).toBeVisible()
      await expect(picker.locator('svg')).toHaveCount(7)
      const popup = await picker.boundingBox()
      const trigger = await button.boundingBox()
      expect(popup.y + popup.height).toBeLessThanOrEqual(trigger.y)
      expect(popup.x).toBeGreaterThanOrEqual(16)
      expect(popup.x + popup.width).toBeLessThanOrEqual(page.viewportSize().width - 16)
      await expect(picker.locator('.idle-body').first()).toHaveCSS('animation-name', 'none')
      await picker.getByRole('button', { name: `选择${name}`, exact: true }).click()
      await expect(picker).toHaveCount(0)
      await expect(button).toBeFocused()
      await expect(art).toHaveAttribute('data-character', id)
      await expect(mascot.getByRole('status')).toHaveText(`当前吉祥物：${name}`)
      await expect(mascot.locator('svg')).toHaveCount(1)
      await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'running')
      expect(await pageGeometry()).toEqual(baseline)
      expect(await mascot.evaluate(el => {
        const body = el.getBoundingClientRect(), panel = el.closest('.page-info-panel').getBoundingClientRect()
        return body.left >= panel.left && body.right <= panel.right && body.bottom <= panel.bottom
      })).toBe(true)
      await art.screenshot({ path: `${screenshotDir}/${id}-in-page.png`, scale: 'css' })
    }
    expect(new Set(assets).size).toBe(7)
    expect(errors).toEqual([])
  })

  test('picker follows the paper theme and closes on Escape, outside click, route change and unmount', async ({ page }) => {
    await openPage(page)
    const button = page.getByRole('button', { name: '切换吉祥物角色' })
    const picker = page.getByRole('dialog', { name: '选择吉祥物' })
    await button.click()
    await expect(picker.locator('svg')).toHaveCount(7)
    await expect(picker.locator('[aria-pressed="true"]')).toBeFocused()
    await page.screenshot({ path: `${screenshotDir}/picker-light.png` })
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)
    await expect(button).toBeFocused()
    await button.click()
    await page.locator('.info-note').click()
    await expect(picker).toHaveCount(0)
    await page.getByTitle('切换暗色模式').click()
    await button.click()
    await expect(picker).toBeVisible()
    await expect(picker.locator('[aria-pressed="true"]')).toBeFocused()
    const sameSurface = await picker.evaluate(el => {
      const popup = getComputedStyle(el)
      const sidebar = getComputedStyle(document.querySelector('.page-info-panel'))
      const rgb = color => color.match(/[\d.]+/g).slice(0, 3).join(',')
      return rgb(popup.backgroundColor) === rgb(sidebar.backgroundColor) && !popup.backgroundColor.startsWith('rgba') && popup.borderColor === sidebar.borderColor
    })
    expect(sameSurface).toBe(true)
    await page.screenshot({ path: `${screenshotDir}/picker-dark.png` })
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1280, height: 700 })
    await button.click()
    await expect(picker).toBeVisible()
    await expect(picker.locator('[aria-pressed="true"]')).toBeFocused()
    await page.screenshot({ path: `${screenshotDir}/picker-short.png` })
    await page.evaluate(() => { location.hash = '/runes?mascot-check=1' })
    await expect(picker).toHaveCount(0)
    await button.click()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(picker).toHaveCount(0)
  })

  test('remembers both the chosen character and paused state across reload and viewport remount', async ({ page }) => {
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    const art = mascot.locator('svg')
    await expect(art).toHaveAttribute('data-character', '001')
    await mascot.getByRole('button', { name: '暂停希尔待机动画' }).click()
    await mascot.getByRole('button', { name: '切换吉祥物角色' }).click()
    await page.getByRole('button', { name: '选择迦南', exact: true }).click()
    await expect(art).toHaveAttribute('data-character', '055')
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'paused')
    await page.reload()
    await expect(art).toHaveAttribute('data-character', '055')
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'paused')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(mascot).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(art).toHaveAttribute('data-character', '055')
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'paused')
    await mascot.getByRole('button', { name: '播放迦南待机动画' }).click()
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'running')
  })

  test('unknown saved character falls back to 001 and reduced-motion users can still switch', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sidebar-mascot-character', 'missing-character'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    await expect(mascot.locator('svg')).toHaveAttribute('data-character', '001')
    await mascot.getByRole('button', { name: '切换吉祥物角色' }).click()
    await page.getByRole('button', { name: '选择迦南', exact: true }).click()
    await expect(mascot.locator('svg')).toHaveAttribute('data-character', '055')
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-name', 'none')
  })

  test('a failed character download preserves the current art and saved choice', async ({ page }) => {
    // Keep Vite's source module available; fail only the selectable SVG asset download.
    await page.route('**/hero-055-idle.svg*', route => route.request().resourceType() === 'fetch' ? route.abort() : route.continue())
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    await expect(mascot.locator('svg')).toHaveAttribute('data-character', '001')
    await mascot.getByRole('button', { name: '切换吉祥物角色' }).click()
    await page.getByRole('button', { name: '选择迦南', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('角色加载失败，请重试重试')
    await expect(mascot.locator('svg')).toHaveAttribute('data-character', '001')
    expect(await page.evaluate(() => localStorage.getItem('sidebar-mascot-character'))).toBe('001')
    await page.unroute('**/hero-055-idle.svg*')
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await expect(mascot.locator('svg')).toHaveAttribute('data-character', '055')
  })

  test('respects reduced motion and adapts to short or mobile windows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)
    const mascot = page.locator('.sidebar-mascot')
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-name', 'none')
    await expect(mascot.locator('.mascot-motion-toggle')).toHaveCount(0)
    await expect(mascot.getByRole('button', { name: '切换吉祥物角色' })).toBeVisible()
    for (const height of [700, 721, 780, 781]) {
      await page.setViewportSize({ width: 1280, height })
      await expect(mascot).toBeVisible()
      const fits = await mascot.evaluate(el => el.getBoundingClientRect().bottom <= el.closest('.page-info-panel').getBoundingClientRect().bottom)
      expect(fits).toBe(true)
    }
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(mascot).toBeVisible()
    const short = await page.evaluate(() => ({
      mascotTop: document.querySelector('.sidebar-mascot').getBoundingClientRect().top,
      noteBottom: document.querySelector('.info-note').getBoundingClientRect().bottom,
      mascotBottom: document.querySelector('.sidebar-mascot').getBoundingClientRect().bottom,
      panelBottom: document.querySelector('.page-info-panel').getBoundingClientRect().bottom
    }))
    expect(short.mascotTop).toBeGreaterThanOrEqual(short.noteBottom)
    expect(short.mascotBottom).toBeLessThanOrEqual(short.panelBottom)
    await page.screenshot({ path: `${screenshotDir}/desktop-short.png` })
    await page.setViewportSize({ width: 1280, height: 600 })
    await expect(mascot).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(mascot).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(mascot).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(mascot.locator('.idle-body')).toHaveCSS('animation-play-state', 'running')
  })

  test('pauses when scrolled out of the sidebar viewport and in the background', async ({ page }) => {
    await openPage(page)
    const body = page.locator('.sidebar-mascot .idle-body')
    await page.locator('.sidebar-mascot').scrollIntoViewIfNeeded()
    await expect(body).toHaveCSS('animation-play-state', 'running')
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(body).toHaveCSS('animation-play-state', 'paused')
    await page.evaluate(() => {
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(body).toHaveCSS('animation-play-state', 'running')
    // Exercise the observer with a genuinely clipped scroll viewport, without changing character state.
    await page.locator('.info-body').evaluate(el => { el.style.maxHeight = '120px'; el.scrollTop = 0 })
    await expect(body).toHaveCSS('animation-play-state', 'paused')
    await page.locator('.sidebar-mascot').scrollIntoViewIfNeeded()
    await expect(body).toHaveCSS('animation-play-state', 'running')
  })
})

test('mobile does not load or mount the mascot', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile initial load')
  const requests = []
  page.on('request', request => requests.push(request.url()))
  await openPage(page)
  await expect(page.locator('.sidebar-mascot')).toHaveCount(0)
  expect(requests.filter(url => /SidebarMascot|hero-\d+-idle|new_hero_002/.test(url))).toEqual([])
  await page.screenshot({ path: `${screenshotDir}/mobile.png` })
})
