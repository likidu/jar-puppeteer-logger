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

async function login(request: LoginRequest): Promise<Response | string> {
  const { username, password, forum } = request
  console.log(`[puppeteer.app.login] DEBUG: Login: ${forum}`)

  // Set up configurations based on forum
  let url,
    usernameSelector,
    passwordSelector,
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
      submitSelecor = '#codeVerifyButton'

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
  const device = KnownDevices['iPhone X']
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
      waitUntil: ['domcontentloaded', 'load', 'networkidle0'],
    })

    // Login
    await page.type(usernameSelector, username, { delay: 100 })
    await page.type(passwordSelector, password, { delay: 100 })
    await page.click(submitSelecor)

    if (hasCaptcha) {
      const frame = await page.waitForFrame(async frame => {
        return (
          frame.$('iframe[id=tcaptcha_iframe] #tcaptcha_drag_button') !== null
        )
      })

      // await page.waitForSelector('iframe[id=tcaptcha_iframe]')
      // console.log('[puppeteer.app.login] DEBUG: iFrame loaded.')

      // const frameHandle = await page.$('iframe[id=tcaptcha_iframe]')
      // const frame = await frameHandle.contentFrame()

      const offset = await frame.evaluate(() => {
        console.log(`[puppeteer.app.login] DEBUG: In offset now.`)

        // Get captcha image sizes
        const bg = document.querySelector<HTMLImageElement>('img[id=slideBg]')

        const w = bg.naturalWidth
        const h = bg.naturalHeight

        console.log(`[puppeteer.app.login] DEBUG: Captcha size: ${w} x ${h}`)

        // Draw captcha image in Canvas to get data of every pixel
        const cvs = document.createElement('canvas')
        cvs.width = w
        cvs.height = h
        const ctx = cvs.getContext('2d')
        ctx.drawImage(bg, 0, 0)

        const block = document.querySelector(
          'img[id=slideBlock]'
        ) as HTMLImageElement
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

      console.log(`[puppeteer.app.login] DEBUG: Offset: ${offset}`)

      // Get the slide control
      const slideHandle = await frame.$('#tcaptcha_drag_thumb')
      const slide = await slideHandle.boundingBox()

      // Move mouse to the center of the slide control and press
      await page.mouse.move(
        slide.x + slide.width / 2,
        slide.y + slide.height / 2
      )
      await page.mouse.down()

      //
      let current = 0
      while (Math.abs(offset - current) > 5) {
        // Move 2-10 pixels each time
        const distance = Math.round(Math.random() * 8) + 2
        current += distance
        await page.mouse.move(slide.x + distance, slide.y + slide.height / 2)
        console.log(
          `[puppeteer.app.login] DEBUG: Moving: ${current} / ${offset}`
        )
      }

      // Release mouse
      await page.mouse.up()
    }
    await page.waitForNavigation()

    // Get cookies
    const cookie = { cookie: await page.cookies() }
    await browser.close()
    return cookie
  } catch (error) {
    console.log(
      `[puppeteer.app.login] ERROR: Login failed URL: ${url} Error:${error}`
    )
    return 'Login error!'
  }
}

export default login
