import { createServer, OutgoingMessage } from 'http';
import Router, {
  RouterOptions,
  RouteHandler,
  NextFunction,
  RoutedRequest,
  IncomingRequest
} from '..';

const options: RouterOptions = {
  strict: false,
  caseSensitive: false,
  mergeParams: false
};

// new constructor
new Router().all('/', (req, res, next) => {})
// direct call
Router().all('/', (req, res, next) => {})

const router = new Router(options);
const routerHandler: RouteHandler = (req, res, next) => {
    res.setHeader('Content-Type', 'plain/text');
    res.write('Hello')
    res.end('world')
};

// test verb methods
router.get('/', routerHandler);
router.post('/', routerHandler);
router.delete('/', routerHandler);
router.patch('/', routerHandler);
router.options('/', routerHandler);
router.head('/', routerHandler);
router.bind('/', routerHandler);
router.connect('/', routerHandler);
router.trace('/', routerHandler);
router['m-search']('/', routerHandler);


// param
router.param('user_id', (req, res, next, id) => {
  type TReq = Expect<Equal<typeof req, IncomingRequest>>
  type TRes = Expect<Equal<typeof res, OutgoingMessage>>
  type TNext = Expect<Equal<typeof next, NextFunction>>
  type P1 = Expect<Equal<typeof id, string>>
});

// middleware
router.use((req, res, next) => {
    type TReq = Expect<Equal<typeof req, RoutedRequest>>
    type TRes = Expect<Equal<typeof res, OutgoingMessage>>
    type TNext = Expect<Equal<typeof next, NextFunction>>
    next();
});

// RoutedRequest is extended with properties without type errors
router.use((req, res, next) => {
  req.extendable = 'extendable'
  next();
});

router.route('/')
.all((req, res, next) => {
    type TReq = Expect<Equal<typeof req, RoutedRequest>>
    type TRes = Expect<Equal<typeof res, OutgoingMessage>>
    type TNext = Expect<Equal<typeof next, NextFunction>>
    next();
})
.get((req, res, next) => {
    type TReq = Expect<Equal<typeof req, RoutedRequest>>
    type TRes = Expect<Equal<typeof res, OutgoingMessage>>
    type TNext = Expect<Equal<typeof next, NextFunction>>
});


// valid for router from createServer
createServer(function(req, res) {
  router(req, res, (err) => {})
  router.handle(req, res, (err) => {})
})


// Type test helper methods
type Compute<T> = T extends (...args: any[]) => any ? T : { [K in keyof T]: Compute<T[K]> }

type Equal<X, Y> = (<T>() => T extends Compute<X> ? 1 : 2) extends <T>() => T extends Compute<Y> ? 1 : 2 ? true : false

type Expect<T extends true> = T extends true ? true : never
