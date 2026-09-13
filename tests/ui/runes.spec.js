import { expect, test } from '@playwright/test'

async function visit(page, path) {
  await page.goto(`/#${path}`)
  for (let attempt = 0; attempt < 10; attempt++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(150)
  }
}
const modal = page => page.locator('.app-main > .ui-modal-host .ui-modal-overlay')

test('filter header matches other catalogs and remains clean while scrolling and switching tabs', async ({ page }, testInfo) => {
  await visit(page, '/events')
  const counterStyle = element => {
    const style = getComputedStyle(element)
    return { fontSize: style.fontSize, fontWeight: style.fontWeight, color: style.color }
  }
  const expectedStyle = await page.locator('.collection-counter').evaluate(counterStyle)
  await visit(page, '/runes')
  await expect(page.locator('.rune-entry')).toHaveCount(20)
  expect(await page.locator('.collection-counter').evaluate(counterStyle)).toEqual(expectedStyle)
  const search = await page.locator('.filter-panel .ui-search').boundingBox()
  const tabs = await page.getByRole('tablist').boundingBox()
  expect(tabs.y).toBeGreaterThanOrEqual(search.y + search.height)

  await page.evaluate(() => {
    const root = innerWidth >= 1025 ? document.querySelector('.app-container') : document.querySelector('#runesScroll')
    root.scrollTop = 450
  })
  await page.waitForTimeout(250)
  if (testInfo.project.name === 'desktop') {
    expect(await page.locator('.runes-page').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    const clip = await page.locator('#runesScroll').evaluate(element => ({
      top: element.getBoundingClientRect().top,
      clipped: parseFloat(element.style.getPropertyValue('--sticky-clip-top')),
      boundary: document.querySelector('.filter-panel').getBoundingClientRect().bottom
    }))
    expect(Math.abs(clip.top + clip.clipped - clip.boundary)).toBeLessThan(2)
  }
  await page.screenshot({ path: testInfo.outputPath('scrolled-header.png') })
  await page.getByRole('tab', { name: '鉴定', exact: true }).click()
  await expect(page.locator('.rune-plan-heading')).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const root = innerWidth >= 1025 ? document.querySelector('.app-container') : document.querySelector('#runesScroll')
    return root.scrollTop
  })).toBe(0)
  await page.getByRole('tab', { name: '符石列表', exact: true }).click()
  await expect(page.locator('.rune-entry').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('returned-header.png') })
})
async function screenshot(page, testInfo, name) {
  const root = page.locator('.runes-page')
  expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect.poll(() => root.locator('img:visible').evaluateAll(images => images.filter(image => {
    const rect = image.getBoundingClientRect()
    return rect.top < innerHeight && rect.bottom > 0
  }).every(image => image.complete && image.naturalWidth > 0))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath(name) })
}

