import { expectTypeOf } from 'expect-type'
import type Router from '../..'

interface ExtendedRouter extends Router.Router {
  custom(): this
}

interface ExtendedRoute extends Router.Route {
  custom(): this
}

declare const router: ExtendedRouter
declare const route: ExtendedRoute
const handler: Router.RequestHandler = (req, res, next) => next()

expectTypeOf(router.use(handler)).toEqualTypeOf<ExtendedRouter>()
expectTypeOf(router.use('/users', handler)).toEqualTypeOf<ExtendedRouter>()
expectTypeOf(router.get('/', handler)).toEqualTypeOf<ExtendedRouter>()
expectTypeOf(router.trace('/', handler)).toEqualTypeOf<ExtendedRouter>()
expectTypeOf(router['m-search']('/', handler)).toEqualTypeOf<ExtendedRouter>()
router.use(handler).trace('/', handler).custom().get('/', handler).custom()

expectTypeOf(route.all(handler)).toEqualTypeOf<ExtendedRoute>()
expectTypeOf(route.get(handler)).toEqualTypeOf<ExtendedRoute>()
expectTypeOf(route.trace(handler)).toEqualTypeOf<ExtendedRoute>()
route.all(handler).custom().get((req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end(req.params.id)
}).custom().trace(handler).custom()
