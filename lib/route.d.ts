import type { IncomingMessage, ServerResponse } from 'node:http'

declare const Route: Route.RouteConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the CommonJS constructor export.
declare namespace Route {
  type NextFunction = (err?: any) => void

  type RequestHandler = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void
  type ErrorRequestHandler = (err: Error, req: IncomingMessage, res: ServerResponse, next: NextFunction) => void

  type Handler = RequestHandler | ErrorRequestHandler
  type HandlerArg<F extends Handler = Handler> = F | ReadonlyArray<HandlerArg<F>>

  type Path = string | RegExp | Array<string | RegExp>
  type RouteMethod<T> = <F extends Handler = RequestHandler>(handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>) => T

  type Method =
    | 'acl' | 'bind' | 'checkout' | 'connect' | 'copy' | 'delete' | 'get'
    | 'head' | 'link' | 'lock' | 'm-search' | 'merge' | 'mkactivity'
    | 'mkcalendar' | 'mkcol' | 'move' | 'notify' | 'options' | 'patch'
    | 'post' | 'propfind' | 'proppatch' | 'purge' | 'put' | 'query'
    | 'rebind' | 'report' | 'search' | 'source' | 'subscribe' | 'trace'
    | 'unbind' | 'unlink' | 'unlock' | 'unsubscribe'

  type MethodHandlers<T> = { [M in Method | 'all']: RouteMethod<T> }

  interface Route extends MethodHandlers<Route> {
    path: Path
    stack: any[]
    methods: Record<string, boolean>

    _handlesMethod(method: string): boolean
    _methods(): string[]
    dispatch(req: IncomingMessage, res: ServerResponse, done: NextFunction): void
  }

  interface RouteConstructor {
    new (path: Path): Route
  }
}

export = Route
