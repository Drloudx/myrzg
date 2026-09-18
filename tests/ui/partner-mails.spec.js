import { expect, test } from '@playwright/test'

test('game mail skin loads and selection, filters and narrow reading remain usable', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/partner-mails')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const reader = page.locator('.mail-columns')
  await expect(reader).toBeVisible()
  await expect(page.locator('.mail-content h2')).toHaveText('来见个面吧！')
  await expect(page.locator('.mail-body')).toContainText('小工匠')
  const subject = page.locator('.mail-title.active .mail-subject')
  const ink = await subject.evaluate(el => getComputedStyle(el).color)
  await page.locator('.mail-title.active').hover()
  await page.waitForTimeout(250) // Allow the shared button's 180ms hover transition to finish.
  await expect(subject).toHaveCSS('color', ink)
  const imageFailures = await reader.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(img => img.decode().catch(() => {})))
    return images.filter(img => !img.naturalWidth).map(img => img.src)
  })
  expect(imageFailures).toEqual([])
  for (const file of ['mail_at', 'mail_page', 'mail_page_on', 'mail_botm']) {
    const folder = file === 'mail_botm' ? 'uipanel/emailpanel' : 'EmailPanel_Atlas'
    const response = await page.request.get(`/images/${folder}/${file}.webp`)
    expect(response.ok()).toBe(true)
    // 图片已统一为 .webp，服务端据此返回 image/webp（改名前的 image/png 属名实不符）
    expect(response.headers()['content-type']).toContain('image/webp')
  }
  const search = page.locator('.partner-mails-page input')
  await search.fill('嘉莉缇')
  await expect(page.locator('.mail-hero')).toHaveCount(1)
  await expect(page.locator('.mail-meta')).toContainText('嘉莉缇')
  await expect(page.locator('.mail-content h2')).toHaveText('能否让我拜访营地呀？')
  await expect(page.locator('.mail-title.active .mail-kind')).toHaveAttribute('src', /\/EmailPanel_Atlas\/mail_list_new_task\.webp/)
  await expect(page.locator('.mail-reward-label')).toHaveAttribute('src', /\/Common_Atlas\/com_item_archive\.webp/)
  await expect(page.locator('.mail-reward-label')).toHaveAttribute('alt', '档案奖励')
  const rewards = page.locator('.mail-reward-item .ui-item-card__slot')
  await expect(rewards).toHaveCount(2)
  for (const reward of await rewards.all()) await expect(reward).toHaveCSS('background-image', /\/ItemBagPanel\/item_f_5\.webp/)
  await expect(page.locator('.mail-reward-item .ui-item-card__badge')).toHaveText(['1000', '100'])
  // Compare the reward slot with the actual item catalogue component, including its icon scale.
  const catalogue = await page.context().newPage()
  await catalogue.goto('/#/items')
  await catalogue.locator('.filter-panel input').fill('氪金')
  const item = catalogue.locator('[data-item-id="item_00002"]')
  await expect(item).toBeVisible()
  const slotBackground = await item.locator('.ui-item-card__slot').evaluate(el => getComputedStyle(el).backgroundImage)
  await expect(rewards.nth(1)).toHaveCSS('background-image', slotBackground)
  await catalogue.close()
  const letters = page.locator('.mail-title')
  if (await letters.count() > 1) {
    const subject = await letters.nth(1).locator('.mail-subject').innerText()
    await letters.nth(1).click()
    await expect(page.locator('.mail-content h2')).toHaveText(subject)
    await letters.first().click()
  }
  const bounds = await reader.boundingBox()
  expect(bounds.width).toBeLessThanOrEqual(testInfo.project.name === 'mobile' ? 390 : 1440)
  expect(await reader.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const body = await page.locator('.mail-body').boundingBox()
  expect(body.width).toBeGreaterThan(170)
  expect(body.height).toBeGreaterThan(150)
  await reader.screenshot({ path: testInfo.outputPath('mail-game-light.png') })
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await page.mouse.move(0, 0)
  const darkInk = await subject.evaluate(el => getComputedStyle(el).color)
  await page.locator('.mail-title.active').hover()
  await page.waitForTimeout(250)
  await expect(subject).toHaveCSS('color', darkInk)
  await reader.screenshot({ path: testInfo.outputPath('mail-game-dark.png') })
  await search.fill('不存在的伙伴名字')
  await expect(page.locator('.mail-hero')).toHaveCount(0)
  await expect(page.locator('.mail-content')).toContainText('请选择一封邮件')
  await search.fill('奇瓦')
  await expect(page.locator('.mail-content h2')).toHaveText('来见个面吧！')
  expect(errors).toEqual([])
})

