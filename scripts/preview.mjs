import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch({
  ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
  headless: true,
})
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
})
page.on('pageerror', (error) => console.error('Browser error:', error.message))
await page.goto('http://127.0.0.1:5173/')
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: 'artifacts/menu-desktop.png', fullPage: true })
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: 'artifacts/menu-mobile.png', fullPage: true })
await page.goto('http://127.0.0.1:5173/#/produto/classico')
await page.getByRole('heading', { name: 'Clássico da casa', exact: true }).waitFor()
await page.screenshot({ path: 'artifacts/detail-mobile.png', fullPage: true })
await page.setViewportSize({ width: 1440, height: 1050 })
await page.screenshot({ path: 'artifacts/detail-desktop.png', fullPage: true })
console.log('Screenshots saved in artifacts/.')
await browser.close()
