import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MatchFunction } from 'path-to-regexp'
import RouteModule = require('./lib/route')

declare const Router: Router.RouterConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the callable and constructable CommonJS export.
declare namespace Router {
  /**
   * Continues dispatch, forwards an error, or skips the current route or router.
   * Use `next('route')` to skip a route and `next('router')` to exit the router.
   */
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
  /**
   * Processes a matched path parameter before the layer's handlers run.
   * Call `next()` to continue, or respond to the request.
   * Rejected promises are forwarded as errors; resolved promises do not call `next()`.
   *
   * @param value The matched parameter value.
   * @param name The parameter name supplied to `router.param()`.
   */
  type RequestParamHandler = (req: Request, res: Response, next: NextFunction, value: any, name: string) => void
  type Handler<P = Params> = RouteModule.Handler<P>
  type HandlerArg<F extends Handler<any> = Handler> = RouteModule.HandlerArg<F>
  type Method = RouteModule.Method
  type Path = RouteModule.Path
  type Route<R extends Path = Path> = RouteModule.Route<R>
  type RouteParameters<R extends Path> = RouteModule.RouteParameters<R>

  /** A mounted router may come from a version without route introspection. */
  interface MountedRouter {
    (req: IncomingMessage, res: ServerResponse, next: NextFunction): unknown
    stack: unknown[]
    listRoutes?(): RouteInfo[]
  }

  /** One registered path, with either route methods or a mounted router. */
  type RouteInfo = {
    path: string | RegExp
  } & ({
    /** Uppercase methods and `'*'` for `.all()`, or an empty array for a route without handlers. */
    methods: string[]
    router: undefined
  } | {
    methods: undefined
    router: MountedRouter
  })

  interface Layer {
    handle: Handler<any>
    name: string
    keys: string[]
    params: Params | undefined
    path: string | undefined
    /** The registered path, with path arrays flattened and copied at registration. */
    rawPath: string | RegExp | Array<string | RegExp>
    slash: boolean
    route?: Route | undefined
    method?: Method | undefined
    matchers: Array<MatchFunction<Params>>
    match(path: string | null | undefined): boolean
    handleRequest(req: Request<any>, res: Response, next: NextFunction): void
    handleError(error: any, req: Request<any>, res: Response, next: NextFunction): void
  }

  type RouterMethod<T> = {
    <R extends string | RegExp, P = RouteParameters<R>>(path: R, handler: HandlerArg<RequestHandler<P>>, ...handlers: Array<HandlerArg<RequestHandler<P>>>): T
    <R extends string | RegExp, P = RouteParameters<R>>(path: R, handler: HandlerArg<Handler<P>>, ...handlers: Array<HandlerArg<Handler<P>>>): T
    <F extends Handler<any> = RequestHandler>(path: Path, handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): T
    <P = Params>(path: Path, handler: HandlerArg<RequestHandler<P>>, ...handlers: Array<HandlerArg<RequestHandler<P>>>): T
    <P = Params>(path: Path, handler: HandlerArg<Handler<P>>, ...handlers: Array<HandlerArg<Handler<P>>>): T
  }

  interface RouterOptions {
    caseSensitive?: boolean
    /**
     * Preserve parent `req.params` when matching this router's layers.
     * This router's named parameters take precedence over parent parameters.
     * Parent parameter names are not inferred from the child route's path;
     * include them in an explicit parameter type when needed.
     * @default false
     */
    mergeParams?: boolean
    strict?: boolean
  }

  type MethodHandlers<T> = { [M in Method | 'all']: RouterMethod<T> }

  interface Router {
    (req: IncomingMessage, res: ServerResponse, callback: NextFunction): void

    params: Record<string, any>
    stack: Layer[]
    caseSensitive: boolean | undefined
    /** Whether to preserve parent `req.params`. Disabled when false or undefined. */
    mergeParams: boolean | undefined
    strict: boolean | undefined

    handle(req: IncomingMessage, res: ServerResponse, callback: NextFunction): void
    /**
     * Register a callback for a named path parameter on this router.
     * Callbacks run in registration order before the matching layer's handlers.
     * They are local to this router and are not inherited by mounted routers.
     *
     * @param name The parameter name, without the `:` or `*` prefix.
     * @param fn Receives `(req, res, next, value, name)`.
     * @returns This router for chaining.
     */
    param(name: string, fn: RequestParamHandler): this
    route<R extends Path>(path: R): Route<R>

    /**
     * List routes and mounted routers in registration order, one entry per path.
     * Methods include `'*'` for `.all()` and implicit `HEAD` for `GET` routes.
     * Plain middleware is omitted; mounted routers are not traversed recursively.
     */
    listRoutes(): RouteInfo[]

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
