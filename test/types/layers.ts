import { expectTypeOf } from 'expect-type'
import type { MatchFunction } from 'path-to-regexp'
import Router from '../..'
import type Route from '../../lib/route'

const router = Router()
const route = router.route('/users/:id')

expectTypeOf(router.stack).toEqualTypeOf<Router.Layer[]>()
expectTypeOf(route.stack).toEqualTypeOf<Router.Layer[]>()
expectTypeOf<Route.Layer>().toEqualTypeOf<Router.Layer>()

router.stack.forEach(layer => {
  expectTypeOf(layer.name).toBeString()
  expectTypeOf(layer.rawPath).toEqualTypeOf<string | RegExp | Array<string | RegExp>>()
  expectTypeOf(layer.method).toEqualTypeOf<Router.Method | undefined>()
  expectTypeOf(layer.route).toEqualTypeOf<Router.Route | undefined>()
  expectTypeOf(layer.handle).toEqualTypeOf<Router.Handler<any>>()
  expectTypeOf(layer.slash).toBeBoolean()
  expectTypeOf(layer.matchers).toEqualTypeOf<Array<MatchFunction<Router.Params>>>()
  const result = layer.match('/users/123')
  expectTypeOf(result).toEqualTypeOf<Router.LayerMatch | false>()
  if (result) {
    expectTypeOf(result.params).toEqualTypeOf<Router.Params>()
    expectTypeOf(result.path).toBeString()
    expectTypeOf(result.keys).toEqualTypeOf<string[]>()
    expectTypeOf(result.pattern).toEqualTypeOf<string | RegExp>()
  }
  // @ts-expect-error matched params belong to the result, not the shared layer
  expectTypeOf(layer.params)
  // @ts-expect-error the concrete matched path belongs to the result
  expectTypeOf(layer.path)
  // @ts-expect-error parameter keys belong to the result
  expectTypeOf(layer.keys)
  layer.match(null)
  layer.match(undefined)
  layer.matchers.forEach(match => {
    const result = match('/users/123')
    if (result) {
      expectTypeOf(result.path).toBeString()
      expectTypeOf(result.params).toEqualTypeOf<Router.Params>()
    }
  })
  if (layer.route) {
    expectTypeOf(layer.route.path).toEqualTypeOf<Router.Path>()
  }
  // @ts-expect-error the current implementation uses matchers, not a regexp property
  layer.regexp.test('/users/123')
  // @ts-expect-error method names are typed
  layer.method = 'invalid'
})

router.get('/users/:id', (req, res, next) => {
  router.stack.forEach(layer => {
    layer.handleRequest(req, res, next)
    layer.handleError('failure', req, res, next)
  })
})
// @ts-expect-error a layer must include its fields and methods
router.stack.push({ name: 'incomplete' })
