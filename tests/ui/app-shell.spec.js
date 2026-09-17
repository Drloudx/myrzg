import { expect, test } from '@playwright/test'

const dismissGlobalModals = async page => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll('.ui-modal-overlay.is-teleported .ui-modal-close')]
        .find(element => element.getClientRects().length > 0)
      if (!button) return false
      button.click()
      return true
    })
    if (!clicked) break
    await page.waitForTimeout(250)
  }
}

const waitForHeroes = async page => {
  await page.goto('/#/heroes')
  await expect(page.locator('.hero-bag-card').first()).toBeVisible()
  await dismissGlobalModals(page)
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
}

test.describe('desktop application scroll shell', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop-only behavior')

  test('uses the app root as the only list page scroll container', async ({ page }) => {
    await waitForHeroes(page)

    const layout = await page.evaluate(() => {
      const root = document.querySelector('.app-container')
      const list = document.querySelector('#heroesGridScroll')
      return {
        rootOverflow: getComputedStyle(root).overflowY,
        rootScrollable: root.scrollHeight > root.clientHeight,
        listOverflow: getComputedStyle(list).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflowY
      }
    })

    expect(layout.rootOverflow).toBe('auto')
    expect(layout.rootScrollable).toBe(true)
    expect(layout.listOverflow).toBe('visible')
    expect(layout.bodyOverflow).not.toBe('auto')

    const root = page.locator('.app-container')
    const sideColumns = page.locator('.desktop-sidebar-container, .desktop-right-container')
    const initialSideTops = await sideColumns.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top))
    await page.locator('.heroes-grid').hover()
    await page.mouse.wheel(0, 700)
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    const scrolledSideTops = await sideColumns.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top))
    expect(scrolledSideTops).toHaveLength(initialSideTops.length)
    scrolledSideTops.forEach((top, index) => expect(Math.abs(top - initialSideTops[index])).toBeLessThanOrEqual(1))

    const backToTop = page.locator('.ui-back-to-top:visible')
    await expect(backToTop).toBeVisible()
    const stickyDesign = await page.evaluate(() => {
      const filter = document.querySelector('.filter-panel')
      const list = document.querySelector('[data-main-scroll]')
      const button = document.querySelector('.ui-back-to-top:not([style*="display: none"])')
      const rightColumn = document.querySelector('.desktop-right-container')
      return {
        filterBackground: getComputedStyle(filter).backgroundColor,
        filterTop: filter.getBoundingClientRect().top,
        rightColumnTop: rightColumn.getBoundingClientRect().top,
        upperClipContent: getComputedStyle(filter, '::before').content,
        listClipTop: parseFloat(list.style.getPropertyValue('--sticky-clip-top')) || 0,
        lowerClipContent: getComputedStyle(filter, '::after').content,
        buttonOffsetFromRightColumn: button.getBoundingClientRect().left - rightColumn.getBoundingClientRect().left
      }
    })
    expect(stickyDesign.filterBackground).not.toMatch(/rgba\([^)]*,\s*0\.[0-9]+\)/)
    expect(Math.abs(stickyDesign.filterTop - stickyDesign.rightColumnTop)).toBeLessThanOrEqual(1)
    expect(stickyDesign.upperClipContent).toBe('none')
    expect(stickyDesign.listClipTop).toBeGreaterThan(0)
    expect(stickyDesign.lowerClipContent).toBe('none')
    expect(stickyDesign.buttonOffsetFromRightColumn).toBeGreaterThanOrEqual(0)
    expect(stickyDesign.buttonOffsetFromRightColumn).toBeLessThanOrEqual(24)
  })

  test('keeps navigation nails fixed and shows cues for both scroll directions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 650 })
    await waitForHeroes(page)

    const navigation = page.locator('.side-panel.desktop-panel .side-body')
    const panel = page.locator('.side-panel.desktop-panel')
    const upCue = panel.locator('.side-scroll-cue--up')
    const downCue = panel.locator('.side-scroll-cue--down')
    const initialState = await navigation.evaluate(element => ({
      overflowY: getComputedStyle(element).overflowY,
      scrollbarWidth: getComputedStyle(element).scrollbarWidth,
      webkitScrollbarDisplay: getComputedStyle(element, '::-webkit-scrollbar').display,
      scrollable: element.scrollHeight > element.clientHeight
    }))

    expect(initialState.overflowY).toBe('auto')
    expect(initialState.scrollbarWidth).toBe('none')
    expect(initialState.webkitScrollbarDisplay).toBe('none')
    expect(initialState.scrollable).toBe(true)
    await expect(panel).toHaveClass(/corner-nails/)
    await expect(navigation).not.toHaveClass(/corner-nails/)
    await expect(upCue).toBeHidden()
    await expect(downCue).toBeVisible()

    await navigation.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect.poll(() => navigation.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await expect(upCue).toBeVisible()
    await expect(downCue).toBeHidden()

    await navigation.evaluate(element => { element.scrollTop = 0 })
    await expect(upCue).toBeHidden()
    await expect(downCue).toBeVisible()
  })

  test('wraps dungeon map filters and keeps the selected state', async ({ page }) => {
    await page.setViewportSize({ width: 1050, height: 900 })
    await page.goto('/#/dungeons')
    await expect(page.locator('.dungeon-card').first()).toBeVisible()
    await dismissGlobalModals(page)

    const panel = page.locator('.dungeon-filter-panel')
    const activeFilter = panel.locator('.ui-filter-pill.is-active')
    await panel.getByRole('button', { name: '秋日荒野', exact: true }).click()
    await expect(activeFilter).toHaveText('秋日荒野')
    const dimensions = await panel.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  })

  test('keeps the exchange grid responsive without framing the data area', async ({ page }) => {
    await page.goto('/#/exchange?cat=entrust')
    await expect(page.locator('.exchange-list > .ui-exchange-trade').first()).toBeVisible()
    await dismissGlobalModals(page)

    const layout = await page.evaluate(() => {
      const filter = document.querySelector('.filter-panel')
      const dataArea = document.querySelector('#exchangeScroll')
      const grid = document.querySelector('.exchange-list')
      const dataStyle = getComputedStyle(dataArea)
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        gridWidth: grid.clientWidth,
        // 栅格为 `repeat(auto-fill, minmax(110px, 1fr))`：列数随可用宽度自适应，
        // 断言应核对「自适应是否生效」而不是钉死某个具体列数（1440 宽为 6 列、1280 宽为 5 列）。
        expectedColumns: Math.floor((grid.clientWidth + 10) / (110 + 10)),
        filterOverflow: getComputedStyle(filter).overflow,
        dataBorderWidth: [
          dataStyle.borderTopWidth,
          dataStyle.borderRightWidth,
          dataStyle.borderBottomWidth,
          dataStyle.borderLeftWidth
        ],
        dataHorizontalPadding: [dataStyle.paddingLeft, dataStyle.paddingRight]
      }
    })

    expect(layout.columns).toBeGreaterThanOrEqual(4)
    expect(layout.columns).toBe(layout.expectedColumns)
    expect(layout.filterOverflow).toBe('visible')
    expect(layout.dataBorderWidth).toEqual(['0px', '0px', '0px', '0px'])
    expect(layout.dataHorizontalPadding).toEqual(['0px', '0px'])
  })

  test('uses formal shop entries and shows the real random-shop rules', async ({ page }) => {
    await page.goto('/#/exchange?cat=market&sub=c4_c5')
    await dismissGlobalModals(page)

    const exchangeData = await page.evaluate(() => fetch('/data/parsed/parsed-exchange.json').then(response => response.json()))
    const byKey = Object.fromEntries(exchangeData.map(category => [category.key, category]))
    const visibleIds = new Set(exchangeData.flatMap(category => category.subs.flatMap(sub => sub.list.map(item => item.id))))
    const excludedIds = [
      'market301', 'market302', 'market_item_50021', 'market_item_50067', 'market_item_50079',
      'item_15021', 'tuzi_item_31012', 'tuzi_item_31009', 'tuzi_item_31013', 'tuzi_item_31011',
      'bke003', 'bke004', 'bke005', 'payke001', 'payke002', 'payke003', 'payke004', 'pack_gift1'
    ]

    expect(byKey.market.label).toBe('地区商店')
    expect(byKey.market.subs.map(sub => [sub.label, sub.list.length])).toEqual([
      ['秋日荒野', 15],
      ['索利德山地', 10],
      ['魔爪湖畔', 10],
      ['黑森林/霜烬平原', 2]
    ])
    expect(byKey.seed.subs.map(sub => [sub.label, sub.list.length])).toEqual([
      ['全部候选', 14],
      ['固定商品', 4],
      ['随机商品', 10]
    ])
    expect(byKey.tuzi.subs.map(sub => [sub.label, sub.list.length])).toEqual([['全部候选', 37]])
    // 时装（fuZhuang / packType 5）是商城的正式子类，必须出现在商店积分下。
    expect(byKey.shop.subs.map(sub => sub.label)).toEqual(['氪金商店', '时装', '星型徽印', '翼型徽印', '回忆结晶'])
    expect(byKey.pack.label).toBe('每日补给')
    expect(byKey.pack.subs[0].list).toHaveLength(2)
    expect(excludedIds.filter(id => visibleIds.has(id))).toEqual([])

    await expect(page.locator('.collection-counter')).toContainText('2')

    // 种子/兔子走「刷新规则」面板：规则与解锁条件集中在 view=rules，
    // 商品卡本身不再渲染 .ui-exchange-trade__meta（断言随现行实现更新）。
    await page.goto('/#/exchange?cat=seed&sub=all')
    await expect(page.locator('.collection-counter')).toContainText('14')
    await expect(page.locator('.exchange-summary, .exchange-rules__summary')).toHaveCount(0)
    await expect(page.locator('.ui-exchange-trade__meta')).toHaveCount(0)

    await page.goto('/#/exchange?cat=seed&sub=all&view=rules')
    await expect(page.locator('.exchange-rules__summary')).toContainText('每池 5 选 2')
    await expect(page.locator('.exchange-rules__group', { hasText: '完成《往日的阴影》后解锁' }).first()).toBeVisible()

    await page.goto('/#/exchange?cat=tuzi&sub=all&rarity=白')
    await expect(page.locator('.collection-counter')).toContainText('3')
    await expect(page.locator('.ui-exchange-trade')).toHaveCount(3)
    await expect(page.locator('.ui-exchange-trade__meta')).toHaveCount(0)

    await page.goto('/#/exchange?cat=tuzi&sub=all&view=rules')
    await expect(page.locator('.exchange-rules__summary')).toContainText('每次共出现 10 项')
    await expect(page.locator('.exchange-rules__group', { hasText: '每次可买 2 个' })).toHaveCount(1)

    await page.goto('/#/exchange?cat=pack&sub=dailySupply')
    await expect(page.locator('.ui-exchange-trade__title')).toHaveText(['下午茶', '晚宴'])
    await expect(page.locator('.ui-exchange-trade__meta')).toHaveText(['开放 12:00-23:59', '开放 18:00-23:59'])
  })

  test('separates auto-added follow-up tasks from unlocked tasks', async ({ page }) => {
    await page.goto('/#/tasks?task=m_0_1')
    await dismissGlobalModals(page)

    const taskData = await page.evaluate(() => fetch('/data/parsed/tasks.json').then(response => response.json()))
    const task = taskData.tasks.find(item => item.id === 'm_0_1')
    expect(task.addTasks).toEqual([{ id: 'm_0_2', name: '暴风般的复仇', close: false }])
    expect(task.unlockTasks).toEqual([{ id: 's_0_5', name: '营地周边的宝地' }])
    expect(task.unlockStages).toEqual([])

    const followUp = page.locator('.task-follow-up-section')
    await expect(followUp).toContainText('暴风般的复仇')
    await expect(followUp).not.toContainText('自动接取')
    await expect(followUp).not.toContainText('营地周边的宝地')
    await expect(followUp.locator('.ui-tag')).toHaveClass(/ui-tag--default/)
    await expect(page.locator('.task-unlock-section').getByText('解锁关卡', { exact: true })).toHaveCount(0)
  })

  test('updates the event counter with the active map filter', async ({ page }) => {
    await page.goto('/#/events')
    await dismissGlobalModals(page)

    const counter = page.locator('.events-filter-panel .collection-counter')
    await expect(counter).toContainText('20 个事件')
    await page.getByRole('button', { name: '秋日荒野', exact: true }).click()
    await expect(counter).toContainText('14 个事件')

    await page.getByRole('button', { name: '探索区域', exact: true }).click()
    await expect(counter).toContainText('80 个探索区域')
    await page.getByRole('button', { name: '黑森林', exact: true }).click()
    await expect(counter).toContainText('16 个探索区域')
  })

  test('keeps atlas search fields and single-row filters aligned', async ({ page }) => {
    const measurements = {}
    const searchPrefixes = {
      items: '搜索物品',
      equip: '搜索装备',
      heroes: '搜索角色',
      monsters: '搜索怪物',
      tasks: '搜索任务'
    }

    for (const route of ['items', 'equip', 'heroes', 'monsters', 'tasks']) {
      await page.goto(`/#/${route}`)
      const filter = page.locator('.filter-panel:visible', {
        has: page.locator(`input[placeholder^="${searchPrefixes[route]}"]`)
      })
      await expect(filter).toBeVisible()
      measurements[route] = await filter.evaluate(element => {
        const panel = element.getBoundingClientRect()
        const search = element.querySelector('.ui-search').getBoundingClientRect()
        return {
          panelHeight: panel.height,
          searchWidth: search.width,
          padding: getComputedStyle(element).padding
        }
      })
    }

    expect(new Set(Object.values(measurements).map(item => item.searchWidth)).size).toBe(1)
    expect(measurements.tasks.panelHeight).toBe(measurements.monsters.panelHeight)
    expect(new Set(Object.values(measurements).map(item => item.padding))).toEqual(new Set(['12px 14px']))
  })

  test('reserves the desktop scrollbar gutter and keeps the detail header fixed above an internally-scrolling body', async ({ page }) => {
    await page.goto('/#/items?itemId=item_30026')
    await dismissGlobalModals(page)
    const header = page.locator('.ui-modal-overlay:not(.is-teleported) .ui-modal-header')
    await expect(header).toBeVisible()

    const root = page.locator('.app-container')
    const initialGap = await page.evaluate(() => (
      document.querySelector('.ui-modal-overlay:not(.is-teleported) .ui-modal-header').getBoundingClientRect().top -
      document.querySelector('.app-header').getBoundingClientRect().bottom
    ))

    // 全局物品详情是覆盖式模态：app-main 锁为视口高、正文在弹窗内部滚动；头部固定在最上方。
    const body = page.locator('.ui-modal-overlay:not(.is-teleported) .ui-modal-body')
    const bodyScrollable = await body.evaluate(element => element.scrollHeight > element.clientHeight)
    if (bodyScrollable) {
      await body.evaluate(element => { element.scrollTop = element.scrollHeight })
      await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    }
    const gapAfterBodyScroll = await header.evaluate(element => (
      element.getBoundingClientRect().top - document.querySelector('.app-header').getBoundingClientRect().bottom
    ))

    const styles = await header.evaluate(element => {
      const body = element.parentElement.querySelector('.ui-modal-body')
      const windowElement = element.parentElement
      return {
        gutter: getComputedStyle(document.querySelector('.app-container')).scrollbarGutter,
        upperLayerContent: getComputedStyle(element, '::before').content,
        bodyOverflowY: getComputedStyle(body).overflowY,
        windowBackground: getComputedStyle(windowElement).backgroundColor,
      }
    })

    expect(styles.gutter).toContain('stable')
    expect(styles.bodyOverflowY).toBe('auto')
    expect(initialGap).toBeGreaterThan(20)
    // 头部固定：正文滚动后，头部仍留在 app-main 顶部（gap 不变）。
    expect(Math.abs(gapAfterBodyScroll - initialGap)).toBeLessThanOrEqual(2)
    expect(styles.upperLayerContent).toBe('none')
    expect(styles.windowBackground).toBe('rgba(0, 0, 0, 0)')
  })

  test('opens details at the top and restores the list position after closing', async ({ page }) => {
    await waitForHeroes(page)
    const root = page.locator('.app-container')
    await root.evaluate(element => element.scrollTo({ top: 480 }))
    const savedTop = await root.evaluate(element => element.scrollTop)

    const visibleCard = page.locator('.hero-bag-card').nth(12)
    await expect(visibleCard).toBeInViewport()
    await visibleCard.click()
    await expect(page.locator('.ui-modal-overlay')).toBeVisible()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(0)

    // 详情是覆盖式模态：页面被锁（不可滚到下方空白、左右栏固定），正文在弹窗内部滚动。
    const body = page.locator('.ui-modal-overlay:not(.is-teleported) .ui-modal-body')
    await expect(body).toHaveCSS('overflow-y', 'auto')

    await page.locator('.ui-modal-close').click()
    await expect(page.locator('.ui-modal-overlay')).toBeHidden()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(savedTop)
  })

  test('removes an inline detail before the restored scrolled list is painted', async ({ page }) => {
    await waitForHeroes(page)
    const root = page.locator('.app-container')
    await root.evaluate(element => element.scrollTo({ top: 480 }))
    const savedTop = await root.evaluate(element => element.scrollTop)

    await page.locator('.hero-bag-card').nth(12).click()
    const pageModal = page.locator('.page-view-container > .ui-modal-host .ui-modal-overlay')
    await expect(pageModal).toBeVisible()

    const firstPaintAfterClose = await pageModal.locator('.ui-modal-close').evaluate(button => (
      new Promise(resolve => {
        button.click()
        requestAnimationFrame(() => {
          resolve({
            overlayPresent: !!document.querySelector('.page-view-container > .ui-modal-host .ui-modal-overlay'),
            rootTop: document.querySelector('.app-container')?.scrollTop || 0
          })
        })
      })
    ))

    expect(firstPaintAfterClose.overlayPresent).toBe(false)
    expect(firstPaintAfterClose.rootTop).toBeGreaterThanOrEqual(savedTop - 8)
    expect(firstPaintAfterClose.rootTop).toBeLessThanOrEqual(savedTop + 8)
  })

  test('restores the list position when closing a global item detail', async ({ page }) => {
    await page.goto('/#/equip')
    await expect(page.locator('.ui-item-card').first()).toBeVisible()
    await dismissGlobalModals(page)

    const root = page.locator('.app-container')
    await root.evaluate(element => element.scrollTo({ top: 480 }))
    const savedTop = await root.evaluate(element => element.scrollTop)
    const card = page.locator('.ui-item-card').first()
    await card.evaluate(element => element.click())

    const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
    await expect(modal).toBeVisible()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(0)
    await modal.locator('.ui-modal-close').click()
    await expect(modal).toBeHidden()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeGreaterThanOrEqual(savedTop - 8)
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(savedTop + 8)
  })

  test('keeps the page scroll locked until nested page and item details are both closed', async ({ page }) => {
    await waitForHeroes(page)
    const root = page.locator('.app-container')
    await root.evaluate(element => element.scrollTo({ top: 480 }))
    const savedTop = await root.evaluate(element => element.scrollTop)

    await page.locator('.hero-bag-card').nth(12).click()
    const pageModal = page.locator('.page-view-container > .ui-modal-host .ui-modal-overlay')
    await expect(pageModal).toBeVisible()
    await pageModal.locator('.fav-gift-badge-inline').first().click()

    const itemModal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
    await expect(itemModal).toBeVisible()
    await expect(page.locator('.ui-modal-host.ui-modal-open')).toHaveCount(2)
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(0)

    await itemModal.locator('.ui-modal-close').click()
    await expect(itemModal).toBeHidden()
    await expect(pageModal).toBeVisible()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(0)

    await pageModal.locator('.ui-modal-close').click()
    await expect(pageModal).toBeHidden()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeGreaterThanOrEqual(savedTop - 8)
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(savedTop + 8)
  })

  test('restores the original page position when nested details close together', async ({ page }) => {
    await waitForHeroes(page)
    const root = page.locator('.app-container')
    await root.evaluate(element => element.scrollTo({ top: 480 }))
    const savedTop = await root.evaluate(element => element.scrollTop)

    await page.locator('.hero-bag-card').nth(12).click()
    const pageModal = page.locator('.page-view-container > .ui-modal-host .ui-modal-overlay')
    await expect(pageModal).toBeVisible()
    await pageModal.locator('.fav-gift-badge-inline').first().click()

    const itemModal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
    await expect(itemModal).toBeVisible()
    await pageModal.locator('.ui-modal-close').evaluate(button => button.click())
    await expect(pageModal).toBeHidden()
    await expect(itemModal).toBeHidden()
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeGreaterThanOrEqual(savedTop - 8)
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(savedTop + 8)
  })

  test('restores the previous item body position after closing a nested ingredient', async ({ page }) => {
    await page.goto('/#/items?itemId=item_30035')
    await dismissGlobalModals(page)

    const itemModal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
    const body = page.locator('#itemModalScroll')
    const title = itemModal.locator('.ui-modal-title')
    const ingredient = itemModal.locator('.ingredient-chip').first()
    await expect(ingredient).toBeVisible()

    const parentTitle = await title.textContent()
    const savedBodyTop = await body.evaluate(element => {
      const top = Math.min(260, element.scrollHeight - element.clientHeight)
      element.scrollTo({ top })
      return element.scrollTop
    })
    expect(savedBodyTop).toBeGreaterThan(0)

    await ingredient.click()
    await expect(title).not.toHaveText(parentTitle)
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(0)

    await itemModal.locator('.ui-modal-close').click()
    await expect(title).toHaveText(parentTitle)
    await expect(itemModal).toBeVisible()
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThanOrEqual(savedBodyTop - 2)
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(savedBodyTop + 2)
  })

  test('fits a short detail page exactly between the side columns', async ({ page }) => {
    await page.goto('/#/items?itemId=item_10028')
    await expect(page.locator('#itemModalScroll')).toBeVisible()
    await dismissGlobalModals(page)

    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect()
      const root = document.querySelector('.app-container')
      return {
        rootClientHeight: root.clientHeight,
        rootScrollHeight: root.scrollHeight,
        mainBottom: rect('.app-main').bottom,
        leftBottom: rect('.desktop-sidebar-container').bottom,
        rightBottom: rect('.desktop-right-container').bottom
      }
    })

    expect(layout.rootScrollHeight).toBe(layout.rootClientHeight)
    expect(Math.abs(layout.mainBottom - layout.leftBottom)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.mainBottom - layout.rightBottom)).toBeLessThanOrEqual(1)
  })

  test('keeps the dungeon detail visible when navigating from an equipment source', async ({ page }) => {
    await page.goto('/#/equip?itemId=item_441003')
    await dismissGlobalModals(page)
    await expect(page.locator('.source-list')).toBeVisible()

    const sourceGroup = page.locator('.source-list .ui-accordion', { hasText: '副本掉落' })
    await sourceGroup.locator('.ui-accordion__head').click()
    await sourceGroup.locator('.drawer-chip', { hasText: '浴池·转化部' }).first().click()

    await expect(page).toHaveURL(/#\/dungeons\?battle=c3_d2_3$/)
    await expect(page.locator('#dungeonDetailScroll')).toContainText('浴池·转化部')
    await expect(page.locator('.page-view-container')).toBeVisible()
    await expect.poll(() => page.locator('.page-view-container').evaluate(element => element.style.display)).not.toBe('none')
    const target = page.locator('.special-drop-card[data-drop-entry="chest-3"]')
    await expect(target).toHaveClass(/special-drop-card--focused/)
    const focusedBorder = await target.evaluate(element => {
      const colorProbe = document.createElement('span')
      colorProbe.style.color = 'var(--gold)'
      element.append(colorProbe)
      const result = {
        border: getComputedStyle(element).borderTopColor,
        gold: getComputedStyle(colorProbe).color
      }
      colorProbe.remove()
      return result
    })
    expect(focusedBorder.border).toBe(focusedBorder.gold)
    await expect(target).toBeInViewport()
    await expect(target).not.toHaveClass(/special-drop-card--focused/, { timeout: 5_000 })
    const normalBorder = await target.evaluate(element => {
      const style = getComputedStyle(element)
      return {
        leftWidth: style.borderLeftWidth,
        topWidth: style.borderTopWidth,
        leftColor: style.borderLeftColor,
        topColor: style.borderTopColor
      }
    })
    expect(normalBorder.leftWidth).toBe(normalBorder.topWidth)
    expect(normalBorder.leftColor).toBe(normalBorder.topColor)
  })

  test('centers an exact hidden-reward source after preview images settle', async ({ page }) => {
    await page.goto('/#/items?itemId=item_57003')
    await dismissGlobalModals(page)
    await expect(page.locator('.source-list')).toBeVisible()

    const sourceGroup = page.locator('.source-list .ui-accordion', { hasText: '被隐藏的物品' })
    await sourceGroup.locator('.ui-accordion__head').click()
    await sourceGroup.locator('.drawer-chip.clickable').first().click()

    await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
      .toMatch(/^#\/rewards\?tab=hidden&map=/)
    const highlightedTarget = page.locator('#rewardsScroll .ui-list-row.highlight-section')
    await expect(highlightedTarget).toBeVisible()
    const targetId = await highlightedTarget.getAttribute('id')
    expect(targetId).toBeTruthy()
    const target = page.locator(`[id="${targetId}"]`)
    await expect(target).toHaveClass(/highlight-section/)
    const highlightStyle = await target.evaluate(element => {
      const normalRow = [...document.querySelectorAll('#rewardsScroll .ui-list-row')]
        .find(row => row !== element)
      const colorProbe = document.createElement('span')
      colorProbe.style.color = 'var(--gold)'
      element.append(colorProbe)
      const targetStyle = getComputedStyle(element)
      const normalStyle = normalRow ? getComputedStyle(normalRow) : null
      const result = {
        background: targetStyle.backgroundColor,
        normalBackground: normalStyle?.backgroundColor || '',
        border: targetStyle.borderTopColor,
        gold: getComputedStyle(colorProbe).color,
        normalBorder: normalStyle?.borderTopColor || '',
        shadow: targetStyle.boxShadow,
        normalShadow: normalStyle?.boxShadow || ''
      }
      colorProbe.remove()
      return result
    })
    expect(highlightStyle.normalBackground).not.toBe('')
    expect(highlightStyle.background).toBe(highlightStyle.normalBackground)
    expect(highlightStyle.border).toBe(highlightStyle.gold)
    expect(highlightStyle.border).not.toBe(highlightStyle.normalBorder)
    expect(highlightStyle.shadow).not.toBe(highlightStyle.normalShadow)
    await expect(target).toBeInViewport()
    await expect(target).not.toHaveClass(/highlight-section/, { timeout: 5_000 })
  })

  test('keeps rewards tabs addressable and restores them after reload', async ({ page }) => {
    await page.goto('/#/rewards?tab=hidden&map=魔爪湖畔')
    await dismissGlobalModals(page)

    const activeMainTab = page.locator('.control-row-1 .ui-filter-pill.is-active')
    const activeSubTab = page.locator('.control-row-2 .ui-filter-pill.is-active')
    await expect(activeMainTab).toHaveText('被隐藏的物品')
    await expect(activeSubTab).toHaveText('魔爪湖畔')

    await page.reload()
    await expect(activeMainTab).toHaveText('被隐藏的物品')
    await expect(activeSubTab).toHaveText('魔爪湖畔')

    await page.locator('.control-row-1 .ui-filter-pill', { hasText: '育室槽位消耗' }).click()
    await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
      .toBe('#/rewards?tab=slot_cost')
  })

  test('groups hidden rooms and persists collection progress in appState', async ({ page }) => {
    await page.goto('/#/rewards?tab=hidden&map=all')
    await dismissGlobalModals(page)

    await expect(page.locator('.control-row-2 .ui-filter-pill.is-active')).toHaveText('全部')
    const rows = page.locator('#rewardsScroll .hidden-list-row')
    await expect(rows.first()).toBeVisible()

    const roomLabels = await rows.locator('.hidden-row-title').allTextContents()
    const positionsByLabel = new Map()
    roomLabels.forEach((label, index) => {
      const positions = positionsByLabel.get(label) || []
      positions.push(index)
      positionsByLabel.set(label, positions)
    })
    for (const positions of positionsByLabel.values()) {
      if (positions.length < 2) continue
      expect(positions.at(-1) - positions[0] + 1).toBe(positions.length)
    }

    const firstToggle = rows.first().locator('.ui-collection-toggle')
    const totalRows = await rows.count()
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'false')
    await firstToggle.click()
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('appState') || '{}')
      return state.collectedHiddenRewardIds?.length || 0
    })).toBe(1)

    const statusRow = page.locator('.ui-filter-row', { hasText: '状态：' })
    await statusRow.locator('.ui-filter-pill', { hasText: '已收集' }).click()
    await expect(rows).toHaveCount(1)
    await statusRow.locator('.ui-filter-pill', { hasText: '未收集' }).click()
    await expect(rows).toHaveCount(totalRows - 1)
    await statusRow.locator('.ui-filter-pill', { hasText: '全部' }).click()
    await expect(rows).toHaveCount(totalRows)

    await page.reload()
    await expect(rows.first().locator('.ui-collection-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('filters rewards content with the shared search field and restores the query', async ({ page }) => {
    await page.goto('/#/rewards?tab=hidden&map=all')
    await dismissGlobalModals(page)

    const search = page.getByPlaceholder('搜索奖励、物品、地图或说明...')
    await search.fill('三岔路口')
    const rows = page.locator('#rewardsScroll .hidden-list-row')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('三岔路口')
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('q'))).toBe('三岔路口')

    await page.reload()
    await expect(search).toHaveValue('三岔路口')
    await expect(rows).toHaveCount(1)
  })

  test('searches pet earnings and uses a theme-matched sortable header', async ({ page }) => {
    await page.goto('/#/petseggs')
    await dismissGlobalModals(page)

    const search = page.getByPlaceholder('搜索魔物名称、星级或收益数据...')
    await search.fill('角布林')
    const rows = page.locator('#petTableGrid .pet-table-row')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('角布林')
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('q'))).toBe('角布林')

    const header = page.locator('.table-header-row')
    await expect(header).toHaveCSS('background-color', 'rgb(233, 220, 195)')
    await header.locator('.th-sellPrice').click()
    await expect(header.locator('.th-sellPrice')).toHaveClass(/is-active/)

    await page.reload()
    await expect(search).toHaveValue('角布林')
    await expect(rows).toHaveCount(1)
  })

  test('locates a lazy achievement card and consumes the one-time id', async ({ page }) => {
    await page.goto('/#/achievement?id=30103')
    const target = page.locator('#ach-card-30103')
    await expect(target).toBeVisible()
    await expect.poll(() => page.url()).toMatch(/#\/achievement$/)
    await expect(target).toHaveClass(/card-highlight-pulse/)
    await expect(target).toBeInViewport()
    await expect(target).not.toHaveClass(/card-highlight-pulse/, { timeout: 5_000 })
  })

  test('locates a recipe in the page scroll root and keeps search state after id cleanup', async ({ page }) => {
    await page.goto('/#/recipes?id=item_30048&q=%E7%9B%90%E7%83%A4%E6%9D%BE%E8%8C%B8%E6%8B%BC%E7%9B%98')
    const target = page.locator('#recipe-card-item_30048')
    await expect(target).toBeVisible()
    await expect.poll(() => page.url()).toMatch(/#\/recipes\?q=%E7%9B%90%E7%83%A4%E6%9D%BE%E8%8C%B8%E6%8B%BC%E7%9B%98$/)
    await expect(target).toHaveClass(/card-highlight-pulse/)
    await expect(target).toBeInViewport()
    await expect(target).not.toHaveClass(/card-highlight-pulse/, { timeout: 5_000 })
  })

  test('keeps interaction voice cards styled after the story panel split', async ({ page }) => {
    await page.setViewportSize({ width: 1050, height: 900 })
    await waitForHeroes(page)
    await page.locator('.hero-bag-card').first().click()
    await expect(page.locator('.detail-tabs')).toBeVisible()

    await page.locator('.detail-tabs .ui-tabs__item', { hasText: '互动' }).click()
    await expect.poll(() => page.locator('.voice-subtabs .ui-tabs').evaluate(element => (
      element.scrollWidth > element.clientWidth
    ))).toBe(true)
    await page.locator('.voice-subtabs .ui-tabs__item', { hasText: '野外探索' }).click()
    const exploreCard = page.locator('.voice-group-card').first()
    await expect(exploreCard).toBeVisible()
    const exploreStyle = await exploreCard.evaluate(element => {
      const line = element.querySelector('.voice-line-item')
      const title = element.querySelector('.voice-group-title')
      return {
        padding: getComputedStyle(element).padding,
        lineBackground: getComputedStyle(line).backgroundColor,
        titleBorderStyle: getComputedStyle(title).borderBottomStyle
      }
    })
    expect(exploreStyle.padding).toBe('12px 14px')
    expect(exploreStyle.lineBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(exploreStyle.titleBorderStyle).toBe('dashed')

    await page.locator('.voice-subtabs .ui-tabs__item', { hasText: '自言自语' }).click()
    const simpleCard = page.locator('.voiceline-card').first()
    await expect(simpleCard).toBeVisible()
    await expect(simpleCard.locator('.v-text-content')).toHaveCSS('font-style', 'italic')
  })

  test('shows formal hero skins only on matching characters', async ({ page }) => {
    await page.goto('/#/heroes?id=hero_005')
    await dismissGlobalModals(page)

    const skinTab = page.locator('.detail-tabs .ui-tabs__item', { hasText: '皮肤' })
    await expect(skinTab).toBeVisible()
    await skinTab.click()
    await expect(page.locator('.skin-heading h4')).toHaveText('难得的休息日')
    await expect(page.locator('.skin-heading')).toContainText('商城购买')
    await expect(page.locator('.skin-attribute-list')).toContainText('生命值 +50')
    await expect(page.locator('.skin-portrait')).toHaveJSProperty('complete', true)

    await page.goto('/#/heroes?id=hero_019')
    await expect(page.locator('.detail-tabs')).toBeVisible()
    await expect(page.locator('.detail-tabs .ui-tabs__item', { hasText: '皮肤' })).toHaveCount(0)
  })

  test('shows formal skin details and opens the matching hero skin tab', async ({ page }) => {
    await page.goto('/#/items?itemId=skin005a')
    await dismissGlobalModals(page)

    const modal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.ui-section__title')).toHaveText([
      '描述',
      '使用效果',
      '皮肤属性',
      '解锁内容',
      '皮肤立绘',
      '获取途径'
    ])
    await expect(modal.locator('.skin-attribute-row')).toContainText('生命值')
    await expect(modal.locator('.skin-attribute-row')).toContainText('+50')
    await expect(modal.locator('.unlock-hero-link')).toContainText('难得的休息日')
    await expect(modal.locator('.unlock-hero-link')).toContainText('茜塔')
    await expect.poll(() => modal.locator('.unlock-hero-icon').evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
    await expect.poll(() => modal.locator('.skin-portrait-preview img').first().evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
    await expect(modal.locator('.source-list')).toContainText('商店积分 · 时装')
    await expect(modal.locator('.source-list')).toContainText('兑换难得的休息日')

    const sourceGroup = modal.locator('.source-list .ui-accordion', { hasText: '兑换' })
    await sourceGroup.locator('.ui-accordion__head').click()
    await sourceGroup.locator('.drawer-chip', { hasText: '商店积分 · 时装' }).click()
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('sub'))).toBe('fuZhuang')
    await expect(page).toHaveURL(/#\/exchange\?cat=shop/)
    await expect(page.getByText('难得的休息日', { exact: true }).first()).toBeVisible()

    await page.goto('/#/items?itemId=skin005a')
    await expect(modal).toBeVisible()
    await modal.locator('.unlock-hero-link').click()
    await expect(page).toHaveURL(/#\/heroes\?id=hero_005&tab=skins$/)
    await expect(page.locator('.detail-tabs .ui-tabs__item.is-active')).toContainText('皮肤')
    await expect(page.locator('.skin-entry')).toContainText('难得的休息日')
  })

  test('shows potion, seed, and pet egg parameters from formal tables', async ({ page }) => {
    const modal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')

    await page.goto('/#/items?itemId=item_30017')
    await dismissGlobalModals(page)
    await expect(modal).toBeVisible()
    await expect(modal.locator('.ui-info-row', { hasText: '药水毒性' })).toContainText('42')
    await expect(modal.locator('.ui-info-row__label', { hasText: /^毒性上限$/ }).locator('..')).toContainText('100')
    await expect(modal.locator('.ui-info-row', { hasText: '距毒性上限' })).toContainText('58')
    await expect(modal.locator('.ui-info-row', { hasText: '魔药精通后' })).toContainText('37 毒性（降低 10%）')

    await page.goto('/#/items?itemId=item_15002')
    await expect(modal.locator('.ui-info-row', { hasText: '成熟时间' })).toContainText('1小时6分钟')
    await expect(modal.locator('.ui-info-row', { hasText: '基础收获' })).toContainText('金铃草 × 1～2')
    await expect(modal.locator('.ui-info-row', { hasText: '药草种植专研 Lv.2' })).toContainText('金铃草 × 2～3')

    await page.goto('/#/items?itemId=pet_006')
    await expect(modal.locator('.ui-info-row', { hasText: '孵化时长' })).toContainText('1小时26分钟')
    await expect(modal.locator('.ui-info-row', { hasText: '出售金币' })).toContainText('535 金币')
    await expect(modal.locator('.ui-info-row', { hasText: '喂养经验' })).toContainText('197 经验')
  })

  test('opens the matching pet atlas entry from pet earnings', async ({ page }) => {
    await page.goto('/#/petseggs?id=pet_006')
    await dismissGlobalModals(page)

    const earningsModal = page.locator('.page-view-container > .ui-modal-host .ui-modal-overlay')
    await expect(earningsModal).toBeVisible()
    await expect(earningsModal.locator('.pet-atlas-link')).toHaveText(/提灯妖精/)
    const petAvatar = earningsModal.locator('.pet-atlas-avatar')
    await expect(petAvatar).toBeVisible()
    await expect.poll(() => petAvatar.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    await earningsModal.locator('.pet-atlas-link').click()

    await expect(page).toHaveURL(/#\/pets\?id=pet_006$/)
    await expect(page.locator('#petModalScroll')).toBeVisible()
    await expect(page.locator('#petModalScroll')).toContainText('提灯妖精')
    await expect(page.locator('#petModalScroll')).not.toContainText('变异概率')
  })

  test('chains wheel scrolling between short and long story text correctly', async ({ page }) => {
    await waitForHeroes(page)
    await page.locator('.filter-panel input').fill('菲莉娜')
    const hero = page.locator('.hero-bag-card').filter({ has: page.locator('.hero-name-label', { hasText: /^菲莉娜$/ }) })
    await expect(hero).toHaveCount(1)
    await hero.click()
    await page.locator('.detail-tabs .ui-tabs__item', { hasText: '角色档案' }).click()

    const toggles = page.locator('.toggle-dialogue-btn')
    await expect(toggles).toHaveCount(2)
    await toggles.first().click()
    await expect(page.locator('.dialog-lines').first()).toBeVisible()

    const root = page.locator('.app-container')
    // 覆盖式模态：页面被锁（不可滚），弹窗正文是唯一滚动容器。
    const body = page.locator('.ui-modal-overlay:not(.is-teleported) .ui-modal-body')
    await expect(body).toHaveCSS('overflow-y', 'auto')
    const bodyOverflowX = await body.evaluate(el => getComputedStyle(el).overflowX)
    expect(bodyOverflowX).toBe('hidden')

    // 短剧情：不产生滚动陷阱——滚轮链到弹窗正文，剧情自身不滚。
    const shortStory = page.locator('.dialog-lines').first()
    const shortSize = await shortStory.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overscrollBehaviorY: getComputedStyle(element).overscrollBehaviorY
    }))
    expect(shortSize.scrollHeight).toBeLessThanOrEqual(shortSize.clientHeight + 1)
    expect(shortSize.overscrollBehaviorY).toBe('auto')
    const bodyBefore = await body.evaluate(element => element.scrollTop)
    await shortStory.hover()
    await page.mouse.wheel(0, 240)
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(bodyBefore)
    expect(await shortStory.evaluate(element => element.scrollTop)).toBe(0)

    // 长剧情：剧情在弹窗正文内可滚动（内容可读到），不产生滚动陷阱也不滚页面。
    await toggles.nth(1).click()
    const longStory = page.locator('.dialog-lines').nth(1)
    await expect(longStory).toBeVisible()
    const longSize = await longStory.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    expect(longSize.scrollHeight).toBeGreaterThan(longSize.clientHeight)
    await longStory.evaluate(element => element.scrollTop = 0)
    await longStory.hover()
    await page.mouse.wheel(0, 240)
    await expect.poll(() => longStory.evaluate(element => element.scrollTop)).toBeGreaterThan(0)

    // 页面被锁：滚轮不滚动页面（root 不变）。
    const rootBefore = await root.evaluate(element => element.scrollTop)
    await page.mouse.wheel(0, 500)
    expect(await root.evaluate(element => element.scrollTop)).toBe(rootBefore)
  })
})

