import type { IncomingMessage, ServerResponse } from 'node:http'

export type NextFunction = (err?: any) => void

export type RequestHandler = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void
export type ErrorRequestHandler = (err: Error, req: IncomingMessage, res: ServerResponse, next: NextFunction) => void

export type Handler = RequestHandler | ErrorRequestHandler

export type HandlerArg<F extends Handler = Handler> = F | ReadonlyArray<HandlerArg<F>>

export type RouteMethod<T> = <F extends Handler = RequestHandler>(handler: HandlerArg<F>, ...handlers: Array<HandlerArg<F>>) => T


export type Method =
  | 'acl' | 'bind' | 'checkout' | 'connect' | 'copy' | 'delete' | 'get'
  | 'head' | 'link' | 'lock' | 'm-search' | 'merge' | 'mkactivity'
  | 'mkcalendar' | 'mkcol' | 'move' | 'notify' | 'options' | 'patch'
  | 'post' | 'propfind' | 'proppatch' | 'purge' | 'put' | 'query'
  | 'rebind' | 'report' | 'search' | 'source' | 'subscribe' | 'trace'
  | 'unbind' | 'unlink' | 'unlock' | 'unsubscribe'

export type MethodHandlers<T> = { [M in Method | 'all']: RouteMethod<T> }

export interface Route extends MethodHandlers<Route> {
  path: string
  stack: any[]
  methods: Record<string, boolean>

  _handlesMethod(method: string): boolean
  _methods(): string[]
  dispatch(req: IncomingMessage, res: ServerResponse, done: NextFunction): void
}

interface RouteConstructor {
  new (path: Path): Route
}

declare const Route: RouteConstructor
export = Route
