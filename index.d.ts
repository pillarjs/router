import type { IncomingMessage, ServerResponse } from 'node:http'
import type { 
  NextFunction, 
  RequestHandler, 
  Handlers, 
  Route as IRoute 
} from './lib/route'
import Route = require('./lib/route')

export type Path = string | RegExp | Array<string | RegExp>

interface RouterOptions {
  caseSensitive?: boolean
  mergeParams?: boolean
  strict?: boolean
}

interface Router extends RequestHandler {
  params: Record<string, any>
  stack: any[]
  caseSensitive: boolean
  mergeParams: boolean
  strict: boolean

  handle(req: IncomingMessage, res: ServerResponse, callback: NextFunction): void
  param(name: string, fn: (req: any, res: any, next: NextFunction, value: any, name: string) => void): this
  route(path: Path): IRoute

  use(path: Path, ...handlers: Handlers[]): this
  use(...handlers: Handlers[]): this

  all(path: Path, ...handlers: Handlers[]): this
  get(path: Path, ...handlers: Handlers[]): this
  post(path: Path, ...handlers: Handlers[]): this
  put(path: Path, ...handlers: Handlers[]): this
  delete(path: Path, ...handlers: Handlers[]): this
  patch(path: Path, ...handlers: Handlers[]): this
  options(path: Path, ...handlers: Handlers[]): this
  head(path: Path, ...handlers: Handlers[]): this
}

interface RouterConstructor {
  (options?: RouterOptions): Router
  new (options?: RouterOptions): Router
  Route: typeof Route
}

declare const router: RouterConstructor
export = router
