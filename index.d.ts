import type { IncomingMessage, ServerResponse } from 'node:http'
import RouteModule = require('./lib/route')

declare const Router: Router.RouterConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the callable and constructable CommonJS export.
declare namespace Router {
  type NextFunction = RouteModule.NextFunction
  type Request = RouteModule.Request
  type RequestHandler = RouteModule.RequestHandler
  type ErrorRequestHandler = RouteModule.ErrorRequestHandler
  type Handler = RouteModule.Handler
  type HandlerArg<F extends Handler = Handler> = RouteModule.HandlerArg<F>
  type Method = RouteModule.Method
  type Path = RouteModule.Path
  type Route = RouteModule.Route

  type RouterMethod<T> = <F extends Handler = RequestHandler>(path: Path, handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>) => T

  interface RouterOptions {
    caseSensitive?: boolean
    mergeParams?: boolean
    strict?: boolean
  }

  type MethodHandlers<T> = { [M in Method | 'all']: RouterMethod<T> }

  interface Router extends MethodHandlers<Router> {
    (req: IncomingMessage, res: ServerResponse, callback: NextFunction): void

    params: Record<string, any>
    stack: any[]
    caseSensitive: boolean | undefined
    mergeParams: boolean | undefined
    strict: boolean | undefined

    handle(req: IncomingMessage, res: ServerResponse, callback: NextFunction): void
    param(name: string, fn: (req: Request, res: ServerResponse, next: NextFunction, value: any, name: string) => void): this
    route(path: Path): Route

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
    Route: typeof RouteModule
  }
}

export = Router
