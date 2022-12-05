import Koa from 'koa'
import Router from 'koa-router'

import json from 'koa-json'
import logger from 'koa-logger'

const app = new Koa()
const router = new Router()

// Hello world
router.get('/', async (ctx, next) => {
  ctx.body = { msg: 'Hello World!' }
  await next()
})

// Middleware
app.use(json())
app.use(logger())

// Routes
app.use(router.routes()).use(router.allowedMethods())

app.listen(3000, () => {
  console.log('Koa started.')
})
