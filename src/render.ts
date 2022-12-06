import puppeteer from 'puppeteer'

async function render(url: string) {
  console.log(`[puppeteer.app.render] DEBUG: Rendering: ${url}`)

  const urlObj = new URL(url)
  const params = urlObj.searchParams

  console.log('params:', params)

  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-features=NetworkService',
      '-—disable-dev-tools',
    ],
  })

  const page = await browser.newPage()

  // Pause all medias
  page.frames().forEach(frame => {
    frame.evaluate(() => {
      document
        .querySelectorAll('video, audio')
        .forEach((m: HTMLMediaElement) => {
          if (!m) return
          if (m.pause) m.pause()
          m.preload = 'none'
        })
    })
  })

  let content

  try {
    // Wait 50 seconds for spiders default: 30000
    await page.goto(url, {
      timeout: 50000,
      waitUntil: ['domcontentloaded', 'load', 'networkidle0'],
    })
    // Get raw content
    let raw = true
    if (raw) {
      // TODO: 去处块级作用域影响
      content = page.content()
    } else {
      content = await page.evaluate(() => {
        let content = ''
        if (document.doctype) {
          content = new XMLSerializer().serializeToString(document.doctype)
        }
        const doc = document.documentElement.cloneNode(true) as HTMLElement
        // Remove scripts except JSON-LD
        const scripts = doc.querySelectorAll(
          'script:not([type="application/ld+json"])'
        )
        scripts.forEach(s => s.parentNode.removeChild(s))
        // Remove import tags
        const imports = doc.querySelectorAll('link[rel=import]')
        imports.forEach(i => i.parentNode.removeChild(i))
        const { origin, pathname } = location
        // Inject <base> for loading relative resources
        if (!doc.querySelector('base')) {
          const base = document.createElement('base')
          base.href = origin + pathname
          doc.querySelector('head').appendChild(base)
        }
        // Try to fix absolute paths
        const absEls = doc.querySelectorAll(
          'link[href^="/"], script[src^="/"], img[src^="/"]'
        )
        absEls.forEach((el: HTMLElement) => {
          const href = el.getAttribute('href')
          const src = el.getAttribute('src')
          if (src && /^\/[^/]/i.test(src)) {
            // el.src = origin + src
          } else if (href && /^\/[^/]/i.test(href)) {
            // el.href = origin + href
          }
        })
        content += doc.outerHTML
        // Remove comments
        content = content.replace(/<!--[\s\S]*?-->/g, '')
      })
    }
    console.log(`[puppeteer.app.render] DEBUG: Render successfully URL: ${url}`)
    return content
  } catch (error) {
    console.log(
      `[puppeteer.app.render] ERROR: Render failed URL: ${url} Error:${error}`
    )
    return 'render error'
  } finally {
    await browser.close()
  }
}

export default render
