import { expectTypeOf } from 'expect-type'
import Router from '../..'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from '../..'

const router = Router()
const route = router.route('/')
const handler: RequestHandler = (req, res, next) => next()
const errorHandler: ErrorRequestHandler = (err, req, res, next) => next(err)

// Normal and error handlers can be interleaved in either order.
expectTypeOf(router.use(handler, errorHandler)).toEqualTypeOf(router)
router.use(errorHandler, handler)
router.use('/', handler, errorHandler, handler)
router.use(['/a', /^\/b/], errorHandler, handler)
expectTypeOf(router.get('/', handler, errorHandler)).toEqualTypeOf(router)
router.get('/', errorHandler, handler)
router.all('/', handler, errorHandler)
router.trace('/', handler, errorHandler)
expectTypeOf(route.get(handler, errorHandler)).toEqualTypeOf(route)
route.get(errorHandler, handler)
route.all(handler, errorHandler)
route.trace(handler, errorHandler)

// Arrays can contain both handler kinds and can be nested and readonly.
const handlers = [handler, [errorHandler, [handler]]] as const
router.use(handler, handlers)
router.use('/', handler, handlers)
router.get('/', handler, handlers)
route.get(handler, handlers)
router.use([errorHandler, [handler]], errorHandler)
router.get('/', [errorHandler, [handler]], errorHandler)
route.get([errorHandler, [handler]], errorHandler)

// Adding mixed overloads preserves contextual types for request handlers.
router.use((req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
}, handler)

router.get('/', (req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  next()
}, handler)

route.get((req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  next()
}, handler)

// Explicit error-handler generics remain supported.
router.use<ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(err).toBeAny()
  expectTypeOf(req).toEqualTypeOf<Request>()
  next(err)
})

route.get<ErrorRequestHandler>((err, req, res, next) => {
  expectTypeOf(err).toBeAny()
  expectTypeOf(req).toEqualTypeOf<Request>()
  next(err)
})

// Mixed overloads still reject invalid paths and handlers.
// @ts-expect-error a number is not a path
router.get(42, handler, errorHandler)
// @ts-expect-error a string is not a handler
router.use(handler, errorHandler, 'invalid')
// @ts-expect-error a nested number is not a handler
router.use('/', handler, [errorHandler, [42]])
// @ts-expect-error a nested string is not a handler
router.get('/', handler, [errorHandler, ['invalid']])
// @ts-expect-error a boolean is not a handler
route.get(handler, errorHandler, false)
