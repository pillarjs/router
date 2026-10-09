import { IncomingMessage, ServerResponse } from "node:http";
import { expectTypeOf } from "expect-type";
import Router, { ErrorRequestHandler, Method, NextFunction, Path, RequestHandler } from "..";

const router = Router();

const handler: RequestHandler = (req, res, next) => next();
const other: RequestHandler = (req, res, next) => next();

// handler parameters are inferred
router.get("/", function (req, res) {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
});

router.get("/", function (req, res, next) {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
  expectTypeOf(next).toBeFunction();
});

// typescript has no way to infer the types automatically
router.get<ErrorRequestHandler>("/", function (err, req, res, next) {
  expectTypeOf(err).toEqualTypeOf<Error>();
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
  expectTypeOf(next).toBeFunction();
});

// methods accept multiple handlers and nested arrays (flattened at runtime)
router.get("/", handler, other);
router.get("/", [handler, other]);
router.get("/", [handler, [other]], handler);

// at least one handler is required (runtime throws TypeError)
// @ts-expect-error
router.get("/");
// handlers must be functions or arrays of them
// @ts-expect-error
router.get("/", "not-a-handler");

// paths may be a string, RegExp, or array of either
router.get(/^\/x/, handler);
router.get(["/a", /^\/b/], handler);
// @ts-expect-error
router.get(42, handler);

// use: with or without path, multiple handlers, arrays
router.use(handler);
router.use(handler, other);
router.use([handler, [other]]);
router.use("/a", handler, [other], handler);
router.use(["/a", "/b"], handler);
router.use(/^\/c/, handler);
// @ts-expect-error path without any handler (runtime throws TypeError)
router.use("/x");
// @ts-expect-error
router.use();

// verb methods and use return the router for chaining
expectTypeOf(router.get("/", handler)).toEqualTypeOf(router);
router.use(handler).use("/a", other).get("/", handler);

// one method per node:http METHODS entry, not just the classic 8
router.trace("/", handler);
router.search("/", handler);
router.propfind("/", handler);
router["m-search"]("/", handler);
// @ts-expect-error not an HTTP method
router.foo("/", handler);

// error handlers are distinguished by the explicit generic
router.use<ErrorRequestHandler>(function (err, req, res, next) {
  expectTypeOf(err).toEqualTypeOf<Error>();
  next(err);
});

// param callbacks receive typed req/res
router.param("id", function (req, res, next, value, name) {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
  expectTypeOf(next).toEqualTypeOf<NextFunction>();
  expectTypeOf(name).toBeString();
});

// router is itself a request handler (mountable in a server or another router)
expectTypeOf(router).toExtend<RequestHandler>();
router.use(Router());

// the instance, options, and helper types are nameable by consumers
const mounted: Router.Router = Router({ strict: true, caseSensitive: true, mergeParams: true });
mounted.use(handler);
const opts: Router.RouterOptions = { strict: true };
Router(opts);
new Router(opts);
// @ts-expect-error unknown options are rejected
Router({ nope: true });
expectTypeOf<Method>().toExtend<string>();
expectTypeOf<Path>().toEqualTypeOf<string | RegExp | Array<string | RegExp>>();

// routes: all verbs, multiple handlers, chaining
const route = router.route("/things/:id");
expectTypeOf(route.path).toBeString();
route.all(handler).get(handler, other).post([handler, [other]]);
route.checkout(handler);
route["m-search"](handler);
// @ts-expect-error at least one handler is required
route.put();

// Route must be constructed with new, and accepts any Path
new Router.Route("/x");
new Router.Route(/^\/x/);
new Router.Route(["/a", /^\/b/]);
// @ts-expect-error calling without new does not construct (strict mode)
Router.Route("/x");
// @ts-expect-error
new Router.Route(42);

