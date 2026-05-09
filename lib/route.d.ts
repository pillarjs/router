import type { IncomingMessage, ServerResponse } from 'node:http'

export type NextFunction = (err?: any) => void
export type RequestHandler = (req: any, res: any, next: NextFunction) => void
export type ErrorRequestHandler = (err: any, req: any, res: any, next: NextFunction) => void
export type Handler = RequestHandler | ErrorRequestHandler
export type Handlers = Handler | Handlers[]

interface Route {
  path: string
  stack: any[]
  methods: Record<string, boolean>

  _handlesMethod(method: string): boolean
  _methods(): string[]
  dispatch(req: IncomingMessage, res: ServerResponse, done: NextFunction): void

  all(...handlers: Handlers[]): this
  get(...handlers: Handlers[]): this
  post(...handlers: Handlers[]): this
  put(...handlers: Handlers[]): this
  delete(...handlers: Handlers[]): this
  patch(...handlers: Handlers[]): this
  options(...handlers: Handlers[]): this
  head(...handlers: Handlers[]): this
}

interface RouteConstructor {
  (path: string): Route
  new (path: string): Route
}

declare const Route: RouteConstructor
export = Route
