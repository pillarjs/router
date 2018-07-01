# router

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Simple middleware-style router

## Installation

```bash
$ npm install router
```

## API

```js
var finalhandler = require('finalhandler')
var http         = require('http')
var Router       = require('router')

var router = Router()
router.get('/', function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Hello World!')
})

//with async
async function getHelloWorld()=>{
    await new Promise(resolve => setTimeout(resolve, 1000));  //wait 1 second
    return 'Hello Async World';
}

router.get('/', async function (req, res) {
  var response= await getHelloWorld();
  res.end(response)
})


var server = http.createServer(function(req, res) {
  router(req, res, finalhandler(req, res))
})

server.listen(3000)
```

This module is currently an extracted version from the Express project,
but with the main change being it can be used with a plain `http.createServer`
object or other web frameworks by removing Express-specific API calls.

## Router(options)

Options

- `strict`        - When `false` trailing slashes are optional (default: `false`)
- `caseSensitive` - When `true` the routing will be case sensitive. (default: `false`)
- `mergeParams`   - When `true` any `req.params` passed to the router will be
  merged into the router's `req.params`. (default: `false`) ([example](#example-using-mergeparams))

Returns a function with the signature `router(req, res, callback)` where
`callback([err])` must be provided to handle errors and fall-through from
not handling requests.

### router.use([path], ...middleware)

