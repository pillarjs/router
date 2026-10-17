import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MatchFunction, ParamData } from 'path-to-regexp'
import RouteModule = require('./lib/route')

declare const Router: Router.RouterConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the callable and constructable CommonJS export.
declare namespace Router {
  type NextFunction = RouteModule.NextFunction
  type Params = ParamData

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
  type RequestParamHandler = (req: Request, res: Response, next: NextFunction, value: any, name: string) => void
  type Handler<P = Params> = RouteModule.Handler<P>
  type HandlerArg<F extends Handler<any> = Handler> = RouteModule.HandlerArg<F>
  type Method = RouteModule.Method
  type Path = RouteModule.Path
  type Route = RouteModule.Route

  interface Layer {
    handle: Handler<any>
    name: string
    keys: string[]
    params: Params | undefined
    path: string | undefined
    slash: boolean
    route?: Route | undefined
    method?: Method | undefined
    matchers: Array<MatchFunction<Params>>
    match(path: string | null | undefined): boolean
    handleRequest(req: Request<any>, res: Response, next: NextFunction): void
    handleError(error: any, req: Request<any>, res: Response, next: NextFunction): void
  }

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

  interface Router {
    (req: IncomingMessage, res: ServerResponse, callback: NextFunction): void

    params: Record<string, RequestParamHandler[] | undefined>
    stack: Layer[]
    caseSensitive: boolean | undefined
    mergeParams: boolean | undefined
    strict: boolean | undefined

    handle(req: IncomingMessage, res: ServerResponse, callback: NextFunction): void
    param(name: string, fn: RequestParamHandler): this
    route(path: Path): Route

    use: RouterMethod<this> & RouteModule.RouteMethod<this>

    all: RouterMethod<this>
    acl: RouterMethod<this>
    bind: RouterMethod<this>
    checkout: RouterMethod<this>
    connect: RouterMethod<this>
    copy: RouterMethod<this>
    delete: RouterMethod<this>
    get: RouterMethod<this>
    head: RouterMethod<this>
    link: RouterMethod<this>
    lock: RouterMethod<this>
    'm-search': RouterMethod<this>
    merge: RouterMethod<this>
    mkactivity: RouterMethod<this>
    mkcalendar: RouterMethod<this>
    mkcol: RouterMethod<this>
    move: RouterMethod<this>
    notify: RouterMethod<this>
    options: RouterMethod<this>
    patch: RouterMethod<this>
    post: RouterMethod<this>
    propfind: RouterMethod<this>
    proppatch: RouterMethod<this>
    purge: RouterMethod<this>
    put: RouterMethod<this>
    query: RouterMethod<this>
    rebind: RouterMethod<this>
    report: RouterMethod<this>
    search: RouterMethod<this>
    source: RouterMethod<this>
    subscribe: RouterMethod<this>
    trace: RouterMethod<this>
    unbind: RouterMethod<this>
    unlink: RouterMethod<this>
    unlock: RouterMethod<this>
    unsubscribe: RouterMethod<this>
  }

  interface RouterConstructor {
    (options?: RouterOptions): Router
    new (options?: RouterOptions): Router
    Route: typeof RouteModule
  }
}

export = Router
