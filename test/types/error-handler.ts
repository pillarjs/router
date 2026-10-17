import { expectTypeOf } from 'expect-type'
import type { ErrorRequestHandler, NextFunction, Request, Response } from '../..'

declare const req: Request
declare const res: Response
declare const next: NextFunction

const handler: ErrorRequestHandler = (err, req, res, next) => {
  expectTypeOf(err).toBeAny()
  expectTypeOf(req).toEqualTypeOf<Request>()
  expectTypeOf(res).toEqualTypeOf<Response>()
  expectTypeOf(next).toEqualTypeOf<NextFunction>()
  next(err)
}

// Error handlers can receive values other than Error instances.
handler(new Error('failure'), req, res, next)
handler('failure', req, res, next)
handler({ status: 400, message: 'invalid input' }, req, res, next)
