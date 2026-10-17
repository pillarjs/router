import type { IncomingMessage, ServerResponse } from 'node:http'
import RouteModule = require('./lib/route')

declare const Router: Router.RouterConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the callable and constructable CommonJS export.
declare namespace Router {
  type NextFunction = RouteModule.NextFunction
  type Params = Record<string, string | string[] | undefined>

  /** Can be augmented to describe properties added by middleware. */
  interface Request<P = Params> extends IncomingMessage {
    params: P
    baseUrl: string
    originalUrl: string
    route?: Route
    next?: NextFunction
  }

  /** Can be augmented to describe properties and methods added by middleware. */
  interface Response extends ServerResponse {}

  type RequestHandler<P = Params> = RouteModule.RequestHandler<P>
  type ErrorRequestHandler<P = Params> = RouteModule.ErrorRequestHandler<P>
  type Handler<P = Params> = RouteModule.Handler<P>
  type HandlerArg<F extends Handler<any> = Handler> = RouteModule.HandlerArg<F>
  type Method = RouteModule.Method
  type Path = RouteModule.Path
  type Route = RouteModule.Route

  type RouterMethod<T> = {
    <F extends Handler<any> = RequestHandler>(path: Path, handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): T
    <P = Params>(path: Path, handler: HandlerArg<RequestHandler<P>>, ...handlers: Array<HandlerArg<RequestHandler<P>>>): T
    <P = Params>(path: Path, handler: HandlerArg<Handler<P>>, ...handlers: Array<HandlerArg<Handler<P>>>): T
  }

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
    param(name: string, fn: (req: Request, res: Response, next: NextFunction, value: any, name: string) => void): this
    route(path: Path): Route

    use: RouterMethod<Router> & RouteModule.RouteMethod<Router>

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
