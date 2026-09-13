import { expect, test } from '@playwright/test'

test('only the protagonist has paired desktop portraits and a mobile gender switch', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/heroes?id=hero_001')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const portrait = page.locator('.portrait-section')
  await expect(portrait).toHaveClass(/portrait-section--protagonist/)
  const female = portrait.getByAltText('希尔（女主）')
  const male = portrait.getByAltText('希尔（男主）')
  const toggle = portrait.locator('.protagonist-portrait-toggle')
  for (const img of [female, male]) {
    await expect.poll(() => img.evaluate(el => el.naturalWidth)).toBeGreaterThan(100)
  }
  if (testInfo.project.name === 'mobile') {
    await expect(female).toBeVisible()
    await expect(male).toBeHidden()
    await expect(toggle).toHaveText('切换男主')
    const bounds = await portrait.boundingBox()
    const button = await toggle.boundingBox()
    expect(button.x).toBeGreaterThan(bounds.x + bounds.width / 2)
    expect(button.y - bounds.y).toBeLessThan(20)
    await portrait.screenshot({ path: testInfo.outputPath('protagonist-female.png') })
    const url = page.url()
    const badges = await page.locator('.hero-badges-row-container').innerText()
    await toggle.click()
    await expect(male).toBeVisible()
    await expect(female).toBeHidden()
    await expect(toggle).toHaveText('切换女主')
    expect(page.url()).toBe(url)
    expect(await page.locator('.hero-badges-row-container').innerText()).toBe(badges)
    expect((await portrait.boundingBox()).height).toBeCloseTo(bounds.height, 0)
    await portrait.screenshot({ path: testInfo.outputPath('protagonist-male.png') })
    await toggle.click()
    await expect(female).toBeVisible()
  } else {
    await expect(female).toBeVisible()
    await expect(male).toBeVisible()
    await expect(toggle).toBeHidden()
    const slots = await portrait.locator('.protagonist-portrait-slot').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.x, width: r.width, height: r.height }
    }))
    expect(slots[1].x).toBeGreaterThanOrEqual(slots[0].x + slots[0].width - 1)
    expect(slots[0].width).toBeCloseTo(slots[1].width, 0)
    await portrait.screenshot({ path: testInfo.outputPath('protagonist-pair.png') })
  }
  expect(await portrait.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await portrait.screenshot({ path: testInfo.outputPath('protagonist-dark.png') })

  await page.goto('/#/heroes?id=hero_005')
  await expect(portrait).not.toHaveClass(/portrait-section--protagonist/)
  await expect(portrait.locator('img')).toHaveCount(1)
  await expect(toggle).toHaveCount(0)
  await expect(portrait.locator('img')).toHaveAttribute('src', /\/chara\/l\/chara005/)
  await expect.poll(() => portrait.locator('img').evaluate(el => el.naturalWidth)).toBeGreaterThan(100)
  await portrait.screenshot({ path: testInfo.outputPath('other-hero-unchanged.png') })
  await page.goto('/#/heroes?id=hero_001')
  await expect(female).toBeVisible()
  if (testInfo.project.name === 'mobile') await expect(male).toBeHidden()
  await page.getByRole('tab', { name: '互动', exact: true }).click()
  await page.getByRole('tab', { name: '营地事件', exact: true }).click()
  await expect(page.getByRole('heading', { name: '营地事件', exact: true })).toBeVisible()
  await expect(page.locator('.event-title-label')).toHaveCount(0)
  await expect(page.getByText(/测试第[12]天事件/)).toHaveCount(0)
  await page.locator('.hero-story-panel').screenshot({ path: testInfo.outputPath('protagonist-camp-empty.png') })
  await page.goto('/#/heroes?id=hero_005')
  await page.getByRole('tab', { name: '互动', exact: true }).click()
  await page.getByRole('tab', { name: '营地事件', exact: true }).click()
  await expect(page.locator('.event-title-label').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('camp events filter test titles for every hero while retaining normal protagonist events', async ({ page }) => {
  await page.route('**/data/parsed/heroes.json*', async route => {
    const response = await route.fetch()
    const data = await response.json()
    for (const id of ['hero_001', 'hero_005']) {
      const hero = data.heroes.find(hero => hero.id === id)
      hero.behavior.heroEvent = [
        { day: 1, title: '营地近况', dialog: 'sj_005_01' },
        { day: 2, title: '营地测试事件', dialog: 'sj_005_02' },
        { day: 3, title: '欢迎回到营地', dialog: 'sj_005_03' }
      ]
    }
    await route.fulfill({ response, json: data })
  })
  for (const id of ['hero_001', 'hero_005']) {
    await page.goto(`/#/heroes?id=${id}`)
    for (let i = 0; i < 10; i++) {
      const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
      if (!await close.count()) break
      await close.click()
    }
    await page.getByRole('tab', { name: '互动', exact: true }).click()
    await page.getByRole('tab', { name: '营地事件', exact: true }).click()
    await expect(page.locator('.event-title-label')).toHaveText([
      '事件: 营地近况 (触发天数: 第 1 天)',
      '事件: 欢迎回到营地 (触发天数: 第 3 天)'
    ])
  }
})
