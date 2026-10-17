import type { IncomingMessage, ServerResponse } from 'node:http'
import { expectTypeOf } from 'expect-type'
import Router, { Route } from '../../index.js'
import type { NextFunction, RequestHandler, RouterOptions } from '../../index.js'

const options: RouterOptions = { strict: true }
const router = Router(options)

router.get('/', (req, res, next) => {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>()
  expectTypeOf(res).toEqualTypeOf<ServerResponse>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
})

expectTypeOf(router).toExtend<RequestHandler>()
expectTypeOf(new Router(options)).toEqualTypeOf<Router.Router>()
expectTypeOf(Route).toEqualTypeOf(Router.Route)
expectTypeOf(new Route('/')).toEqualTypeOf<Router.Route>()
