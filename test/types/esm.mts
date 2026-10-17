import { expectTypeOf } from 'expect-type'
import Router, { Route } from '../../index.js'
import type { NextFunction, Request, RequestHandler, Response, RouterOptions } from '../../index.js'

const options: RouterOptions = { strict: true }
const router = Router(options)

router.get('/', (req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<Request<{}>>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
})

expectTypeOf(router).toExtend<RequestHandler>()
expectTypeOf(new Router(options)).toEqualTypeOf<Router.Router>()
expectTypeOf(Route).toEqualTypeOf(Router.Route)
expectTypeOf(new Route('/')).toEqualTypeOf<Router.Route<'/'>>()

router.get<{ id: string }>('/users/:id', (req, res) => {
  expectTypeOf(req).toEqualTypeOf<Request<{ id: string }>>()
  res.end(req.params.id)
})

new Route('/users/:id').get((req, res) => {
  expectTypeOf(req.params.id).toBeString()
  res.end(req.params.id)
})
