import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  default as Router,
  RouterOptions,
  IncomingRequest,
  RouteHandler,
  IRoute,
  RoutedRequest
} from '..';

const options: RouterOptions = {
  strict: false,
  caseSensitive: false,
  mergeParams: false
};

const r = new Router();
const router = new Router(options);
const routerHandler: RouteHandler = (req, res) => {
  res.end('FIN');
};

router.get('/', routerHandler);
router.post('/', routerHandler);
router.delete('/', routerHandler);
router.patch('/', routerHandler);
router.options('/', routerHandler);
router.head('/', routerHandler);
router.unsubscribe('/', routerHandler);

// param
router.param('user_id', (req, res, next, id) => {
  const val: string = id;
  next();
});

// middleware
router.use((req, res, next) => {
  next();
});

const api: IRoute = router.route('/api/');

router.route('/')
.all((req, res, next) => {
  const url: string = req.baseUrl;
  next();
})
.get((req, res) => {
  res.setHeader('x-header', 'value');
  res.end('.');
});


// test router handling
var server = createServer(function(req: IncomingMessage, res: ServerResponse) {
  router(req, res, (err) => {
    if (err) {
      const e: Error = err;
    }
    //
  })
  router.handle(req, res, (err) => {
    //
  })
})
