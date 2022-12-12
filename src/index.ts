import Koa, { Context } from 'koa'
import Router from 'koa-router'

import bodyParser from 'koa-bodyparser'
import json from 'koa-json'
import logger from 'koa-logger'

import render from './render'

const app = new Koa()
const router = new Router()

let url: string

// Middleware
app.use(bodyParser())
app.use(json())
app.use(logger())

// Request log
app.use(async (ctx, next) => {
  await next()
  const time = ctx.response.get('X-Response-Time')
  console.log(
    `[puppeteer.app] DEBUG: ${ctx.ip} ${ctx.method} ${ctx.url} - ${ctx.status} ${ctx.length} ${time} ${ctx.headers['user-agent']}`
  )
})

// Custom header
app.use(async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  ctx.set('X-Response-Time', `${ms}ms`)
  ctx.set('X-Powered-By', 'Koajs')
  ctx.set('X-Engine-By', 'Puppeteer')
})

// Error log
app.on('error', (err, ctx) => {
  console.error('[puppeteer.app] ERROR: ', err.message)
})

// Enforce Url
router.use(async (ctx: Context, next) => {
  // Remove the 'url=' from the querystring
  // @ts-ignore: tx.request.body.url is unknown type
  url = ctx.request.querystring.replace(/^(url\=)/, '') || ctx.request.body.url
  // url = ctx.query.url || ctx.request.body.url

  // Assert url
  ctx.assert(url, 400, "Url can't be null")

  // Set url
  global.url = url

  // 如果监听公网IP地址则最好启用 `ticket` 验证，防止未授权使用
  // let ticket = ctx.query.ticket || ctx.request.body.ticket;
  // ctx.assert(ticket === 'your ticket',400,"Ticket error");
  await next()
})

// Routes
router
  .all('/', async ctx => {
    const html = await render(url)
    ctx.header['content-type'] = 'text/html; charset=UTF-8'
    ctx.body = html
  })
  .use(router.allowedMethods())

app.use(router.routes()).use(router.allowedMethods())

app.listen(3000, () => {
  console.log('Koa started.')
})
