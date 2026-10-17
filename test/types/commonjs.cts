import { expectTypeOf } from 'expect-type'
import Router = require('../..')
import Route = require('../../lib/route')

const router: Router.Router = Router()
const constructed: Router.Router = new Router({ mergeParams: true })

router.use(constructed)
router.get('/', (req, res, next) => next())

expectTypeOf(Route).toEqualTypeOf(Router.Route)
expectTypeOf(new Route('/')).toEqualTypeOf<Router.Route<'/'>>()
expectTypeOf(new Router.Route(/^\/users/).path).toEqualTypeOf<RegExp>()
expectTypeOf(new Router.Route(['/users', '/accounts']).path).toEqualTypeOf<string[]>()
expectTypeOf<Router.RequestHandler>().toEqualTypeOf<Route.RequestHandler>()
expectTypeOf<Router.Request>().toEqualTypeOf<Route.Request>()
expectTypeOf<Router.Response>().toEqualTypeOf<Route.Response>()
expectTypeOf<Router.ErrorRequestHandler>().toEqualTypeOf<Route.ErrorRequestHandler>()
expectTypeOf(router.caseSensitive).toEqualTypeOf<boolean | undefined>()
expectTypeOf(router.mergeParams).toEqualTypeOf<boolean | undefined>()
expectTypeOf(router.strict).toEqualTypeOf<boolean | undefined>()

router.get<{ id: string }>('/users/:id', (req, res) => {
  expectTypeOf(req).toEqualTypeOf<Router.Request<{ id: string }>>()
  res.end(req.params.id)
})

new Route('/users/:id').get((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})
