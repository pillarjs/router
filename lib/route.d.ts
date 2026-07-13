import type { IncomingMessage, ServerResponse } from 'node:http'

export type NextFunction = (err?: any) => void

export type RequestHandler = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void
export type ErrorRequestHandler = (err: Error, req: IncomingMessage, res: ServerResponse, next: NextFunction) => void

export type Handler = RequestHandler | ErrorRequestHandler

export type RouteMethod<T> = <F extends Handler = RequestHandler>(handler: F) => T

export interface Route {
  path: string
  stack: any[]
  methods: Record<string, boolean>

  _handlesMethod(method: string): boolean
  _methods(): string[]
  dispatch(req: IncomingMessage, res: ServerResponse, done: NextFunction): void

  all: RouteMethod<this>
  get: RouteMethod<this>
  post: RouteMethod<this>
  put: RouteMethod<this>
  delete: RouteMethod<this>
  patch: RouteMethod<this>
  options: RouteMethod<this>
  head: RouteMethod<this>
}

interface RouteConstructor {
  (path: string): Route
  new (path: string): Route
}

declare const Route: RouteConstructor
export = Route
