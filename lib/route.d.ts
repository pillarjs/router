import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Params as RouterParams, Request as RouterRequest, Response as RouterResponse } from '../index'

declare const Route: Route.RouteConstructor

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Merge types with the CommonJS constructor export.
declare namespace Route {
  type NextFunction = (err?: any) => void

  type Params = RouterParams
  type Request<P = Params> = RouterRequest<P>
  type Response = RouterResponse

  type RequestHandler<P = Params> = (req: Request<P>, res: Response, next: NextFunction) => void
  type ErrorRequestHandler<P = Params> = (err: any, req: Request<P>, res: Response, next: NextFunction) => void

  type Handler<P = Params> = RequestHandler<P> | ErrorRequestHandler<P>
  type HandlerArg<F extends Handler<any> = Handler> = F | ReadonlyArray<HandlerArg<F>>

  type Path = string | RegExp | Array<string | RegExp>
  type RouteMethod<T> = {
    <F extends Handler<any> = RequestHandler>(handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>): T
    <P = Params>(handler: HandlerArg<RequestHandler<P>>, ...handlers: Array<HandlerArg<RequestHandler<P>>>): T
    <P = Params>(handler: HandlerArg<Handler<P>>, ...handlers: Array<HandlerArg<Handler<P>>>): T
  }

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
