import { createServer } from 'node:http'
import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

declare module '../..' {
  interface Request {
    user?: { id: string }
  }
}

const router = Router()

router.use((req, res, next) => {
  expectTypeOf(req.user).toEqualTypeOf<{ id: string } | undefined>()
  req.user = { id: '123' }
  // @ts-expect-error custom properties keep their declared types
  req.user = { id: 123 }
  next()
})

router.get('/users/:id', (req, res) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  res.end(req.user?.id)
})

router.param('id', (req, res, next) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  next()
})

router.use<Router.ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  next(err)
})

router.route('/').get((req, res) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  res.end(req.user?.id)
})

new Route('/').get((req, res) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  res.end(req.user?.id)
})

new Router.Route('/').all<Router.ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  next(err)
})

// Augmentation does not change the raw requests accepted by the router.
createServer((req, res) => {
  router(req, res, () => {})
  router.handle(req, res, () => {})
  new Route('/').dispatch(req, res, () => {})
  // @ts-expect-error router augmentation does not modify Node's IncomingMessage
  res.end(req.user)
})
