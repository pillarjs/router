import Methods from "methods";
import { OutgoingMessage } from "http";

export default Router;

type Method = typeof Methods[number];

type LowercaseMethods = Lowercase<Method>;

export interface RouterOptions {
  strict?: boolean;
  caseSensitive?: boolean;
  mergeParams?: boolean;
}

export interface IncomingRequest {
  url?: string;
  method?: string;
  originalUrl?: string;
  params?: Record<string, unknown>;
}

export interface RoutedRequest extends IncomingRequest {
  baseUrl: string;
  next?: NextFunction;
  route?: IRoute;
}

export interface NextFunction {
  (err?: any): void;
}

type IRoute = Record<LowercaseMethods, IRouterHandler<IRoute>> & {
  path: string;
  stack: any;
  all: IRouterHandler<IRoute>;
}

type RequestParamHandler = (
  req: IncomingRequest,
  res: OutgoingMessage,
  next: NextFunction,
  value: any,
  name: string
) => any;

export interface RouteHandler {
  (req: RoutedRequest, res: OutgoingMessage, next: NextFunction): any;
}

export interface RequestHandler {
  (req: IncomingRequest, res: OutgoingMessage, next: NextFunction): any;
}

type ErrorRequestHandler = (
  err: any,
  req: IncomingRequest,
  res: any,
  next: NextFunction
) => any;

type PathParams = string | RegExp | Array<string | RegExp>;

type RequestHandlerParams =
  | RouteHandler
  | ErrorRequestHandler
  | Array<RouteHandler | ErrorRequestHandler>;

interface IRouterMatcher<T> {
  (path: PathParams, ...handlers: RouteHandler[]): T;
  (path: PathParams, ...handlers: RequestHandlerParams[]): T;
}

interface IRouterHandler<T> {
  (...handlers: RouteHandler[]): T;
  (...handlers: RequestHandlerParams[]): T;
}

type IRouter = Record<LowercaseMethods, IRouterMatcher<IRouter>> & {
  param(name: string, handler: RequestParamHandler): IRouter;
  param(
    callback: (name: string, matcher: RegExp) => RequestParamHandler
  ): IRouter;
  all: IRouterMatcher<IRouter>;
  use: IRouterHandler<IRouter> & IRouterMatcher<IRouter>;
  handle: RequestHandler;
  route(prefix: PathParams): IRoute;
  stack: any[];
}

interface RouterConstructor {
  new (options?: RouterOptions): IRouter & RequestHandler;
  (options?: RouterOptions): IRouter & RequestHandler;
}

declare var Router: RouterConstructor;
