import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  Handler,
  NextFunction,
  RequestHandler,
  Route as IRoute
} from './lib/route'
import Route = require('./lib/route')

export type RouterMethod<T> = <F extends Handler = RequestHandler>(path: Path, handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>) => T


export type Path = string | RegExp | Array<string | RegExp>

export interface RouterOptions {
  caseSensitive?: boolean
  mergeParams?: boolean
  strict?: boolean
}

type MethodHandlers<T> = { [M in Method | 'all']: RouterMethod<T> }

export interface Router extends RequestHandler, MethodHandlers<Router> {
  params: Record<string, any>
  stack: any[]
  caseSensitive: boolean
  mergeParams: boolean
  strict: boolean

  handle(req: IncomingMessage, res: ServerResponse, callback: NextFunction): void
  param(name: string, fn: (req: any, res: any, next: NextFunction, value: any, name: string) => void): this
  route(path: Path): IRoute

  use: {
   <F extends Handler = RequestHandler>(path: Path, handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): Router
    <F extends Handler = RequestHandler>(handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): Router
  }

  all: RouterMethod<this>
  get: RouterMethod<this>
  post: RouterMethod<this>
  put: RouterMethod<this>
  delete: RouterMethod<this>
  patch: RouterMethod<this>
  options: RouterMethod<this>
  head: RouterMethod<this>
}

interface RouterConstructor {
  (options?: RouterOptions): Router
  new (options?: RouterOptions): Router
  Route: typeof Route
}

declare const router: RouterConstructor
export = router