test('catalog filters effects, levels, positions and preserves context after detail', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await visit(page, '/runes')
  await expect(page.locator('.collection-counter')).toContainText('114')
  await expect(page.getByRole('tab')).toHaveText(['符石列表', '鉴定', '合成'])
  await page.getByRole('button', { name: '2 级', exact: true }).click()
  await expect(page.locator('.collection-counter')).toContainText('19')
  await page.getByPlaceholder('搜索符石、效果或材料...').fill('生命')
  await expect(page.locator('.collection-counter .count-num')).toHaveText('1')
  await screenshot(page, testInfo, 'catalog.png')
  await expect(page.locator('.rune-entry').getByRole('button')).toHaveCount(0)
  await page.locator('.rune-entry .ui-item-card').click()
  await expect(modal(page).locator('.ui-modal-title')).toHaveText('生命符石Ⅱ')
  await expect(modal(page).locator('.rune-effect-box')).toContainText('355')
  await expect(modal(page).getByRole('button', { name: '查看符石图鉴', exact: true })).toHaveCount(0)
  await modal(page).locator('.ui-modal-close').click()
  await expect(page.getByPlaceholder('搜索符石、效果或材料...')).toHaveValue('生命')
  await page.getByRole('button', { name: '武器', exact: true }).click()
  await expect(page.getByText('没有符合条件的符石', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '头盔', exact: true }).click()
  await expect(page.locator('.collection-counter .count-num')).toHaveText('1')
  await page.getByRole('tab', { name: '合成', exact: true }).click()
  await expect(page.locator('.rune-synthesis-heading').first()).toContainText('生命符石Ⅱ')
  await page.goBack()
  await expect(page.getByPlaceholder('搜索符石、效果或材料...')).toHaveValue('生命')
  await page.getByPlaceholder('搜索符石、效果或材料...').fill('nothing_matches')
  await expect(page.getByText('没有符合条件的符石', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('appraisal deep link and batch totals share item rules', async ({ page }, testInfo) => {
  await visit(page, '/runes?tab=appraisal&id=item_19304')
  await expect(page.locator('.rune-plan-heading h2')).toHaveText('未鉴定的水火符石Ⅰ')
  await expect(page.locator('.acquisition-costs')).toContainText('×100')
  await expect(page.locator('.acquisition-group .ui-reward-card')).toHaveCount(12)
  await expect(page.getByText('单次抽取 23.50%', { exact: true })).toHaveCount(4)
  await page.getByRole('spinbutton').fill('3')
  await page.getByRole('spinbutton').press('Tab')
  await expect(page.locator('.acquisition-costs')).toContainText('×300')
  await expect(page.locator('.rune-plan-heading')).toContainText('消耗 3 个')
  await expect(page.locator('.acquisition-heading')).toContainText('抽取 3 次')
  await expect(page.getByText('单次抽取 23.50%', { exact: true })).toHaveCount(4)
  await screenshot(page, testInfo, 'appraisal.png')
  await page.locator('.acquisition-group .ui-reward-card').first().click()
  await expect(modal(page).locator('.ui-modal-title')).toHaveText('流水符石Ⅰ')
  await modal(page).locator('.ui-modal-close').click()
  await expect(page.getByRole('spinbutton')).toHaveValue('3')
  await expect(page.locator('.rune-plan-heading h2')).toHaveText('未鉴定的水火符石Ⅰ')
  await expect(page.locator('.rune-plan-select select')).toHaveCount(0)
})

test('appraisal picker, framed icons, count arrows and weighted results', async ({ page }, testInfo) => {
  await visit(page, '/runes?tab=appraisal&id=item_19304')
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  expect(await page.locator('#runesScroll').evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('2px')
  expect(await page.locator('.rune-plan-icon .ui-item-card__slot').evaluate(element => getComputedStyle(element).backgroundImage)).toContain('item_f_')
  await expect(page.getByRole('button', { name: '查看物品', exact: true })).toHaveCount(0)
  if (testInfo.project.name === 'mobile') {
    const heading = await page.locator('.rune-plan-heading').boundingBox()
    const actions = await page.locator('.rune-appraisal-actions').boundingBox()
    expect(Math.abs(actions.x - heading.x)).toBeLessThan(1)
  }
  await expect(page.getByText('单次抽取 1.25%', { exact: true })).toHaveCount(4)
  await expect(page.getByText('单次抽取 0.25%', { exact: true })).toHaveCount(4)
  await page.locator('.rune-plan-icon').click()
  await expect(modal(page).locator('.ui-modal-title')).toHaveText('未鉴定的水火符石Ⅰ')
  await modal(page).locator('.ui-modal-close').click()
  await page.getByRole('button', { name: '选择其他', exact: true }).click()
  await expect(page.locator('.rune-choices > button')).toHaveCount(8)
  if (testInfo.project.name === 'mobile') {
    for (const selector of ['.rune-choices', '.acquisition-group .acquisition-grid']) {
      expect(await page.locator(selector).evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2)
    }
  }
  await screenshot(page, testInfo, 'appraisal-picker.png')
  await page.locator('.rune-choices > button').filter({ hasText: '未鉴定的风地符石Ⅲ' }).click()
  await expect(page.locator('.rune-plan-heading h2')).toHaveText('未鉴定的风地符石Ⅲ')
  await expect(page.locator('.rune-choices')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '减少次数', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '增加次数', exact: true }).click()
  await page.getByRole('button', { name: '增加次数', exact: true }).click()
  await expect(page.getByRole('spinbutton')).toHaveValue('3')
  await page.getByRole('button', { name: '减少次数', exact: true }).click()
  await expect(page.getByRole('spinbutton')).toHaveValue('2')
  await page.getByRole('spinbutton').fill('9999')
  await page.getByRole('spinbutton').press('Tab')
  await expect(page.getByRole('spinbutton')).toHaveValue('999')
  await expect(page.getByRole('button', { name: '增加次数', exact: true })).toBeDisabled()
  await page.getByRole('spinbutton').fill('12')
  // Clicking directly from the input must commit the new batch count first.
  await page.getByRole('button', { name: '鉴定', exact: true }).click()
  await expect(page.locator('.rune-draw-results')).toContainText('鉴定结果（12 次）')
  const quantities = () => page.locator('.rune-draw-results [data-quantity]').evaluateAll(elements => elements.reduce((sum, element) => sum + Number(element.dataset.quantity), 0))
  expect(await quantities()).toBe(12)
  if (testInfo.project.name === 'mobile') {
    expect(await page.locator('.rune-results-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2)
  }
  await screenshot(page, testInfo, 'appraisal-results.png')
  const before = await page.locator('.rune-draw-results').innerText()
  await page.locator('.rune-draw-results button').first().click()
  await expect(modal(page)).toBeVisible()
  await modal(page).locator('.ui-modal-close').click()
  await expect(page.locator('.rune-draw-results')).toHaveText(before, { useInnerText: true })
  await page.getByRole('spinbutton').fill('1')
  await page.getByRole('button', { name: '鉴定', exact: true }).click()
  await expect(page.locator('.rune-draw-results')).toContainText('鉴定结果（1 次）')
  expect(await quantities()).toBe(1)
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'))
  await screenshot(page, testInfo, 'appraisal-dark.png')
  await page.getByRole('button', { name: '选择其他', exact: true }).click()
  await page.locator('.rune-choices > button').first().click()
  await expect(page.locator('.rune-draw-results')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('synthesis cards show single-use materials, effect comparisons and filters', async ({ page }, testInfo) => {
  await visit(page, '/runes?tab=synthesis&id=item_19311&count=2')
  const card = page.locator('[data-synthesis="item_19311"]')
  await expect(page.locator('.rune-synthesis-entry')).toHaveCount(20)
  await expect(page.locator('select')).toHaveCount(0)
  await expect(card.locator('.rune-entry__name')).toContainText('生命符石Ⅱ')
  await expect(card).toHaveClass(/is-target/)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(card.locator('.rune-synthesis-costs')).toContainText('×300')
  await expect(card.locator('.rune-synthesis-costs')).toContainText('×3')
  await expect(card.locator('.rune-output-quantity')).toHaveText('×1')
  await expect(card.locator('.rune-synthesis-effects')).toContainText('240')
  await expect(card.locator('.rune-synthesis-effects')).toContainText('355')
  await screenshot(page, testInfo, 'synthesis.png')
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'))
  await page.waitForTimeout(300)
  await screenshot(page, testInfo, 'synthesis-dark.png')
  await card.locator('.ui-reward-card').filter({ hasText: '生命符石Ⅰ' }).click()
  await expect(modal(page).locator('.ui-modal-title')).toHaveText('生命符石Ⅰ')
  await modal(page).locator('.ui-modal-close').click()
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(card.locator('.rune-synthesis-costs')).toContainText('×300')
  await expect(card.locator('.rune-output-quantity')).toHaveText('×1')
  await page.getByRole('button', { name: '2 级', exact: true }).click()
  await expect(page.locator('.collection-counter .count-num')).toHaveText('19')
  await page.getByPlaceholder('搜索符石、效果或材料...').fill('生命')
  await expect(page.locator('.rune-synthesis-entry')).toHaveCount(1)
  await card.locator('.ui-item-card').click()
  await expect(modal(page).locator('.ui-modal-title')).toHaveText('生命符石Ⅱ')
  await modal(page).locator('.ui-modal-close').click()
  await expect(page.getByPlaceholder('搜索符石、效果或材料...')).toHaveValue('生命')
  await page.getByRole('button', { name: '武器', exact: true }).click()
  await expect(page.getByText('没有符合条件的方案', { exact: true })).toBeVisible()
})

test('late synthesis source is promoted and the full card list loads while scrolling', async ({ page }) => {
  await visit(page, '/runes?tab=synthesis&id=item_19515')
  await expect(page.locator('.rune-synthesis-entry').first()).toHaveAttribute('data-synthesis', 'item_19515')
  await expect(page.locator('.rune-synthesis-entry').first()).toContainText('御地符石Ⅵ')
  await expect(page.locator('.collection-counter .count-num')).toHaveText('95')
  for (let step = 0; step < 5; step++) {
    await page.evaluate(() => {
      const root = innerWidth >= 1025 ? document.querySelector('.app-container') : document.querySelector('#runesScroll')
      root.scrollTop = root.scrollHeight
    })
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.rune-synthesis-entry')).toHaveCount(95)
})

test('full catalog uses real images and loads all levels while scrolling', async ({ page }, testInfo) => {
  await visit(page, '/runes')
  await expect(page.locator('.rune-entry')).toHaveCount(20)
  await expect(page.locator('.rune-entry__name').first()).toHaveText('生命符石Ⅰ')
  await screenshot(page, testInfo, 'catalog-full.png')
  for (let step = 0; step < 6; step++) {
    await page.evaluate(() => {
      for (const selector of ['#runesScroll', '.app-container']) {
        const element = document.querySelector(selector)
        if (element) element.scrollTop = element.scrollHeight
      }
    })
    await page.waitForTimeout(200)
  }
  await expect(page.locator('.rune-entry')).toHaveCount(114)
})

for (const path of ['/items', '/equip']) {
  test(`${path} source links target exact synthesis and appraisal plans`, async ({ page }) => {
    await visit(page, `${path}?itemId=item_19311`)
    await expect(modal(page)).toBeVisible()
    await modal(page).getByText('符石合成', { exact: true }).first().click()
    await modal(page).locator('.drawer-chip').filter({ hasText: '生命符石Ⅰ' }).click()
    await expect(page).toHaveURL(/runes\?tab=synthesis&id=item_19311/)
    await expect(page.locator('.rune-synthesis-heading').first()).toContainText('生命符石Ⅱ')
    await visit(page, `${path}?itemId=item_19440`)
    await expect(modal(page)).toBeVisible()
    await modal(page).getByText('符石鉴定', { exact: true }).first().click()
    await modal(page).locator('.drawer-chip').filter({ hasText: '未鉴定的水火符石Ⅰ' }).click()
    await expect(page).toHaveURL(/runes\?tab=appraisal&id=item_19304/)
  })
}

test('exchange page removes rune recipes and recovers old category links', async ({ page }) => {
  await visit(page, '/exchange?cat=gem')
  await expect(page.locator('.collection-counter')).toContainText('条兑换')
  await expect(page.getByRole('button', { name: '符石合成', exact: true })).toHaveCount(0)
  await expect(page).not.toHaveURL(/cat=gem/)
  await expect(page.getByText('未找到符合条件的兑换', { exact: true })).toHaveCount(0)
  await expect(page.locator('.exchange-list').getByText('生命符石Ⅱ', { exact: true })).toHaveCount(0)
})

test('invalid payload shows retry and recovers', async ({ page }) => {
  let broken = true
  await page.route('**/data/parsed/runes.json*', async route => {
    if (broken) await route.fulfill({ json: {} })
    else await route.continue()
  })
  await visit(page, '/runes')
  await expect(page.getByText('符石图鉴加载失败，请重试。', { exact: true })).toBeVisible()
  broken = false
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.collection-counter')).toContainText('114')
})
