import { expectTypeOf } from 'expect-type'
import Router from '../..'
import Route from '../../lib/route'

const router = Router()
const paths = ['/users/:id', '/accounts/:id'] as const
const mixedPaths: ReadonlyArray<string | RegExp> = ['/users/:id', /^\/accounts\/(\w+)$/]

router.get(paths, (req, res, next) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  expectTypeOf(res).toEqualTypeOf<Router.Response>()
  expectTypeOf(next).toEqualTypeOf<Router.NextFunction>()
  next()
})
router.use(mixedPaths, (req, res, next) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  next()
})

// Inline arrays keep contextual handler types, with or without `as const`.
router.get(['/users/:id', '/accounts/:id'], (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})
router.get(['/users/:id', '/accounts/:id'] as const, (req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
})
router.use(['/users', /^\/accounts/], (req, res, next) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  next()
})

// Explicit parameter types work with readonly and inline arrays.
router.get<{ id: string }>(paths, (req, res) => res.end(req.params.id.toUpperCase()))
router.get<{ id: string }>(['/users/:id', '/accounts/:id'], (req, res) => res.end(req.params.id.toUpperCase()))

const route = router.route(paths)
expectTypeOf(route.path).toEqualTypeOf<typeof paths>()
route.get((req, res) => {
  expectTypeOf(req.params).toEqualTypeOf<Router.Params>()
  res.end()
}).post<{ id: string }>((req, res) => res.end(req.params.id))
expectTypeOf(new Route(paths).path).toEqualTypeOf<typeof paths>()
expectTypeOf(new Router.Route(mixedPaths).path).toEqualTypeOf<typeof mixedPaths>()

// Accepting readonly inputs does not make mutable inputs readonly.
const mutablePaths = ['/users', '/accounts']
expectTypeOf(router.route(mutablePaths).path).toEqualTypeOf<string[]>()
router.route(['/users', '/accounts']).path.push('/teams')
expectTypeOf(new Route(['/users', /^\/accounts/]).path).toEqualTypeOf<Array<string | RegExp>>()

// @ts-expect-error readonly arrays still require valid path elements
router.get(['/users', 42] as const, (req, res) => res.end())
// @ts-expect-error mutable arrays still require valid path elements
router.route(['/users', false])
// @ts-expect-error readonly paths still require valid handlers
router.get(paths, 'invalid')
