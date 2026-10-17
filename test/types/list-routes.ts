import { expectTypeOf } from 'expect-type'
import type { IncomingMessage, ServerResponse } from 'node:http'
import Router from '../..'
import type { MountedRouter, RouteInfo } from '../..'
import Route from '../../lib/route'

const router = Router()
const nested = Router()
router.use('/api', nested)
router.route('/draft')
router.all('/all', (req, res) => res.end())

expectTypeOf(router.listRoutes()).toEqualTypeOf<RouteInfo[]>()
expectTypeOf<Router.Router>().toExtend<MountedRouter>()

router.listRoutes().forEach(entry => {
  expectTypeOf(entry.path).toEqualTypeOf<string | RegExp>()
  expectTypeOf(entry.methods).toEqualTypeOf<string[] | undefined>()
  expectTypeOf(entry.router).toEqualTypeOf<MountedRouter | undefined>()

  if (entry.router) {
    expectTypeOf(entry.methods).toBeUndefined()
    expectTypeOf(entry.router.listRoutes?.()).toEqualTypeOf<RouteInfo[] | undefined>()
    // @ts-expect-error older routers may not implement listRoutes
    entry.router.listRoutes()
  } else {
    expectTypeOf(entry.methods).toEqualTypeOf<string[]>()
    entry.methods.push('*', 'GET', 'HEAD')
  }

  if (entry.methods === undefined) {
    expectTypeOf(entry.router).toEqualTypeOf<MountedRouter>()
  } else {
    expectTypeOf(entry.router).toBeUndefined()
  }
})

// Legacy mounted routers need only a callable handler and a stack.
const legacy = Object.assign((req: IncomingMessage, res: ServerResponse, next: Router.NextFunction) => next(), { stack: [] })
router.use('/legacy', legacy)
const legacyEntry: RouteInfo = { path: '/legacy', methods: undefined, router: legacy }
const emptyRoute: RouteInfo = { path: '/draft', methods: [], router: undefined }
expectTypeOf(legacyEntry.router).toExtend<MountedRouter>()
expectTypeOf(emptyRoute.methods).toEqualTypeOf<string[]>()

// @ts-expect-error a mounted router has undefined methods
router.listRoutes().push({ path: '/api', methods: ['GET'], router: nested })
// @ts-expect-error an ordinary route has a methods array, even when empty
router.listRoutes().push({ path: '/draft', methods: undefined, router: undefined })
// @ts-expect-error listed paths are flattened, not arrays
router.listRoutes().push({ path: ['/a', '/b'], methods: ['GET'], router: undefined })

const route = new Route('/all')
expectTypeOf(route._methods()).toEqualTypeOf<string[]>()
expectTypeOf(route._methods(true)).toEqualTypeOf<string[]>()
expectTypeOf(route._methods(false)).toEqualTypeOf<string[]>()
// @ts-expect-error includeAll must be a boolean
route._methods('all')

// Nested string arrays are supported at registration, including readonly tuples.
const paths = ['/users/:id', ['/accounts/:id', ['/legacy/:id']], /^\/old/] as const
router.get(paths, (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})
router.use(['/api', ['/v1', '/v2']], nested)
expectTypeOf(router.route(paths).path).toEqualTypeOf<typeof paths>()
new Router.Route(paths).get<{ id: string }>((req, res) => res.end(req.params.id))
// @ts-expect-error nested arrays still require valid path elements
router.route(['/users', ['/accounts', 42]])
// @ts-expect-error RegExp paths are only supported at the top array level
router.route(['/users', [/^\/accounts/]])
