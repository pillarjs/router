import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  default as Router,
  RouterOptions,
  IncommingRequest,
  RouteHandler,
  IRoute,
  NextFunction,
  RoutedRequest
} from '..';


const options: RouterOptions = {
  strict: false,
  caseSensitive: false,
  mergeParams: false
};

const r = new Router();
const router = new Router(options);
const routerHandler: RouteHandler = (req: IncommingRequest, res: any, next: NextFunction) => {};

router.get('/', routerHandler);
router.post('/', routerHandler);
router.delete('/', routerHandler);
router.patch('/', routerHandler);
router.options('/', routerHandler);
router.head('/', routerHandler);

// param
router.param('user_id', (req, res, next, id) => {});

// middleware
router.use((req, res, next) => {
  next();
});

const api: IRoute = router.route('/api/');

router.route('/')
.all((req: RoutedRequest, res: any, next: NextFunction) => {
  next();
})
.get((req, res) => {
  // do nothing
});


// test router handling

var server = createServer(function(req: IncomingMessage, res: ServerResponse) {
  router(req as IncommingRequest, res, (err: any) => {
    //
  })
  router.handle(req as Router.IncommingRequest, res, (err: any) => {
    //
  })
})



