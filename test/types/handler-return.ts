import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

const router = Router()

expectTypeOf<ReturnType<Router.RequestHandler>>().toBeUnknown()
expectTypeOf<ReturnType<Router.ErrorRequestHandler>>().toBeUnknown()
expectTypeOf<ReturnType<Route.RequestHandler>>().toBeUnknown()
expectTypeOf<ReturnType<Route.ErrorRequestHandler>>().toBeUnknown()

const handler: Router.RequestHandler = (req, res) => res.end()
const asyncHandler: Router.RequestHandler = async (req, res) => {
  await Promise.resolve()
  return res.end()
}
const errorHandler: Router.ErrorRequestHandler = (err, req, res) => res.end(String(err))
const asyncErrorHandler: Router.ErrorRequestHandler = async (err, req, res, next) => {
  await Promise.resolve()
  return next(err)
}

router.use(handler, asyncHandler, errorHandler, asyncErrorHandler)
router.get('/', handler, asyncHandler, errorHandler, asyncErrorHandler)
new Route('/').all(handler, asyncHandler, errorHandler, asyncErrorHandler)

router.get('/users/:id', async (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  const id = await Promise.resolve(req.params.id)
  return res.end(id)
})

router.route('/users/:id').get(async (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  return res.end(await Promise.resolve(req.params.id))
}).post((req, res) => res.end(req.params.id))

router.use<Router.ErrorRequestHandler>(async (err, req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Router.Request>()
  expectTypeOf(res).toEqualTypeOf<Router.Response>()
  expectTypeOf(next).toEqualTypeOf<Router.NextFunction>()
  return Promise.reject(err)
})

router.get<{ id: string }>('/users/:id', async (req, res) => {
  expectTypeOf(req.params.id).toBeString()
  // @ts-expect-error asynchronous handlers still check parameter types
  req.params.id = 123
  return res.end(req.params.id)
})
