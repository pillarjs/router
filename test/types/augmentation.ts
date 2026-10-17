import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

declare module '../..' {
  interface Request {
    user?: { id: string }
  }

  interface Response {
    requestId?: string
    sendText(text: string): this
  }
}

const router = Router()

expectTypeOf<Router.Response>().toExtend<ServerResponse>()

router.use((req, res, next) => {
  expectTypeOf(req.user).toEqualTypeOf<{ id: string } | undefined>()
  req.user = { id: '123' }
  // @ts-expect-error custom properties keep their declared types
  req.user = { id: 123 }
  expectTypeOf(res.requestId).toEqualTypeOf<string | undefined>()
  res.requestId = 'request-123'
  res.sendText = function (text) {
    expectTypeOf(text).toBeString()
    return this.end(text)
  }
  // @ts-expect-error custom response properties keep their declared types
  res.requestId = 123
  next()
})

router.get('/users/:id', (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.sendText(req.user?.id || '')).toEqualTypeOf<Router.Response>()
  // @ts-expect-error custom response methods check argument types
  res.sendText(123)
})

router.param('id', (req, res, next, value) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  req.user = { id: String(value) }
  expectTypeOf(res.sendText).toEqualTypeOf<Router.Response['sendText']>()
  next()
})

router.use<Router.ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.sendText).toEqualTypeOf<Router.Response['sendText']>()
  next(err)
})

router.route('/').get((req, res) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.sendText('route')).toEqualTypeOf<Router.Response>()
})

new Route('/').get((req, res) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.sendText('route')).toEqualTypeOf<Router.Response>()
})

new Router.Route('/').all<Router.ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.sendText).toEqualTypeOf<Router.Response['sendText']>()
  next(err)
})

// Explicit parameter types preserve request and response augmentation.
const handler: Router.RequestHandler<{ id: string }> = (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(res.requestId).toEqualTypeOf<string | undefined>()
  return res.sendText(req.params.id)
}
router.get<{ id: string }>('/users/:id', handler)
router.route('/users/:id').get<{ id: string }>(handler)

// Augmentation does not change the raw requests and responses accepted by the router.
createServer((req, res) => {
  router(req, res, () => {})
  router.handle(req, res, () => {})
  new Route('/').dispatch(req, res, () => {})
  // @ts-expect-error router augmentation does not modify Node's IncomingMessage
  res.end(req.user)
  // @ts-expect-error router augmentation does not modify Node's ServerResponse
  res.sendText('raw response')
})