test('all partner mail sources can be searched and opened with the correct colored icons', async ({ page }) => {
  await page.goto('/#/partner-mails')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  await expect(page.locator('.mail-hero')).toHaveCount(36)
  const search = page.locator('.partner-mails-page input')
  await search.fill('写什么标题好呢')
  await expect(page.locator('.mail-hero')).toHaveCount(1)
  await page.locator('.mail-title').filter({ hasText: '写什么标题好呢？' }).click()
  await expect(page.locator('.mail-content h2')).toHaveText('写什么标题好呢？')
  await expect(page.locator('.mail-meta')).toContainText('米托拉')
  await expect(page.locator('.mail-title.active .mail-kind')).toHaveAttribute('src', /\/mail_list_new\.webp/)
  await expect(page.locator('.mail-rewards')).toHaveCount(0)
  await expect(page.locator('.mail-illustration')).toHaveAttribute('src', /\/heromailimg\/01\.webp/)
  await expect.poll(() => page.locator('.mail-illustration').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  await search.fill('一定会有进展的')
  await page.locator('.mail-title').filter({ hasText: '一定会有进展的！' }).click()
  await expect(page.locator('.mail-content h2')).toHaveText('一定会有进展的！')
  await expect(page.locator('.mail-meta')).toContainText('迦南')
  await expect(page.locator('.mail-title.active .mail-kind')).toHaveAttribute('src', /\/mail_list_new_item\.webp/)
  await expect(page.locator('.mail-reward-label')).toHaveAttribute('alt', '附件奖励')
  await expect(page.locator('.mail-reward-item .ui-item-card__badge')).toHaveText(['500', '3', '3'])
  for (const name of ['格薇勒', '阿迪拉', '艾茵']) {
    await search.fill(name)
    await expect(page.locator('.mail-hero')).toHaveCount(1)
    await expect(page.locator('.mail-meta')).toContainText(name)
    await expect(page.locator('.mail-body')).not.toBeEmpty()
  }
  await search.fill('可可娜终于回来了')
  await page.locator('.mail-title').filter({ hasText: '可可娜终于回来了！' }).click()
  await expect(page.locator('.mail-meta')).toContainText('拉碧丝')
  await expect(page.locator('.mail-title.active .mail-kind')).toHaveAttribute('src', /\/mail_list_new_item\.webp/)
  await expect(page.locator('.mail-illustration')).toHaveCount(0)
})

test('mail names are replaced and currency and item rewards open details without losing the letter', async ({ page }) => {
  await page.goto('/#/partner-mails')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const search = page.locator('.partner-mails-page input')
  await search.fill('艾茵')
  const body = page.locator('.mail-body')
  await expect(body).toContainText('小工匠大哥哥（大姐姐）')
  await expect(body).not.toContainText('[callName4]')
  const subject = await page.locator('.mail-content h2').textContent()
  await body.evaluate(el => { el.scrollTop = 100 })
  const beforeScroll = await body.evaluate(el => el.scrollTop)
  const rewards = page.locator('.mail-reward-item')
  await rewards.first().click()
  await expect(page).toHaveURL(/#\/partner-mails\?itemId=item_00001$/)
  const modal = page.locator('.ui-modal-overlay').filter({ has: page.locator('#itemModalScroll') })
  await expect(modal.locator('.item-name')).toHaveText('银币')
  await modal.locator('.ui-modal-close').click()
  await expect(modal).toHaveCount(0)
  await expect(page).not.toHaveURL(/itemId=/)
  await expect(search).toHaveValue('艾茵')
  await expect(page.locator('.mail-content h2')).toHaveText(subject)
  await expect(body).toHaveJSProperty('scrollTop', beforeScroll)
  await rewards.nth(1).focus()
  await rewards.nth(1).press('Enter')
  await expect(page).toHaveURL(/itemId=item_30045$/)
  await expect(modal.locator('.item-name')).toBeVisible()
  await modal.locator('.ui-modal-close').click()
  await expect(page.locator('.mail-content h2')).toHaveText(subject)
})

test('mail titles shrink by whole pixels and mobile mail selection sits above the full-width letter', async ({ page }, testInfo) => {
  await page.goto('/#/partner-mails')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  await page.locator('.partner-mails-page input').fill('在小屋住着的感觉')
  await expect(page.locator('.mail-title')).toHaveCount(3)
  await page.evaluate(() => document.fonts.ready)
  const mobile = testInfo.project.name === 'mobile'
  for (const width of mobile ? [390, 320, 390] : [1440, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.mail-subject').evaluateAll(titles => titles.every(el =>
      el.scrollWidth <= el.clientWidth + 1 && Number.isInteger(parseFloat(getComputedStyle(el).fontSize))
    ))).toBe(true)
    const cards = await page.locator('.mail-title').evaluateAll(els => els.map(el => el.getBoundingClientRect().height))
    expect(cards).toEqual([mobile ? 56 : 66, mobile ? 56 : 66, mobile ? 56 : 66])
    const largestFits = await page.locator('.mail-subject').evaluateAll(titles => titles.every(el => {
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size === 13) return true
      el.style.fontSize = `${size + 1}px`
      const overflow = el.scrollWidth > el.clientWidth + 1
      el.style.fontSize = `${size}px`
      return overflow
    }))
    expect(largestFits).toBe(true)
  }
  if (mobile) {
    const selector = await page.locator('.mail-selector').boundingBox()
    const letter = await page.locator('.mail-content').boundingBox()
    expect(letter.y).toBeGreaterThanOrEqual(selector.y + selector.height - 1)
    expect(letter.width).toBeGreaterThan(selector.width - 12)
    await expect(page.getByRole('button', { name: '上一封邮件', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '下一封邮件', exact: true }).click()
    await expect(page.locator('.mail-position')).toHaveText('2/3')
    await expect(page.locator('.mail-content h2')).toHaveText('你们还好吗？')
    await page.locator('.mail-list').evaluate(el => { el.scrollLeft = el.scrollWidth })
    await expect(page.locator('.mail-position')).toHaveText('3/3')
    await expect(page.getByRole('button', { name: '下一封邮件', exact: true })).toBeDisabled()
    const selectedTitle = await page.locator('.mail-title.active .mail-subject').textContent()
    await expect(page.locator('.mail-content h2')).toHaveText(selectedTitle)
    await page.getByRole('button', { name: '上一封邮件', exact: true }).click()
    await expect(page.locator('.mail-position')).toHaveText('2/3')
  }
  await page.locator('.mail-columns').screenshot({ path: testInfo.outputPath('mail-title-layout.png') })
})

