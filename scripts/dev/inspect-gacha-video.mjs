import fs from 'node:fs'
import { chromium } from '@playwright/test'

const output = process.argv[2]
fs.mkdirSync(output, { recursive: true })
const bytes = fs.readFileSync('E:/Downloads/QQ20260909-055234.mp4')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  await page.route('http://video.local/**', route => {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Number(range[2]) : bytes.length - 1
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', headers: {
      'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {})
    }, body: bytes.subarray(start, end + 1) })
  })
  await page.setContent('<video id="video" crossorigin="anonymous" src="http://video.local/reference.mp4" muted preload="auto"></video>')
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2)
  const duration = await page.locator('video').evaluate(video => video.duration)
  console.log({ duration })
  const frames = await page.evaluate(async duration => {
    const video = document.querySelector('video')
    const canvas = document.createElement('canvas')
    canvas.width = 424; canvas.height = 238
    const ctx = canvas.getContext('2d')
    const frames = []
    for (let time = 0.1; time < duration; time += 2) {
      await new Promise(resolve => { video.onseeked = resolve; video.currentTime = time })
      ctx.drawImage(video, 0, 0, 424, 238)
      frames.push({ time: time.toFixed(1), image: canvas.toDataURL() })
    }
    return frames
  }, duration)
  for (let i = 0; i < frames.length; i += 12) {
    await page.setContent(`<body style="margin:0;background:#111;color:white;display:grid;grid-template-columns:repeat(3,424px);gap:2px">${frames.slice(i, i + 12).map(frame => `<div>${frame.time}s<img style="display:block" src="${frame.image}"></div>`).join('')}</body>`)
    await page.screenshot({ path: `${output}/video-${i}.png`, fullPage: true })
  }
} finally { await browser.close() }
