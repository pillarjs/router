# router

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Simple middleware-style router

## Installation

```sh
$ npm install router
```

## API

```js
var Router = require('router')
```

This module is currently an extracted version from the Express 4.x project,
but with the main change being it can be used with a plain `http.createServer`
object or something like `connect` by removing Express-specific API calls.

Documentation is forthcoming, but the Express 4.x documentation can be found
at http://expressjs.com/4x/api.html#router

## Example

```js
var Router = require('router')
var final  = require('finalhandler')
var http   = require('http')

var router = Router()
router.get('/:who?', function(req, res, next) {
  res.end('hello ' + req.params.who + '\n')
})

http.createServer(function(req, res) {
  router(req, res, final(req, res))
}).listen(3000)

// $ curl http://localhost:3000/world
// hello world
```

## Testing

```sh
$ npm test
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/router.svg?style=flat
[npm-url]: https://npmjs.org/package/router
[node-version-image]: https://img.shields.io/node/v/router.svg?style=flat
[node-version-url]: http://nodejs.org/download/
[travis-image]: https://img.shields.io/travis/pillarjs/router.svg?style=flat
[travis-url]: https://travis-ci.org/pillarjs/router
[coveralls-image]: https://img.shields.io/coveralls/pillarjs/router.svg?style=flat
[coveralls-url]: https://coveralls.io/r/pillarjs/router?branch=master
[downloads-image]: https://img.shields.io/npm/dm/router.svg?style=flat
[downloads-url]: https://npmjs.org/package/router