Use the given [middleware function](#middleware) for all http methods on the
given `path`, defaulting to the root path.

`router` does not automatically see `use` as a handler. As such, it will not
consider it one for handling `OPTIONS` requests.

* Note: If a `path` is specified, that `path` is stripped from the start of
  `req.url`.

```js
router.use(function (req, res, next) {
  // do your things

  // continue to the next middleware
  // the request will stall if this is not called
  next()

  // note: you should NOT call `next` if you have begun writing to the response
})
```

[Middleware](#middleware) can themselves use `next('router')` at any time to
exit the current router instance completely, invoking the top-level callback.

### router\[method](path, ...[middleware], handler)

The [http methods](https://github.com/jshttp/methods/blob/master/index.js) provide
the routing functionality in `router`.

Method middleware and handlers follow usual [middleware](#middleware) behavior,
except they will only be called when the method and path match the request.

```js
// handle a `GET` request
router.get('/', function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Hello World!')
})
```

[Middleware](#middleware) given before the handler have one additional trick,
they may invoke `next('route')`. Calling `next('route')` bypasses the remaining
middleware and the handler mounted for this route, passing the request to the
next route suitable for handling this request.

Route handlers and middleware can themselves use `next('router')` at any time
to exit the current router instance completely, invoking the top-level callback.

### router.param(name, param_middleware)

Maps the specified path parameter `name` to a specialized param-capturing middleware.

This function positions the middleware in the same stack as `.use`.

Parameter mapping is used to provide pre-conditions to routes
which use normalized placeholders. For example a _:user_id_ parameter
could automatically load a user's information from the database without
any additional code:

```js
router.param('user_id', function (req, res, next, id) {
  User.find(id, function (err, user) {
    if (err) {
      return next(err)
    } else if (!user) {
      return next(new Error('failed to load user'))
    }
    req.user = user

    // continue processing the request
    next()
  })
})
```

### router.route(path)

Creates an instance of a single `Route` for the given `path`.
(See `Router.Route` below)

Routes can be used to handle http `methods` with their own, optional middleware.

Using `router.route(path)` is a recommended approach to avoiding duplicate
route naming and thus typo errors.

```js
var api = router.route('/api/')
```

## Router.Route(path)

Represents a single route as an instance that can be used can be used to handle
http `methods` with it's own, optional middleware.

### route\[method](handler)

These are functions which you can directly call on a route to register a new
`handler` for the `method` on the route.

```js
// handle a `GET` request
var status = router.route('/status')

status.get(function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('All Systems Green!')
})
```

### route.all(handler)

Adds a handler for all HTTP methods to this route.

The handler can behave like middleware and call `next` to continue processing
rather than responding.

```js
router.route('/')
.all(function (req, res, next) {
  next()
})
.all(check_something)
.get(function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Hello World!')
})
```

## Middleware

Middleware (and method handlers) are functions that follow specific function
parameters and have defined behavior when used with `router`. The most common
format is with three parameters - "req", "res" and "next".

- `req`  - This is a [HTTP incoming message](https://nodejs.org/api/http.html#http_http_incomingmessage) instance.
- `res`  - This is a [HTTP server response](https://nodejs.org/api/http.html#http_class_http_serverresponse) instance.
- `next` - Calling this function that tells `router` to proceed to the next matching middleware or method handler. It accepts an error as the first argument.

Middleware and method handlers can also be defined with four arguments. When
the function has four parameters defined, the first argument is an error and
subsequent arguments remain, becoming - "err", "req", "res", "next". These
functions are "error handling middleware", and can be used for handling
errors that occurred in previous handlers (E.g. from calling `next(err)`).
This is most used when you want to define arbitrary rendering of errors.

```js
router.get('/error_route', function (req, res, next) {
  return next(new Error('Bad Request'))
})

router.use(function (err, req, res, next) {
  res.end(err.message) //=> "Bad Request"
})
```

Error handling middleware will **only** be invoked when an error was given. As
long as the error is in the pipeline, normal middleware and handlers will be
bypassed - only error handling middleware will be invoked with an error.

## Examples

```js
// import our modules
var http         = require('http')
var Router       = require('router')
var finalhandler = require('finalhandler')
var compression  = require('compression')
var bodyParser   = require('body-parser')

// store our message to display
var message = "Hello World!"

// initialize the router & server and add a final callback.
var router = Router()
var server = http.createServer(function onRequest(req, res) {
  router(req, res, finalhandler(req, res))
})

// use some middleware and compress all outgoing responses
router.use(compression())

// handle `GET` requests to `/message`
router.get('/message', function (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(message + '\n')
})

// create and mount a new router for our API
var api = Router()
router.use('/api/', api)

// add a body parsing middleware to our API
api.use(bodyParser.json())

// handle `PATCH` requests to `/api/set-message`
api.patch('/set-message', function (req, res) {
  if (req.body.value) {
    message = req.body.value

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(message + '\n')
  } else {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Invalid API Syntax\n')
  }
})

// make our http server listen to connections
server.listen(8080)
```

You can get the message by running this command in your terminal,
 or navigating to `127.0.0.1:8080` in a web browser.
```bash
curl http://127.0.0.1:8080
```

You can set the message by sending it a `PATCH` request via this command:
```bash
curl http://127.0.0.1:8080/api/set-message -X PATCH -H "Content-Type: application/json" -d '{"value":"Cats!"}'
```

### Example using mergeParams

```js
var http         = require('http')
var Router       = require('router')
var finalhandler = require('finalhandler')

// this example is about the mergeParams option
var opts = { mergeParams: true }

// make a router with out special options
var router = Router(opts)
var server = http.createServer(function onRequest(req, res) {

  // set something to be passed into the router
  req.params = { type: 'kitten' }

  router(req, res, finalhandler(req, res))
})

router.get('/', function (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  // with respond with the the params that were passed in
  res.end(req.params.type + '\n')
})

// make another router with our options
var handler = Router(opts)

// mount our new router to a route that accepts a param
router.use('/:path', handler)

handler.get('/', function (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  // will respond with the param of the router's parent route
  res.end(path + '\n')
})

// make our http server listen to connections
server.listen(8080)
```

Now you can get the type, or what path you are requesting:
```bash
curl http://127.0.0.1:8080
> kitten
curl http://127.0.0.1:8080/such_path
> such_path
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/router.svg
[npm-url]: https://npmjs.org/package/router
[node-version-image]: https://img.shields.io/node/v/router.svg
[node-version-url]: http://nodejs.org/download/
[travis-image]: https://img.shields.io/travis/pillarjs/router/master.svg
[travis-url]: https://travis-ci.org/pillarjs/router
[coveralls-image]: https://img.shields.io/coveralls/pillarjs/router/master.svg
[coveralls-url]: https://coveralls.io/r/pillarjs/router?branch=master
[downloads-image]: https://img.shields.io/npm/dm/router.svg
[downloads-url]: https://npmjs.org/package/router
