import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { expectTypeOf } from 'expect-type'
import Router from '../..'
import type { Request } from '../..'

const router = Router()

expectTypeOf<Request>().toExtend<IncomingMessage>()

// The router adds these properties before invoking a matching handler.
router.get('/users/:id', (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  expectTypeOf(req.baseUrl).toBeString()
  expectTypeOf(req.originalUrl).toBeString()
  expectTypeOf(req.route).toEqualTypeOf<Router.Route | undefined>()
  expectTypeOf(req.next).toEqualTypeOf<Router.NextFunction | undefined>()

  if (typeof req.params.id === 'string') {
    res.end(req.params.id.toUpperCase())
  }
})

// Wildcard values are arrays, and optional parameters can be absent.
router.get('/files{/*splat}', (req, res) => {
  const splat = req.params.splat
  if (Array.isArray(splat)) {
    expectTypeOf(splat).toEqualTypeOf<string[]>()
    res.end(splat.join('/'))
  } else if (splat === undefined) {
    res.end()
  }
})

// Middleware can run before a route has matched.
router.use((req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  // @ts-expect-error custom request properties require module augmentation
  res.end(req.user)
  // @ts-expect-error custom response properties require module augmentation
  res.end(res.requestId)
  // @ts-expect-error custom response methods require module augmentation
  res.sendText('response')
  if (req.route) {
    expectTypeOf(req.route.path).toEqualTypeOf<Router.Path>()
  }
  req.next?.('router')
  next()
})

router.route('/users/:id').get((req, res) => {
  expectTypeOf(req).toEqualTypeOf<Request<{ id: string }>>()
  res.end(req.params.id)
})

router.use<Router.ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  next(err)
})

// Dispatch still accepts Node requests before router properties are assigned.
createServer((req, res) => {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>()
  router(req, res, () => {})
  router.handle(req, res, () => {})

  // @ts-expect-error router properties do not augment Node's IncomingMessage globally
  res.end(req.params.id)
})
