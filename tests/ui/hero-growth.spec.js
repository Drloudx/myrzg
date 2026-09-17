import { expect, test } from '@playwright/test'

test('hero growth includes star upgrades and completed breakthroughs in stats and costs', async ({ page }, testInfo) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/heroes?id=hero_019')
  const detail = page.locator('#heroModalScroll')
  await detail.getByRole('tab', { name: '基础属性', exact: true }).click()
  const level = detail.getByLabel('目标等级', { exact: true })
  const stars = detail.getByLabel('升星次数', { exact: true })
  const values = detail.locator('.attr-calc-card[data-attribute] .attr-val-calc')
  // 奇瓦原表五项依次为物攻、魔攻、物防、魔防、生命。
  await expect(values).toHaveText(['254', '476', '174', '223', '1437'])
  await expect(stars).toHaveAttribute('max', '13')
  await stars.fill('13')
  await expect(values).toHaveText(['287', '538', '197', '252', '1624'])
  await expect(detail.locator('.level-growth-summary')).toContainText(['突破累计 +0%', '升星累计 +13%'])

  await level.fill('10')
  const breakthrough = detail.getByRole('checkbox', { name: '已完成 10 级突破' })
  await expect(breakthrough).toBeChecked()
  await expect(values).toHaveText(['439', '823', '301', '386', '2486'])
  const cost = detail.locator('.cost-summary-cell').filter({ hasText: '突破所需银币' }).locator('.summary-val')
  const completedCost = await cost.innerText()
  expect(Number(completedCost)).toBeGreaterThan(0)
  await breakthrough.uncheck()
  await expect(values).toHaveText(['401', '752', '275', '352', '2270'])
  await expect(cost).toHaveText('0')
  await expect(detail.locator('.breakthrough-mats-box')).toHaveCount(0)
  await breakthrough.check()
  await expect(cost).toHaveText(completedCost)
  // This hero's first breakthrough has only a coin cost in the supplied data.
  await expect(detail.locator('.growth-formula')).toContainText('突破加成 15%')
  // Only the five growth attributes change: basic attack speed remains 0.735.
  await expect(detail.locator('.static-v-card').filter({ hasText: '基础攻速' })).toContainText('0.735')
  await expect.poll(() => detail.locator('.calculator-inputs').evaluate(el => {
    const bounds = el.getBoundingClientRect()
    return [...el.querySelectorAll('*')].every(child => child.getBoundingClientRect().right <= bounds.right + 1)
  })).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('hero-growth.png') })

  await breakthrough.uncheck()
  await level.fill('11')
  await expect(detail.getByRole('checkbox')).toHaveCount(0)
  await expect(values).toHaveText(['452', '847', '310', '397', '2558'])
  await expect(cost).toHaveText(completedCost)
  await level.fill('50')
  await detail.getByRole('checkbox', { name: '已完成 50 级突破' }).check()
  await expect(values).toHaveText(['1100', '2061', '753', '966', '6222'])
  await expect(detail.locator('.growth-formula')).toContainText('突破加成 75%')

  await page.goto('/#/heroes?id=hero_001')
  await detail.getByRole('tab', { name: '基础属性', exact: true }).click()
  await expect(level).toHaveValue('1')
  await expect(stars).toHaveValue('0')
  expect(errors).toEqual([])
})
