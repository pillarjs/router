import { createServer, OutgoingMessage } from 'http';
import Router, {
  RouterOptions,
  RouteHandler,
  NextFunction,
  RoutedRequest
} from '..';

const options: RouterOptions = {
  strict: false,
  caseSensitive: false,
  mergeParams: false
};

const r = new Router();
const r2 = Router()

const router = new Router(options);
const routerHandler: RouteHandler = (req, res, next) => {
    res.setHeader('Content-Type', 'plain/text');
    res.write('Hello')
    res.end('world')
};

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
router.param('user_id', (req, res, next, id) => {});

// middleware
router.use((req, res, next) => {
    type TReq = Expect<Equal<typeof req, RoutedRequest>>
    type TRes = Expect<Equal<typeof res, OutgoingMessage>>
    type TNext = Expect<Equal<typeof next, NextFunction>>
    next();
});

const api = router.route('/api/');

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


// test router handling

var server = createServer(function(req, res) {
  router(req, res, (err) => {
    //
  })
  router.handle(req, res, (err) => {
    //
  })
})


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Compute<T> = T extends (...args: any[]) => any ? T : { [K in keyof T]: Compute<T[K]> }

export type Equal<X, Y> = (<T>() => T extends Compute<X> ? 1 : 2) extends <T>() => T extends Compute<Y> ? 1 : 2 ? true : false

export type Expect<T extends true> = T extends true ? true : never
