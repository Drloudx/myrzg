// Render the real app, collect model-space bounds, and make reference/action sheets.
// Usage: node scripts/dev/review-mascots.mjs [output directory] [optional hero ids]
import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { MASCOTS } from '../../src/config/mascots.js'

const output = path.resolve(process.argv[2] || '../.tools/mascot-redraw-review')
const ids = new Set(process.argv.slice(3))
const roster = MASCOTS.filter(entry => !ids.size || ids.has(entry.id))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' && /<path>|attribute d|color|SVG/.test(message.text())) errors.push(message.text()) })
await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
await page.addInitScript(() => {
  localStorage.setItem('mitora-mascot-paused', 'true')
  localStorage.setItem('sidebar-mascot-character', '001')
  localStorage.setItem('sidebar-mascot-action', 'idle')
})
const records = []
const actions = [['idle', '待机'], ['think', '思考'], ['swing', '秋千'], ['fish', '钓鱼']]
try {
  await page.goto('http://127.0.0.1:4187/#/runes')
  await page.locator('.mascot-art .hil-figure').waitFor()
  for (const character of roster) {
    await page.getByRole('button', { name: '切换吉祥物角色' }).click()
    const wantedBatch = Math.floor(MASCOTS.findIndex(entry => entry.id === character.id) / 7) + 1
    let batch = Number((await page.locator('.mascot-batch-position').innerText()).split('/')[0])
    while (batch !== wantedBatch) {
      await page.getByRole('button', { name: batch < wantedBatch ? '下一批角色' : '上一批角色' }).click()
      batch += batch < wantedBatch ? 1 : -1
    }
    await page.locator(`[data-character-option="${character.id}"]`).click()
    await page.locator(`.mascot-art .hil-scene[data-character="${character.id}"]`).waitFor()
    const record = { id: character.id, name: character.name, poses: {} }
    for (const [id, name] of actions) {
      await page.getByRole('button', { name: '选择吉祥物动作' }).click()
      await page.getByRole('button', { name: `使用${name}动作` }).click()
      await page.locator(`.mascot-art .hil-scene[data-scene="${id}"][data-stage="loop"]`).waitFor()
      record.poses[id] = await page.locator('.mascot-art .hil-scene').evaluate(svg => {
        for (const animation of svg.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 0 }
        const figure = svg.querySelector('.hil-figure'), r = figure.getBoundingClientRect(), canvas = svg.getBoundingClientRect()
        const scale = svg.querySelector('.mascot-display-scale').getScreenCTM().a
        return { modelHeight: r.height / scale, modelWidth: r.width / scale,
          inset: { left: r.left - canvas.left, right: canvas.right - r.right, top: r.top - canvas.top, bottom: canvas.bottom - r.bottom },
          fits: r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom,
          armCount: figure.querySelectorAll('.mascot-arm').length, legCount: figure.querySelectorAll('.mascot-leg').length,
          paths: figure.querySelectorAll('path').length }
      })
      await page.locator('.mascot-art').screenshot({ path: path.join(output, `${character.id}-${id}.png`) })
    }
    records.push(record)
    console.log(`${character.id} ${character.name}: ${record.poses.idle.modelHeight.toFixed(3)} units; ${Object.values(record.poses).every(pose => pose.fits) ? 'fits' : 'OVERFLOW'}`)
  }
  await writeFile(path.join(output, 'metrics.json'), JSON.stringify({ records, errors }, null, 2))
  const dataImage = async file => 'data:image/png;base64,' + (await readFile(file)).toString('base64')
  const sheets = await browser.newPage({ viewport: { width: 1100, height: 1800 }, deviceScaleFactor: 1 })
  for (let offset = 0; offset < roster.length; offset += 7) {
    const rows = []
    for (const character of roster.slice(offset, offset + 7)) {
      const reference = character.id === '002' ? 'new_hero_002.png' : `hero_${character.id}.png`
      const images = [await dataImage(path.resolve(`public/test2/hero/${reference}`))]
      for (const [id] of actions) images.push(await dataImage(path.join(output, `${character.id}-${id}.png`)))
      rows.push(`<section><h2>${character.id} · ${character.name}</h2><div>${images.map(src => `<img src="${src}">`).join('')}</div></section>`)
    }
    const html = `<!doctype html><meta charset="utf-8"><title>吉祥物形象与四动作对照</title><style>body{margin:0;padding:20px;background:#eee3ca;color:#514b48;font:14px "Microsoft YaHei",sans-serif}header,.labels{display:flex;justify-content:space-around}h1{font-size:22px;margin:0 0 12px}h2{font-size:14px;margin:0;padding:5px 10px;background:#e0d0ae}section{border:1px solid #c5b189;margin:6px 0}section div{display:flex;justify-content:space-around}img{display:block;width:188px;height:235px;object-fit:contain}.labels{margin:10px 0}</style><h1>原图 / 待机 / 思考 / 秋千 / 钓鱼</h1><div class="labels"><span>原始形象</span><span>待机</span><span>思考</span><span>秋千</span><span>钓鱼</span></div>${rows.join('')}`
    await writeFile(path.join(output, `batch-${offset / 7 + 1}.html`), html)
    await sheets.setContent(html)
    await sheets.screenshot({ path: path.join(output, `batch-${offset / 7 + 1}.png`), fullPage: true })
  }
  if (errors.length || records.some(record => Object.values(record.poses).some(pose => !pose.fits || pose.armCount !== 2 || pose.legCount !== 2))) process.exitCode = 1
} finally { await browser.close() }