test('mail viewport stays aligned while each overflowing column scrolls independently', async ({ page }, testInfo) => {
  await page.route('**/data/parsed/heroes.json*', async route => {
    const response = await route.fetch()
    const data = await response.json()
    const hero = data.mailboxes[0]
    const mail = hero.mails[0]
    hero.mails = Array.from({ length: 35 }, (_, i) => ({
      ...mail, id: `scroll-check-${i}`, title: `滚动验证信件 ${i + 1}`,
      content: '用于验证长信在正文内部滚动，不能撑高整个页面。\n'.repeat(100)
    }))
    await route.fulfill({ response, json: data })
  })
  await page.goto('/#/partner-mails')
  await expect(page.locator('.mail-body')).toContainText('用于验证长信')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const root = page.locator('.app-container')
  const reader = page.locator('.mail-columns')
  const body = page.locator('.mail-body')
  const list = page.locator('.mail-list')
  const heroes = page.locator('.mail-heroes')
  const sizes = testInfo.project.name === 'desktop'
    ? [{ width: 1912, height: 914 }, { width: 1440, height: 900 }, { width: 1280, height: 720 }]
    : [{ width: 390, height: 844 }, { width: 844, height: 390 }]
  for (const size of sizes) {
    await page.setViewportSize(size)
    await expect.poll(() => root.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
    const box = await reader.boundingBox()
    expect(box.y + box.height).toBeLessThanOrEqual(size.height)
    if (size.width > 1024) {
      const side = await page.locator('.desktop-right-container').boundingBox()
      expect(Math.abs(box.y + box.height - side.y - side.height)).toBeLessThan(2)
    }
    const before = await reader.boundingBox()
    // Native wheel on each panel changes only that panel, including at its end.
    for (const panel of [list, body, ...(size.width > 700 ? [heroes] : [])]) {
      const horizontal = panel === list && size.width <= 700
      const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'
      await panel.evaluate((el, key) => { el[key] = 0 }, scrollKey)
      await panel.hover()
      await page.mouse.wheel(horizontal ? 260 : 0, horizontal ? 0 : 260)
      await expect.poll(() => panel.evaluate((el, key) => el[key], scrollKey)).toBeGreaterThan(0)
      await panel.evaluate((el, key) => { el[key] = key === 'scrollLeft' ? el.scrollWidth : el.scrollHeight }, scrollKey)
      await page.mouse.wheel(horizontal ? 1600 : 0, horizontal ? 0 : 1600)
      await expect(root).toHaveJSProperty('scrollTop', 0)
      expect(await reader.boundingBox()).toEqual(before)
    }
    // 列表横向滚动会经 140ms 防抖触发 select-mail，而选中变化会把 mail-body 的
    // scrollTop 重置为 0（见 PartnerMailReader 的 watch(selectedMail.id)）——那会让
    // 正文的滚动提示重新出现。此处等防抖落定后再把正文滚到底，断言才稳定。
    await page.waitForTimeout(400)
    await body.evaluate(el => { el.scrollTop = el.scrollHeight })
    await page.mouse.wheel(0, 1600)
    await expect(page.locator('.mail-scroll-cue--body')).toHaveCount(0)
    await body.evaluate(el => { el.scrollTop = 0 })
    await expect(page.locator('.mail-scroll-cue--body')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`fixed-mail-${size.width}.png`) })
  }
  // Route-scoped lock must release on a normal long-list page.
  await page.goto('/#/heroes')
  await expect(root).not.toHaveClass(/is-mail-reader/)
})
