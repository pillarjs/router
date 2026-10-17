import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

const router = Router()

router.get('/users/:id', (req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Router.Request<{ id: string }>>()
  expectTypeOf(res).toEqualTypeOf<Router.Response>()
  expectTypeOf(next).toEqualTypeOf<Router.NextFunction>()
  expectTypeOf(req.user?.id).toEqualTypeOf<string | undefined>()
  res.sendText(req.params.id.toUpperCase())
  // @ts-expect-error only declared parameter names are available
  res.end(req.params.slug)
  // @ts-expect-error named parameters are strings
  req.params.id = 123
})

router.get('/flights/:from-:to', (req, res) => {
  expectTypeOf(req.params.from).toBeString()
  expectTypeOf(req.params.to).toBeString()
  res.end(req.params.from + req.params.to)
})

router.get('/files/:name.:ext', (req, res) => {
  expectTypeOf(req.params.name).toBeString()
  expectTypeOf(req.params.ext).toBeString()
  res.end(req.params.name)
})

router.get('/users{/:id}/files{/*path}', (req, res) => {
  expectTypeOf(req.params.id).toEqualTypeOf<string | undefined>()
  expectTypeOf(req.params.path).toEqualTypeOf<string[] | undefined>()
  // @ts-expect-error an optional parameter must be narrowed before use
  req.params.id.toUpperCase()
  res.end(req.params.path?.join('/'))
})

router.all('/files/*path', [(req, res, next) => {
  expectTypeOf(req.params.path).toEqualTypeOf<string[]>()
  next()
}], [[(req, res) => {
  expectTypeOf(req.params.path).toEqualTypeOf<string[]>()
  res.end(req.params.path.join('/'))
}]])

router.use('/users/:id', (req, res, next) => {
  expectTypeOf(req.params.id).toBeString()
  next()
})

router.trace('/users/:id', (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})

const route = router.route('/users/:id')
expectTypeOf(route).toEqualTypeOf<Router.Route<'/users/:id'>>()
expectTypeOf(route.path).toEqualTypeOf<'/users/:id'>()
route.get((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
}).post((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  // @ts-expect-error chaining retains the route parameters
  res.end(req.params.other)
}).trace((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})

new Route('/files/*path').get((req, res) => {
  expectTypeOf(req.params.path).toEqualTypeOf<string[]>()
  res.end(req.params.path.join('/'))
})
new Router.Route('/users{/:id}').all((req, res) => {
  expectTypeOf(req.params.id).toEqualTypeOf<string | undefined>()
  res.end(req.params.id)
})

// Paths without known literal names retain the broad parameter type.
declare const dynamicPath: string
router.get(dynamicPath, (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})
router.get(/^\/users\/(\w+)$/, (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})
router.get(['/users/:id', '/accounts/:name'], (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})

router.get('/health', (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<{}>()
  // @ts-expect-error a static path has no named parameters
  res.end(req.params.id)
})

expectTypeOf<Router.RouteParameters<'/users/:id'>>().toEqualTypeOf<{ id: string }>()
expectTypeOf<Route.RouteParameters<'/*path'>>().toEqualTypeOf<{ path: string[] }>()
expectTypeOf<Router.RouteParameters<string>>().toEqualTypeOf<Router.Params>()
expectTypeOf<Router.RouteParameters<RegExp>>().toEqualTypeOf<Router.Params>()
