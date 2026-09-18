import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

const waitForFurniture = async page => {
  await expect(page.locator('.furniture-card').first()).toBeVisible()
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
}

test('furniture catalog renders, searches and filters the source-backed counts', async ({ page }) => {
  await page.goto('/#/furniture')
  await waitForFurniture(page)

  await expect(page.locator('.header-title')).toContainText('家具图鉴')
  await expect(page.locator('.furniture-count')).toHaveText('共 141 件家具')
  const columnCount = await page.locator('.furniture-grid .ui-card-grid').evaluate(element =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  )
  expect(columnCount).toBe(page.viewportSize().width <= 768 ? 3 : 5)

  await page.getByPlaceholder('搜索家具名称、描述、材料...').fill('原木窗户')
  await expect(page.locator('.furniture-count')).toHaveText('共 1 件家具')
  await expect(page.locator('[data-furniture-id="roomWin_xca1_0"]')).toBeVisible()

  await page.getByTitle('清空').click()
  const blueprintRow = page.locator('.ui-filter-row').filter({ hasText: '家具图纸：' })
  await blueprintRow.getByRole('button', { name: '无图纸', exact: true }).click()
  await expect(page.locator('.furniture-count')).toHaveText('共 19 件家具')
  await expect(page.locator('.furniture-card:visible').first()).toHaveAttribute('data-has-blueprint', 'false')
  await blueprintRow.getByRole('button', { name: '有图纸', exact: true }).click()
  await expect(page.locator('.furniture-count')).toHaveText('共 122 件家具')
  await expect(page.locator('.furniture-card:visible').first()).toHaveAttribute('data-has-blueprint', 'true')
})

test('furniture detail uses a centered portrait and mapped source labels', async ({ page }) => {
  await page.goto('/#/furniture?id=roomTable_xca1_0')
  const detail = page.locator('#furnitureModalScroll')
  await expect(detail).toBeVisible()
  await expect(detail.locator('.furniture-portrait-section__preview')).toBeVisible()
  await expect(detail.locator('.furniture-portrait-section')).toHaveClass(/quality-bg-2/)
  await expect(detail).toContainText('秋日荒野 / 赠送')
  await expect(detail.locator('.blueprint-entry__action')).toHaveCSS(
    'margin-right',
    page.viewportSize().width <= 480 ? '0px' : '8px'
  )
})

test('item collection blueprint and furniture detail navigate in both directions', async ({ page }) => {
  await page.goto('/#/items?itemId=item_50070')
  const itemDetail = page.locator('#itemModalScroll')
  await expect(itemDetail).toBeVisible()
  await expect(page.getByRole('dialog', { name: '原木窗户制作图' })).toBeVisible()

  await itemDetail.locator('.home-item-unlock-link').filter({ hasText: '查看家具' }).click()
  await expect(page).toHaveURL(/#\/furniture\?id=roomWin_xca1_0$/)
  const furnitureDetail = page.locator('#furnitureModalScroll')
  await expect(furnitureDetail).toBeVisible()
  await expect(furnitureDetail.locator('[data-detail-furniture-id="roomWin_xca1_0"]')).toBeVisible()
  await expect(furnitureDetail).toContainText('木板')

  await furnitureDetail.locator('.blueprint-entry[data-item-id="item_50070"]').click()
  await expect(page).toHaveURL(/id=roomWin_xca1_0.*itemId=item_50070|itemId=item_50070.*id=roomWin_xca1_0/)
  await expect(page.getByRole('dialog', { name: '原木窗户制作图' })).toBeVisible()
})

test('missing skin UI art settles on the shared placeholder without base or scene fallback', async ({ page }) => {
  await page.goto('/#/furniture?id=roomLittle_yma7_0')
  const detail = page.locator('#furnitureModalScroll')
  await expect(detail).toBeVisible()
  const missingSkin = detail.locator('.skin-entry[data-skin-id="skin02"]')
  await expect(missingSkin).toContainText('样式3')
  const image = missingSkin.locator('img')
  await expect(image).toHaveAttribute('src', '/ui/visibility-off.svg')
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  expect(await image.getAttribute('src')).not.toContain('build_roomLittle_yma7_0')
  expect(await image.getAttribute('src')).not.toContain('roomLittle_yma7_2.webp')
})

test('source rules drive open conditions and distinguish blueprint art from furniture previews', async ({ page }) => {
  await page.goto('/#/furniture?id=sysAlchemy')
  const alchemyDetail = page.locator('#furnitureModalScroll')
  await expect(alchemyDetail).toBeVisible()
  await expect(alchemyDetail).toContainText('完成《暴风般的复仇》第 3 步「通关关卡0-2」')
  await expect(alchemyDetail).not.toContainText('解锁炼金台。')

  await page.goto('/#/furniture?id=jiaju_muma')
  const horseDetail = page.locator('#furnitureModalScroll')
  await expect(horseDetail).toBeVisible()
  await expect(horseDetail).toContainText('获取方式')
  await expect(horseDetail).toContainText('活动 / 通行证14级')
  await expect(horseDetail).not.toContainText('玩家等级达到 1 级')
  await expect(horseDetail.locator('[data-detail-furniture-id="jiaju_muma"] img').first())
    .toHaveAttribute('src', /\/BuildItem\/build_mzh_kuijia\.webp/)

  await page.goto('/#/items?itemId=item_50121')
  const blueprintDialog = page.getByRole('dialog', { name: '摇摇木马制作图' })
  await expect(blueprintDialog).toBeVisible()
  await expect(blueprintDialog.locator('.home-item-unlock-link img')).toHaveAttribute(
    'src',
    /\/BuildItem\/build_mzh_kuijia\.webp/
  )

  await blueprintDialog.locator('.home-item-unlock-link').click()
  const horseDetailAfterBlueprint = page.locator('#furnitureModalScroll')
  await expect(horseDetailAfterBlueprint).toBeVisible()
  await expect(horseDetailAfterBlueprint.locator('[data-detail-furniture-id="jiaju_muma"] img').first())
    .toHaveAttribute('src', /\/BuildItem\/build_mzh_kuijia\.webp/)
})

test('mailbox uses the in-world scene object preview', async ({ page }) => {
  await page.goto('/#/furniture?id=mailBox')
  const detail = page.locator('#furnitureModalScroll')
  await expect(detail).toBeVisible()
  await expect(detail.locator('[data-detail-furniture-id="mailBox"] img').first())
    .toHaveAttribute('src', /\/RoomObj\/c001_ludeng001\.webp/)
  await expect(detail).toContainText('营地固定设施，无需制作')
  await expect(detail).not.toContainText('药浆草')
})

test('initial camp center does not present generic furniture materials as a recipe', async ({ page }) => {
  await page.goto('/#/furniture?id=sysCenter')
  const detail = page.locator('#furnitureModalScroll')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('初始拥有，无需制作')
  await expect(detail).not.toContainText('木板')
  await expect(detail).not.toContainText('石砖')
})
