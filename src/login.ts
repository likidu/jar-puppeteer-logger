import puppeteer, { KnownDevices, Protocol } from 'puppeteer'
import { Forum, ForumUrl, LoginRequest } from './types'

// Value for checking that cookie is valid login cookie
enum ForumCookieCheck {
  '4D4Y' = 'cdb_auth',
  CHIPHELL = 'v2x4_48dd_seccode',
}

type Response = {
  cookie: Protocol.Network.Cookie[]
}

async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function login(request: LoginRequest): Promise<Response | string> {
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
      url = ForumUrl['4D4Y']
      cookieCheck = ForumCookieCheck['4D4Y']
      // Selectors
      usernameSelector = 'input[name=username]'
      passwordSelector = 'input[name=password]'
      submitSelecor = '.loginbtn > input[type=submit]'
      break
    case Forum.CHIPHELL:
      url = ForumUrl.CHIPHELL
      cookieCheck = ForumCookieCheck.CHIPHELL
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
    // headless: true,
    headless: false,
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

  // Emluate iPhone X
  const device = KnownDevices['iPhone 12']
  await page.emulate(device)

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
      waitUntil: ['domcontentloaded', 'load', 'networkidle2'],
    })

    // Enter credentials
    await page.type(usernameSelector, username, { delay: 20 })
    await page.type(passwordSelector, password, { delay: 20 })

    if (hasCaptcha) {
      await page.click(verifySelector)

      // const frame = await page.waitForFrame(async frame => {
      //   return frame.$('#tcaptcha_iframe') !== null
      // })
      const iFrameSelector = '#tcaptcha_iframe'
      const bgImageSelector = 'img[id="slideBg"]'
      const blockImageSelector = 'img[id="slideBlock"]'

      await page.waitForSelector(iFrameSelector)
      const frameHandle = await page.$(iFrameSelector)
      const frame = await frameHandle.contentFrame()

      await frame.waitForSelector('img[id="slideBg"]')
      // Wait for the image loaded
      await delay(3000)

      const offset = await frame.evaluate(() => {
        // Get captcha image sizes
        const bg = document.querySelector<HTMLImageElement>('img[id="slideBg"]')

        const w = bg.naturalWidth
        const h = bg.naturalHeight

        // Draw captcha image in Canvas to get data of every pixel
        const cvs = document.createElement('canvas')
        cvs.width = w
        cvs.height = h
        const ctx = cvs.getContext('2d')
        ctx.drawImage(bg, 0, 0)

        const block = document.querySelector<HTMLImageElement>(
          'img[id="slideBlock"]'
        )
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
      })

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

      await delay(1000)
    }

    // Login
    await page.click(submitSelecor)
    await page.waitForNavigation()

    // Get cookies
    const cookie = { cookie: await page.cookies() }
    return cookie
  } catch (error) {
    console.log(
      `[puppeteer.app.login] ERROR: Login failed URL: ${url} Error:${error}`
    )
    return 'Login error!'
  } finally {
    await browser.close()
  }
}

export default login
