import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Layer as RouterLayer, Params as RouterParams, Request as RouterRequest, Response as RouterResponse } from '../index'

declare const Route: Route.RouteConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the CommonJS constructor export.
declare namespace Route {
  /**
   * Call `next()` to continue to the next handler.
   * In a route handler, `next('route')` skips the remaining handlers of that route.
   * `next('router')` exits the current router and invokes its completion callback.
   * Other truthy arguments enter error handling; falsy arguments continue normally.
   */
  type NextFunction = (err?: any) => void

  type Params = RouterParams
  type Request<P = Params> = RouterRequest<P>
  type Response = RouterResponse
  type Layer = RouterLayer

  type RequestHandler<P = Params> = (req: Request<P>, res: Response, next: NextFunction) => unknown
  type ErrorRequestHandler<P = Params> = (err: any, req: Request<P>, res: Response, next: NextFunction) => unknown

  type Handler<P = Params> = RequestHandler<P> | ErrorRequestHandler<P>
  type HandlerArg<F extends Handler<any> = Handler> = F | ReadonlyArray<HandlerArg<F>>

  type Path = string | RegExp | Array<string | RegExp>

  // Follow the route parameter inference used by @types/express-serve-static-core.
  type RemoveTail<S extends string, Tail extends string> = S extends `${infer P}${Tail}` ? P : S
  type GetRouteParameter<S extends string> = RemoveTail<RemoveTail<RemoveTail<S, `/${string}`>, `-${string}`>, `.${string}`>

  type RouteParameters<R extends Path> = R extends string
    ? R extends `${infer Required}{${infer Optional}}${infer Next}`
      ? ParseRouteParameters<Required> & Partial<ParseRouteParameters<Optional>> & RouteParameters<Next>
      : ParseRouteParameters<R>
    : Params

  type ParseRouteParameters<R extends string> = string extends R ? Params
    : R extends `${string}:${infer Rest}`
      ? (GetRouteParameter<Rest> extends never ? Params : { [P in GetRouteParameter<Rest>]: string })
        & (Rest extends `${GetRouteParameter<Rest>}${infer Next}` ? RouteParameters<Next> : unknown)
      : R extends `${string}*${infer Rest}`
        ? (GetRouteParameter<Rest> extends never ? Params : { [P in GetRouteParameter<Rest>]: string[] })
          & (Rest extends `${GetRouteParameter<Rest>}${infer Next}` ? RouteParameters<Next> : unknown)
        : {}

  type RouteMethod<T, DefaultParams = Params> = {
    <F extends Handler<any> = RequestHandler<DefaultParams>>(handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): T
    <P = DefaultParams>(handler: HandlerArg<RequestHandler<P>>, ...handlers: Array<HandlerArg<RequestHandler<P>>>): T
    <P = DefaultParams>(handler: HandlerArg<Handler<P>>, ...handlers: Array<HandlerArg<Handler<P>>>): T
  }

  type Method =
    | 'acl' | 'bind' | 'checkout' | 'connect' | 'copy' | 'delete' | 'get'
    | 'head' | 'link' | 'lock' | 'm-search' | 'merge' | 'mkactivity'
    | 'mkcalendar' | 'mkcol' | 'move' | 'notify' | 'options' | 'patch'
    | 'post' | 'propfind' | 'proppatch' | 'purge' | 'put' | 'query'
    | 'rebind' | 'report' | 'search' | 'source' | 'subscribe' | 'trace'
    | 'unbind' | 'unlink' | 'unlock' | 'unsubscribe'

  type MethodHandlers<T> = { [M in Method | 'all']: RouteMethod<T> }

  interface Route<R extends Path = Path> {
    path: R
    stack: Layer[]
    methods: Record<string, boolean>

    _handlesMethod(method: string): boolean
    _methods(): string[]
    dispatch(req: IncomingMessage, res: ServerResponse, done: NextFunction): void

    all: RouteMethod<this, RouteParameters<R>>
    acl: RouteMethod<this, RouteParameters<R>>
    bind: RouteMethod<this, RouteParameters<R>>
    checkout: RouteMethod<this, RouteParameters<R>>
    connect: RouteMethod<this, RouteParameters<R>>
    copy: RouteMethod<this, RouteParameters<R>>
    delete: RouteMethod<this, RouteParameters<R>>
    get: RouteMethod<this, RouteParameters<R>>
    head: RouteMethod<this, RouteParameters<R>>
    link: RouteMethod<this, RouteParameters<R>>
    lock: RouteMethod<this, RouteParameters<R>>
    'm-search': RouteMethod<this, RouteParameters<R>>
    merge: RouteMethod<this, RouteParameters<R>>
    mkactivity: RouteMethod<this, RouteParameters<R>>
    mkcalendar: RouteMethod<this, RouteParameters<R>>
    mkcol: RouteMethod<this, RouteParameters<R>>
    move: RouteMethod<this, RouteParameters<R>>
    notify: RouteMethod<this, RouteParameters<R>>
    options: RouteMethod<this, RouteParameters<R>>
    patch: RouteMethod<this, RouteParameters<R>>
    post: RouteMethod<this, RouteParameters<R>>
    propfind: RouteMethod<this, RouteParameters<R>>
    proppatch: RouteMethod<this, RouteParameters<R>>
    purge: RouteMethod<this, RouteParameters<R>>
    put: RouteMethod<this, RouteParameters<R>>
    query: RouteMethod<this, RouteParameters<R>>
    rebind: RouteMethod<this, RouteParameters<R>>
    report: RouteMethod<this, RouteParameters<R>>
    search: RouteMethod<this, RouteParameters<R>>
    source: RouteMethod<this, RouteParameters<R>>
    subscribe: RouteMethod<this, RouteParameters<R>>
    trace: RouteMethod<this, RouteParameters<R>>
    unbind: RouteMethod<this, RouteParameters<R>>
    unlink: RouteMethod<this, RouteParameters<R>>
    unlock: RouteMethod<this, RouteParameters<R>>
    unsubscribe: RouteMethod<this, RouteParameters<R>>
  }

  interface RouteConstructor {
    new <R extends Path>(path: R): Route<R>
  }
}

export = Route
