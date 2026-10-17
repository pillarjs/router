import { expectTypeOf } from 'expect-type'
import Router from '..'
import type { ErrorRequestHandler, Method, NextFunction, Path, Request, RequestHandler, Response } from '..'

const router = Router()

const handler: RequestHandler = (req, res, next) => next()
const other: RequestHandler = (req, res, next) => next()

// handler parameters are inferred
router.get('/', function (req, res) {
  expectTypeOf(req).toEqualTypeOf<Request<{}>>()
  expectTypeOf(res).toEqualTypeOf<Response>()
})

router.get('/', function (req, res, next) {
  expectTypeOf(req).toEqualTypeOf<Request<{}>>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toBeFunction()
})

// typescript has no way to infer the types automatically
router.get<ErrorRequestHandler>('/', function (err, req, res, next) {
  expectTypeOf(err).toBeAny()
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toBeFunction()
})

// methods accept multiple handlers and nested arrays (flattened at runtime)
router.get('/', handler, other)
router.get('/', [handler, other])
router.get('/', [handler, [other]], handler)

// at least one handler is required (runtime throws TypeError)
// @ts-expect-error at least one handler is required
router.get('/')
// handlers must be functions or arrays of them
// @ts-expect-error a string is not a handler
router.get('/', 'not-a-handler')

// paths may be a string, RegExp, or array of either
router.get(/^\/x/, handler)
router.get(['/a', /^\/b/], handler)
// @ts-expect-error a number is not a path
router.get(42, handler)

// use: with or without path, multiple handlers, arrays
router.use(handler)
router.use(handler, other)
router.use([handler, [other]])
router.use('/a', handler, [other], handler)
router.use(['/a', '/b'], handler)
router.use(/^\/c/, handler)
// @ts-expect-error path without any handler (runtime throws TypeError)
router.use('/x')
// @ts-expect-error at least one handler is required
router.use()

// verb methods and use return the router for chaining
expectTypeOf(router.get('/', handler)).toEqualTypeOf(router)
router.use(handler).use('/a', other).get('/', handler)

// one method per node:http METHODS entry, not just the classic 8
router.trace('/', handler)
router.search('/', handler)
router.propfind('/', handler)
router['m-search']('/', handler)
// @ts-expect-error not an HTTP method
router.foo('/', handler)

// error handlers are distinguished by the explicit generic
router.use<ErrorRequestHandler>(function (err, req, res, next) {
  expectTypeOf(err).toBeAny()
  next(err)
})

// param callbacks receive typed req/res
router.param('id', function (req, res, next, value, name) {
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
  expectTypeOf(name).toBeString()
})

// router is itself a request handler (mountable in a server or another router)
expectTypeOf(router).toExtend<RequestHandler>()
router.use(Router())

// the instance, options, and helper types are nameable by consumers
const mounted: Router.Router = Router({ strict: true, caseSensitive: true, mergeParams: true })
mounted.use(handler)
const opts: Router.RouterOptions = { strict: true }
Router(opts)
expectTypeOf(new Router(opts)).toEqualTypeOf<Router.Router>()
// @ts-expect-error unknown options are rejected
Router({ nope: true })
expectTypeOf<Method>().toExtend<string>()
expectTypeOf<string | RegExp | ReadonlyArray<string | RegExp>>().toExtend<Path>()

// routes: all verbs, multiple handlers, chaining
const route = router.route('/things/:id')
expectTypeOf(route.path).toEqualTypeOf<'/things/:id'>()
route.all(handler).get(handler, other).post([handler, [other]])
route.checkout(handler)
route['m-search'](handler)
// @ts-expect-error at least one handler is required
route.put()

// Route must be constructed with new, and accepts any Path
expectTypeOf(new Router.Route('/x')).toEqualTypeOf<Router.Route<'/x'>>()
expectTypeOf(new Router.Route(/^\/x/)).toEqualTypeOf<Router.Route<RegExp>>()
expectTypeOf(new Router.Route(['/a', /^\/b/])).toEqualTypeOf<Router.Route<Array<string | RegExp>>>()
// @ts-expect-error calling without new does not construct (strict mode)
Router.Route('/x')
// @ts-expect-error a number is not a path
expectTypeOf(new Router.Route(42)).toEqualTypeOf<Router.Route>()
