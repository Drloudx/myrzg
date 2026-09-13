import { expect, test } from '@playwright/test'

async function openItem(page, id) {
  await page.goto(`/#/items?itemId=${id}`)
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(100)
  }
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await expect(modal.getByRole('heading', { name: '获取途径', exact: true })).toBeVisible()
  return modal
}

test('event and explore sources open the exact existing detail', async ({ page }) => {
  for (const [groupName, type] of [['随机事件', 'event'], ['探索区域', 'explore']]) {
    const modal = await openItem(page, 'item_10036')
    const group = modal.locator('.ui-accordion').filter({ has: page.getByRole('button', { name: groupName, exact: true }) })
    await group.getByRole('button', { name: groupName, exact: true }).click()
    const source = group.locator('.drawer-chip').first()
    const name = await source.locator('.source-name').innerText()
    await source.click()
    await expect(page).toHaveURL(new RegExp(`#/events\\?${type}=`))
    await expect(page.locator('.ui-modal-title').filter({ hasText: name }).first()).toBeVisible()
  }
})

test('camp reward shows the correct transition and opens its building level', async ({ page }, testInfo) => {
  const modal = await openItem(page, 'item_50004')
  const group = modal.locator('.ui-accordion').filter({ has: page.getByRole('button', { name: '营地升级', exact: true }) })
  await group.getByRole('button', { name: '营地升级', exact: true }).click()
  await expect(group.getByText('1 → 2 级升级奖励', { exact: true })).toBeVisible()
  await expect(group.locator('.source-action-text')).toHaveCount(1)
  await expect(modal.getByText(/当前未发现正式来源|存在测试配置引用/)).toHaveCount(0)
  const sizes = await group.locator('.drawer-chip').evaluateAll(elements => elements.map(element => ({ width: element.clientWidth, contentWidth: element.scrollWidth })))
  for (const size of sizes) expect(size.contentWidth).toBeLessThanOrEqual(size.width + 1)
  await page.screenshot({ path: testInfo.outputPath('camp-source.png') })
  await group.locator('.drawer-chip').click()
  await expect(page).toHaveURL(/#\/facilities\?facility=camp&mode=building&building=center&level=1$/)
  await expect(page.locator('.camp-level[data-level="1"]')).toBeVisible()
  await expect(page.locator('.camp-level')).toHaveCount(1)
})

test('plant source opens its seed and returns to the crop detail', async ({ page }) => {
  const modal = await openItem(page, 'item_10036')
  const group = modal.locator('.ui-accordion').filter({ has: page.getByRole('button', { name: '种植', exact: true }) })
  await group.getByRole('button', { name: '种植', exact: true }).click()
  await group.locator('.drawer-chip').first().click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('绿榛菇孢子')
  await modal.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('绿榛菇')
})

test('equipment detail shares first-clear and guide sources', async ({ page }) => {
  await page.goto('/#/equip?itemId=item_411000')
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await expect(modal.getByRole('button', { name: '关卡首通', exact: true })).toBeVisible()
  await expect(modal.getByRole('button', { name: '新手引导', exact: true })).toBeVisible()
})
