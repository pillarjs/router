export = Router;

declare namespace Router {

  export interface RouterOptions {
    strict?: boolean;
    caseSensitive?: boolean;
    mergeParams?: boolean;
  }

  interface IncommingRequest {
    url: string,
    method: string,
    originalUrl?: string,
    params?: any;
  }

  interface RoutedRequest extends IncommingRequest {
    baseUrl: string,
    next?: NextFunction,
    route?: IRoute
  }

  type RequestParamHandler = (req: IncommingRequest, res: any, next: NextFunction, value: any, name: string) => any;

  interface RouteHandler {
    // tslint:disable-next-line callable-types (This is extended from and can't extend from a type alias in ts<2.2
    (req: RoutedRequest, res: any, next: NextFunction): any;
  }

  interface RequestHandler {
    // tslint:disable-next-line callable-types (This is extended from and can't extend from a type alias in ts<2.2
    (req: IncommingRequest, res: any, next: NextFunction): any;
  }


  interface NextFunction {
    // tslint:disable-next-line callable-types (In ts2.1 it thinks the type alias has no call signatures)
    (err?: any): void;
  }

  type ErrorRequestHandler = (err: any, req: IncommingRequest, res: any, next: NextFunction) => any;

  type PathParams = string | RegExp | Array<string | RegExp>;

  type RequestHandlerParams = RouteHandler | ErrorRequestHandler | Array<RouteHandler | ErrorRequestHandler>;

  interface IRouterMatcher<T> {
    (path: PathParams, ...handlers: RouteHandler[]): T;
    (path: PathParams, ...handlers: RequestHandlerParams[]): T;
  }

  interface IRouterHandler<T> {
    (...handlers: RouteHandler[]): T;
    (...handlers: RequestHandlerParams[]): T;
  }

  interface IRouter {
    /**
     * Map the given param placeholder `name`(s) to the given callback(s).
     *
     * Parameter mapping is used to provide pre-conditions to routes
     * which use normalized placeholders. For example a _:user_id_ parameter
     * could automatically load a user's information from the database without
     * any additional code,
     *
     * The callback uses the samesignature as middleware, the only differencing
     * being that the value of the placeholder is passed, in this case the _id_
     * of the user. Once the `next()` function is invoked, just like middleware
     * it will continue on to execute the route, or subsequent parameter functions.
     *
     *      app.param('user_id', function(req, res, next, id){
     *        User.find(id, function(err, user){
     *          if (err) {
     *            next(err);
     *          } else if (user) {
     *            req.user = user;
     *            next();
     *          } else {
     *            next(new Error('failed to load user'));
     *          }
     *        });
     *      });
     */
    param(name: string, handler: RequestParamHandler): this;

    /**
     * Alternatively, you can pass only a callback, in which case you have the opportunity to alter the app.param()
     *
     * @deprecated since version 4.11
     */
    param(callback: (name: string, matcher: RegExp) => RequestParamHandler): this;

    /**
     * Special-cased "all" method, applying the given route `path`,
     * middleware, and callback to _every_ HTTP method.
     */
    all: IRouterMatcher<this>;

    get: IRouterMatcher<this>;
    post: IRouterMatcher<this>;
    put: IRouterMatcher<this>;
    delete: IRouterMatcher<this>;
    patch: IRouterMatcher<this>;
    options: IRouterMatcher<this>;
    head: IRouterMatcher<this>;

    use: IRouterHandler<this> & IRouterMatcher<this>;

    handle: RequestHandler;

    route(prefix: PathParams): IRoute;
    /**
     * Stack of configured routes
     */
    stack: any[];
  }

  interface IRoute {
    path: string;
    stack: any;
    all: IRouterHandler<this>;
    get: IRouterHandler<this>;
    post: IRouterHandler<this>;
    put: IRouterHandler<this>;
    delete: IRouterHandler<this>;
    patch: IRouterHandler<this>;
    options: IRouterHandler<this>;
    head: IRouterHandler<this>;
  }

  interface RouterConstructor extends IRouter {
    new(options?: RouterOptions): IRouter & RequestHandler;
  }

}

declare var Router: Router.RouterConstructor;
