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
var http = require('http')
var Router = require('router')

var router = Router()

router.get('/', function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Hello World!')
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

Use the given middleware function for all http methods on the given `path`,
defaulting to the root path.

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

### router\[method](path, ...[middleware], handler)

The [http methods](https://github.com/jshttp/methods/blob/master/index.js) provide
the routing functionality in `router`.

These are functions which you can directly call on the router to register a new
`handler` for the `method` at a specified `path`.

```js
// handle a `GET` request
router.get('/', function (req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Hello World!')
})
```

Additional middleware may be given before the handler. These middleware behave
exactly as normal with one exception: they may invoke `next('route')`.
Calling `next('route')` bypasses the remaining middleware and handler for this
route, passing the request on to the next route.

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

## Examples

```js
// import our modules
var http = require('http')
var Router = require('router')
var finalhandler = require('finalhandler')
var compression = require('compression')
var bodyParser = require('body-parser')

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
var http = require('http')
var Router = require('router')
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

## Implementing Your Own Router

Implementing a custom path matching library on top of this module is as easy as using `Router.Engine`. For example, to implement an "exact" path matching module, we can do this:

```js
var Engine = require('router').Engine
var slice = Array.prototype.slice

/**
 * Accepts the path and some options we defined in our engine.
 */
function toFunction (route, options) {
  if (!options.end) {
    return function (path) {
      var matches = path.substr(0, route.length) === route

      return matches ? { path: path } : false
    }
  }

  return function (path) {
    return path === route ? { path: path } : false
  }
}

/**
 * The constructor must return the engine instance.
 */
function ExactRouter (options) {
  return Engine.call(this, options)
}

/**
 * Inherits from the engine prototype.
 */
ExactRouter.prototype = Object.create(Engine.prototype)

/**
 * Set up `Router#use` with our custom path matching implementation.
 */
ExactRouter.prototype.use = function () {
  // Use a simple utility for supporting a single path argument like `router`.
  var opts = Engine.sanitizeUse.apply(null, arguments)
  var match = toFunction(opts.path, { end: false })

  return Engine.prototype.use.call(this, opts.path, match, opts.callbacks)
}

/**
 * Set up `Router#route` with our custom path patching implementation.
 */
ExactRouter.prototype.route = function (path) {
  var match = toFunction(path, { end: true })

  return Engine.prototype.route.call(this, path, match)
}

/**
 * Set up all the router method shorthands.
 */
Engine.methods.forEach(function (method) {
  ExactRouter.prototype[method] = function (path) {
    var route = this.route(path)
    route[method].apply(route, slice.call(arguments, 1))
    return this
  }
})
```

Both the path matching function and the path itself must be passed into the `route` and `use` engine methods. This is for debugging, so `path` should be a human-readable path name. `Engine#use` also accepts an array of handlers to immediately include. The match function must return an object of `{ path: string, params: object }` or `false` if it didn't match.

Note: The path matching utility should not throw errors. Decoding of parameters is handled by the engine.

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