test.describe('mobile application scroll shell', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only behavior')

  test('keeps page scrolling internal without horizontal overflow', async ({ page }) => {
    await waitForHeroes(page)

    const layout = await page.evaluate(() => {
      const root = document.querySelector('.app-container')
      const list = document.querySelector('#heroesGridScroll')
      return {
        rootOverflowY: getComputedStyle(root).overflowY,
        listOverflowY: getComputedStyle(list).overflowY,
        listScrollable: list.scrollHeight > list.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }
    })

    expect(layout.rootOverflowY).toBe('hidden')
    expect(layout.listOverflowY).toBe('auto')
    expect(layout.listScrollable).toBe(true)
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(1)
  })

  test('aligns floating controls and keeps navigation above item details', async ({ page }) => {
    await page.goto('/#/events')
    await expect(page.locator('#eventsGridScroll .ui-item-card').first()).toBeVisible()
    await dismissGlobalModals(page)

    const eventGrid = page.locator('#eventsGridScroll')
    await eventGrid.evaluate(element => { element.scrollTop = element.scrollHeight })
    const backToTop = page.locator('.ui-back-to-top:visible')
    const navButton = page.locator('.nav-fab-btn:visible')
    await expect(backToTop).toBeVisible()
    await expect(navButton).toBeVisible()

    const controlStyles = await page.evaluate(() => {
      const read = element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          borderRadius: style.borderRadius,
          borderWidth: style.borderWidth,
          borderColor: style.borderColor,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          zIndex: style.zIndex
        }
      }
      return {
        navigation: read(document.querySelector('.nav-fab-btn')),
        backToTop: read([...document.querySelectorAll('.ui-back-to-top')].find(element => element.getClientRects().length > 0))
      }
    })
    expect(controlStyles.navigation).toEqual(controlStyles.backToTop)
    expect(controlStyles.navigation.width).toBe(44)
    expect(controlStyles.navigation.height).toBe(44)

    await page.goto('/#/events?itemId=item_10097')
    await dismissGlobalModals(page)
    await expect(page.locator('#itemModalScroll')).toBeVisible()
    await expect(navButton).toBeVisible()
    const layers = await page.evaluate(() => ({
      navigation: Number(getComputedStyle(document.querySelector('.nav-fab-btn')).zIndex),
      itemDetail: Number(getComputedStyle(document.getElementById('itemModalScroll').closest('.ui-modal-overlay')).zIndex)
    }))
    expect(layers.navigation).toBeGreaterThan(layers.itemDetail)

    await navButton.click()
    await expect(page.locator(
      '.navigation-wrapper:not(.is-desktop) .side-panel, ' +
      '.navigation-wrapper:not(.is-desktop) .bottom-sheet, ' +
      '.navigation-wrapper:not(.is-desktop) .top-panel'
    )).toBeVisible()
  })

  test('wraps dungeon category filters without horizontal overflow', async ({ page }) => {
    await page.goto('/#/dungeons')
    await expect(page.locator('.dungeon-card').first()).toBeVisible()
    await dismissGlobalModals(page)

    const panel = page.locator('.dungeon-filter-panel')
    const dimensions = await panel.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(panel.locator('.ui-filter-pill').last()).toBeVisible()
  })
})

