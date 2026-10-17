import { expectTypeOf } from 'expect-type'
import Router from '../..'
import type { NextFunction, Request, RequestParamHandler, Response } from '../..'

const router = Router()
const loadUser: RequestParamHandler = (req, res, next, value, name) => {
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
  expectTypeOf(value).toBeAny()
  expectTypeOf(name).toBeString()
  next()
}

expectTypeOf(router.param('id', loadUser)).toEqualTypeOf<Router.Router>()
router.param('id', async (req, res, next, value, name) => {
  expectTypeOf(name).toBeString()
  await Promise.resolve(value)
  next()
})

// @ts-expect-error parameter names must be strings
router.param(42, loadUser)
// @ts-expect-error callbacks must be functions
router.param('id', 'invalid')
