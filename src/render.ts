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
      // https://stackoverflow.com/questions/25098021/securityerror-blocked-a-frame-with-origin-from-accessing-a-cross-origin-frame
      // https://stackoverflow.com/questions/52129649/puppeteer-cors-mistake/52131823
      '--disable-web-security',
      '--disable-site-isolation-trials',
      '--disable-features=IsolateOrigins',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
    ],
  })

  const page = await browser.newPage()

  await page.setViewport({ width: 240, height: 320 })
  await page.setUserAgent(
    'Mozilla/5.0 (Mobile; Nokia 8110 4G; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5'
  )

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
      await page.evaluate(() => {
        // Inject <base> for loading relative resources
        const { origin, pathname } = location
        if (!document.querySelector('base')) {
          const base = document.createElement('base')
          // Use Regex to remove the filename at end
          // https://stackoverflow.com/questions/2161511/quick-regexp-to-get-path
          base.href = `${origin}${pathname.replace(/[^\/]*$/, '')}`
          // Base should normally be added at the beginning of <head> to make the rest of the css and js relative paths work
          const head = document.querySelector('head')
          head.insertBefore(base, head.firstChild)
        }
      })
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
  }
}

export default render