test.describe('dungeon route map wheel behavior', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop wheel behavior')

  test('lets a normal wheel scroll the page and reserves Ctrl+wheel for zoom', async ({ page }) => {
    await page.goto('/#/dungeons')
    await expect(page.locator('.dungeon-battle-row').first()).toBeVisible()
    await dismissGlobalModals(page)

    const battles = page.locator('.dungeon-battle-row')
    for (let index = 0; index < await battles.count(); index += 1) {
      await battles.nth(index).click()
      if (await page.locator('.route-map-scroll').isVisible().catch(() => false)) break
      await page.locator('.ui-modal-close').click()
    }

    const map = page.locator('.route-map-scroll')
    await expect(map).toBeVisible()
    const zoom = page.getByLabel('当前地图缩放比例')
    const initialZoom = await zoom.textContent()
    const root = page.locator('.app-container')

    await map.hover()
    await page.mouse.wheel(0, 500)
    await expect(zoom).toHaveText(initialZoom)
    // 详情是覆盖式模态：页面被锁，普通滚轮不滚动页面（不放大也不滚页），Ctrl+滚轮才缩放。
    await expect.poll(() => root.evaluate(element => element.scrollTop)).toBe(0)

    await map.hover()
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect(zoom).not.toHaveText(initialZoom)
  })
})
