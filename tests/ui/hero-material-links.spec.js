import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

test('opens an item detail from a hero skill upgrade material', async ({ page }) => {
  await page.goto('/#/heroes?id=hero_019')

  const heroDetail = page.locator('#heroModalScroll')
  await expect(heroDetail).toBeVisible()
  await heroDetail.locator('.skill-select-card', { hasText: '焚火冲击' }).click()
  await expect(heroDetail.locator('.skill-meta-tags')).toContainText('CD:')
  await expect(heroDetail.locator('.skill-meta-tags')).toContainText('消耗:')

  const targetLevel = heroDetail.locator('.dual-slider-input--target')
  const dualSlider = heroDetail.locator('.dual-level-slider')
  await dualSlider.click({ position: { x: 220, y: 14 } })
  await expect(targetLevel).not.toHaveValue('1')
  await targetLevel.fill('2')

  const material = heroDetail.locator('.cost-item-pill[data-item-id="item_19012"]')
  await expect(material).toBeVisible()
  await expect(material).toHaveAttribute('title', '火之碎片（点击查看物品）')
  await material.click()

  await expect(page).toHaveURL(/#\/heroes\?(?=.*id=hero_019)(?=.*itemId=item_19012)/)
  await expect(page.getByRole('dialog', { name: '火之碎片' })).toBeVisible()
})
