import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

interface UserParams {
  id: string
}

const router = Router()
const route = router.route('/users/:id')

router.get<UserParams>('/users/:id', (req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Router.Request<UserParams>>()
  expectTypeOf(req.params.id).toBeString()
  expectTypeOf(res).toEqualTypeOf<Router.Response>()
  expectTypeOf(next).toEqualTypeOf<Router.NextFunction>()
  res.end(req.params.id.toUpperCase())
  // @ts-expect-error undeclared parameters are not available
  res.end(req.params.name)
  // @ts-expect-error the declared parameter is a string
  req.params.id = 123
})

router.get<UserParams>('/users/:id', [(req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next()
}], (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})

router.get<{ splat: string[] }>('/files/*splat', (req, res) => {
  expectTypeOf(req.params.splat).toEqualTypeOf<string[]>()
  res.end(req.params.splat.join('/'))
})

router.get<{ id?: string }>('/users{/:id}', (req, res) => {
  expectTypeOf(req.params.id).toEqualTypeOf<string | undefined>()
  res.end(req.params.id)
})

router.get<string[]>(/^\/users\/(\w+)$/, (req, res) => {
  expectTypeOf(req.params[0]).toEqualTypeOf<string | undefined>()
  res.end(req.params[0])
})

const handler: Router.RequestHandler<UserParams> = (req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next()
}

const errorHandler: Router.ErrorRequestHandler<UserParams> = (err, req, res, next) => {
  expectTypeOf(err).toBeAny()
  expectTypeOf(req.params.id).toBeString()
  next(err)
}

const handlers = [handler, [errorHandler, [handler]]] as const

expectTypeOf(router.get<UserParams>('/users/:id', handlers)).toEqualTypeOf(router)
router.get('/users/:id', handler)
router.get('/users/:id', handler, errorHandler)
router.all<UserParams>('/users/:id', handler, errorHandler)
router.get<UserParams>(['/users/:id', '/accounts/:id'], errorHandler, handler)
router.trace<UserParams>('/users/:id', handler)
router.use<UserParams>(handler, handlers)
router.use<UserParams>('/users/:id', handler, handlers)
router.use<UserParams>('/users/:id', (req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next()
})
router.use<UserParams>((req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next()
})

expectTypeOf(route.get<UserParams>(handlers)).toEqualTypeOf(route)
route.get<UserParams>((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})
route.get(handler, errorHandler)
route.all<UserParams>(handler, errorHandler)
route.get<UserParams>(errorHandler, handler)
new Route('/users/:id').get<UserParams>(handler)
new Router.Route('/users/:id').get<UserParams>(handler)

// Explicit handler generics still support error-handler contextual typing.
router.get<Router.ErrorRequestHandler<UserParams>>('/users/:id', (err, req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next(err)
})
route.get<Router.ErrorRequestHandler<UserParams>>((err, req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next(err)
})

expectTypeOf<Route.Request<UserParams>>().toEqualTypeOf<Router.Request<UserParams>>()
expectTypeOf<Route.RequestHandler<UserParams>>().toEqualTypeOf<Router.RequestHandler<UserParams>>()
expectTypeOf<Route.ErrorRequestHandler<UserParams>>().toEqualTypeOf<Router.ErrorRequestHandler<UserParams>>()
expectTypeOf<Router.Request['params']>().toEqualTypeOf<Router.Params>()

const otherHandler: Router.RequestHandler<{ slug: string }> = (req, res) => res.end(req.params.slug)
const otherErrorHandler: Router.ErrorRequestHandler<{ slug: string }> = (err, req, res, next) => next(err)
// @ts-expect-error a handler requiring slug cannot handle the declared id parameters
router.get<UserParams>('/users/:id', otherHandler)
// @ts-expect-error all handlers must accept the declared parameter type
router.get<UserParams>('/users/:id', handler, otherErrorHandler)
// @ts-expect-error mounted handlers must accept the declared parameter type
router.use<UserParams>('/users/:id', otherHandler)
// @ts-expect-error route handlers must accept the declared parameter type
route.get<UserParams>(otherHandler)
// @ts-expect-error invalid handlers are rejected inside nested arrays
route.get<UserParams>([handler, [42]])
// @ts-expect-error a handler is still required
router.get<UserParams>('/users/:id')
