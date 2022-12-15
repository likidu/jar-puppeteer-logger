import fs from 'fs'
import https from 'https'
import Koa, { Context } from 'koa'
import Router from 'koa-router'

import bodyParser from 'koa-bodyparser'
import json from 'koa-json'
import logger from 'koa-logger'

import type { LoginRequest } from './config'
import { Forum } from './config'
import login from './login'

const app = new Koa()
const router = new Router()

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

// Check requests
router.use(async (ctx: Context, next) => {
  const { username, password, forum } = ctx.request.body as LoginRequest

  // Assert credentials
  const blank = undefined || ''

  const validCredentials =
    username === blank || password === blank ? undefined : true
  ctx.assert(validCredentials, 400, "Username or password can't be empty!")

  const validForum = !Object.values(Forum).includes(forum) ? undefined : true
  ctx.assert(validForum, 400, 'Forum name is not valid!')

  // 如果监听公网IP地址则最好启用 `ticket` 验证，防止未授权使用
  // let ticket = ctx.query.ticket || ctx.request.body.ticket;
  // ctx.assert(ticket === 'your ticket',400,"Ticket error");
  await next()
})

router.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = 401
    ctx.body = err.message
  }
})

// Router
router.post('/', async ctx => {
  const result = await login(ctx.request.body as LoginRequest)
  ctx.body = result
})

app.use(router.routes()).use(router.allowedMethods())

// app.listen(3000, () => {
//   console.log('Koa started.')
// })

const options = {
  key: fs.readFileSync('./ssl/key.pem'),
  cert: fs.readFileSync('./ssl/cert.pem'),
}

https.createServer(options, app.callback()).listen(3001)
