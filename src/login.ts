import type { Page } from 'puppeteer'
import puppeteer, { KnownDevices, Protocol } from 'puppeteer'
import { Forum, ForumSettings, LoginRequest } from './config'

type Response = {
  cookies: Protocol.Network.Cookie[]
}

/**
 * Delay ms
 * @param ms seconds * 1000
 * @returns void
 */
async function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * Pass slide captacha
 * @param page Page instance
 * @param iframeSelector iframe selector
 * @param bgSelector background selector
 * @param blockSelector block selector
 */
async function slideCaptcha(
  page: Page,
  iframeSelector: string,
  bgSelector: string,
  blockSelector: string
) {
  // Get iframe
  // const frame = await page.waitForFrame(async frame => {
  //   return frame.$('#tcaptcha_iframe') !== null
  // })
  await page.waitForSelector(iframeSelector)
  const frameHandle = await page.$(iframeSelector)
  const frame = await frameHandle.contentFrame()

  // Wait for the image loaded
  await frame.waitForSelector(bgSelector)
  await delay(5000)

  const offset = await frame.evaluate(
    (bgSelector, blockSelector): number => {
      // Get captcha image sizes
      const bg = document.querySelector<HTMLImageElement>(bgSelector)

      const w = bg.naturalWidth
      const h = bg.naturalHeight

      // Draw captcha image in Canvas to get data of every pixel
      const cvs = document.createElement('canvas')
      cvs.width = w
      cvs.height = h
      const ctx = cvs.getContext('2d')
      ctx.drawImage(bg, 0, 0)

      const block = document.querySelector<HTMLImageElement>(blockSelector)
      const y = parseInt(block.style.top) * 2 + 40
      let lastWhite = -1
      for (let x = w / 2; x < w; x++) {
        const clampedArray = new Uint8ClampedArray(
          ctx.getImageData(x, y, 1, 1).data
        )
        const [r, g, b] = Array.from(clampedArray)
        const grey = (r * 299 + g * 587 + b * 114) / 1000

        // If the threshold > 150, treat it as white color
        if (grey > 150) {
          if (lastWhite === -1 || x - lastWhite !== 88) {
            lastWhite = x
          } else {
            lastWhite /= 2 // 1/2 size of image
            lastWhite -= 37 // slide left(26) + slide own offset(23 / 2)
            lastWhite >>= 0 // pixel to move must be int
            return lastWhite
          }
        }
      }
    },
    bgSelector,
    blockSelector
  )

  console.log(`[puppeteer.app.login] DEBUG: Offset = ${offset}`)

  // Get the slide control
  const slideHandle = await frame.$('#tcaptcha_drag_thumb')
  const slide = await slideHandle.boundingBox()

  const x = slide.x + slide.width / 2
  const y = slide.y + slide.height / 2

  // Move mouse to the center of the slide control and press
  await page.mouse.move(x, y)
  await page.mouse.down()

  // Release mouse
  await page.mouse.move(x + offset, y, { steps: 30 })
  await page.mouse.up()

  await delay(2000)
}

/**
 * Login entry function
 * @param request LoginRequest
 * @returns login cookie
 */
async function login(request: LoginRequest): Promise<Response | Error> {
  const { username, password, forum } = request
  console.log(`[puppeteer.app.login] DEBUG: Login: ${forum}`)

  // Set up configurations based on forum
  let url,
    usernameSelector,
    passwordSelector,
    verifySelector,
    submitSelecor,
    cookieCheck: string
  let hasCaptcha = false

  switch (forum) {
    case Forum['4D4Y']:
      url = ForumSettings['4D4Y'].url
      cookieCheck = ForumSettings['4D4Y'].check
      // Selectors
      usernameSelector = 'input[name=username]'
      passwordSelector = 'input[name=password]'
      submitSelecor = '.loginbtn > input[type=submit]'
      break
    case Forum.CHIPHELL:
      url = ForumSettings.CHIPHELL.url
      cookieCheck = ForumSettings.CHIPHELL.check
      hasCaptcha = true
      // Selectors
      usernameSelector = 'input[name=username]'
      passwordSelector = 'input[name=password]'
      verifySelector = '#codeVerifyButton'
      submitSelecor = '#btn_login'

    default:
      break
  }

  // Create Puppeteer browser
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: process.env.NODE_ENV === 'production',
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

  // Emluate iPhone 12
  const device = KnownDevices['iPhone 12']
  await page.emulate(device)

  // Block static image loading to prevent timeout
  // TODO: Make it as function
  if (hasCaptcha) {
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (req.url().indexOf('static.chiphell.com') > 0) req.abort()
      else req.continue()
    })
  }

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

  try {
    await page.goto(url, {
      waitUntil: ['domcontentloaded', 'load', 'networkidle0'],
    })

    // Enter credentials
    await page.type(usernameSelector, username, { delay: 20 })
    await page.type(passwordSelector, password, { delay: 20 })

    if (hasCaptcha) {
      await page.click(verifySelector)

      if (forum === Forum.CHIPHELL) {
        await slideCaptcha(
          page,
          '#tcaptcha_iframe',
          'img[id="slideBg"]',
          'img[id="slideBlock"]'
        )
      }
    }

    // Login
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'load',
      }),
      page.click(submitSelecor),
    ])

    // Get cookies
    const cookies = await page.cookies()

    // Check cookie has valid key to prove its logged in
    if (!cookies.find(o => o.name === cookieCheck))
      throw new Error('Cookie does not have valid key')

    return { cookies }
  } catch (error) {
    console.log(
      `[puppeteer.app.login] ERROR: Login failed URL: ${url} ${error}`
    )
    // return error
    throw new Error(`${error}, login failed!`)
  } finally {
    await browser.close()
  }
}

export default login
