import puppeteer from 'puppeteer'

;(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto('https://baidu.com')
  await page
})()
