
var after = require('after')
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createServer = utils.createServer
var request = utils.request

describe('Router', function () {
  describe('.route(path)', function () {
    it('should return a new route', function () {
      var router = new Router()
      var route = router.route('/foo')
      assert.equal(route.path, '/foo')
    })

    it('should set the route name iff provided', function () {
      var router = new Router()
      var route = router.route('/abc', 'abcRoute')
      assert.equal(route.path, '/abc')
      assert.equal(route.name, 'abcRoute')
      assert.equal(router.routes['abcRoute'], route)
      var route2 = router.route('/def')
      assert.equal(router.routes['abcRoute'], route)
      assert.equal(null, router.routes[undefined])
    })

    it('should not allow duplicate route or handler names', function () {
      var router = new Router()
      var route = router.route('/abc', 'abcRoute')
      assert.throws(router.route.bind(router, '/xyz', 'abcRoute'), /a route or handler named "abcRoute" already exists/)
      var nestedRouter = new Router()
      router.use(nestedRouter, 'nestedRoute')
      assert.throws(router.route.bind(router, '/xyz', 'nestedRoute'), /a route or handler named "nestedRoute" already exists/)
    })

    it('should not allow empty names', function () {
      var router = new Router()
      assert.throws(router.route.bind(router, '/xyz', ''), /name should be a non-empty string/)
      assert.throws(router.route.bind(router, '/xyz', new String('xyz')), /name should be a non-empty string/)
      assert.throws(router.route.bind(router, '/xyz', {}), /name should be a non-empty string/)
    })

    it('should respond to multiple methods', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      route.get(saw)
      route.post(saw)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /foo', cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /foo', cb)

      request(server)
      .put('/foo')
      .expect(404, cb)
    })

    it('should stack', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      route.post(createHitHandle(1))
      route.all(createHitHandle(2))
      route.get(createHitHandle(3))
      route.all(saw)

      request(server)
      .get('/foo')
      .expect('x-fn-2', 'hit')
      .expect('x-fn-3', 'hit')
      .expect(200, 'saw GET /foo', cb)

      request(server)
      .post('/foo')
      .expect('x-fn-1', 'hit')
      .expect('x-fn-2', 'hit')
      .expect(200, 'saw POST /foo', cb)

      request(server)
      .put('/foo')
      .expect('x-fn-2', 'hit')
      .expect(200, 'saw PUT /foo', cb)
    })

    it('should not error on empty route', function (done) {
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      request(server)
      .get('/foo')
      .expect(404, done)
    })

    it('should not invoke singular error route', function (done) {
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      route.all(function handleError(err, req, res, next) {
        throw new Error('boom!')
      })

      request(server)
      .get('/foo')
      .expect(404, done)
    })

    describe('.all(...fn)', function () {
      it('should reject no arguments', function () {
        var router = new Router()
        var route = router.route('/')
        assert.throws(route.all.bind(route), /argument handler is required/)
      })

      it('should reject empty array', function () {
        var router = new Router()
        var route = router.route('/')
        assert.throws(route.all.bind(route, []), /argument handler is required/)
      })

      it('should reject invalid fn', function () {
        var router = new Router()
        var route = router.route('/')
        assert.throws(route.all.bind(route, 2), /argument handler must be a function/)
      })

      it('should respond to all methods', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .post('/foo')
        .expect(200, 'saw POST /foo', cb)

        request(server)
        .put('/foo')
        .expect(200, 'saw PUT /foo', cb)
      })

      it('should accept multiple arguments', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(createHitHandle(1), createHitHandle(2), helloWorld)

        request(server)
        .get('/foo')
        .expect('x-fn-1', 'hit')
        .expect('x-fn-2', 'hit')
        .expect(200, 'hello, world', done)
      })

      it('should accept single array of handlers', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all([createHitHandle(1), createHitHandle(2), helloWorld])

        request(server)
        .get('/foo')
        .expect('x-fn-1', 'hit')
        .expect('x-fn-2', 'hit')
        .expect(200, 'hello, world', done)
      })

      it('should accept nested arrays of handlers', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

        request(server)
        .get('/foo')
        .expect('x-fn-1', 'hit')
        .expect('x-fn-2', 'hit')
        .expect('x-fn-3', 'hit')
        .expect(200, 'hello, world', done)
      })
    })

    methods.slice().sort().forEach(function (method) {
      if (method === 'connect') {
        // CONNECT is tricky and supertest doesn't support it
        return
      }

      var body = method !== 'head'
        ? 'hello, world'
        : ''

      describe('.' + method + '(...fn)', function () {
        it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
          var router = new Router()
          var route = router.route('/')
          var server = createServer(router)

          route[method](helloWorld)

          request(server)
          [method]('/')
          .expect(200, body, done)
        })

        it('should reject no arguments', function () {
          var router = new Router()
          var route = router.route('/')
          assert.throws(route[method].bind(route), /argument handler is required/)
        })

        it('should reject empty array', function () {
          var router = new Router()
          var route = router.route('/')
          assert.throws(route[method].bind(route, []), /argument handler is required/)
        })

        it('should reject invalid fn', function () {
          var router = new Router()
          var route = router.route('/')
          assert.throws(route[method].bind(route, 2), /argument handler must be a function/)
        })

        it('should accept multiple arguments', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route[method](createHitHandle(1), createHitHandle(2), helloWorld)

          request(server)
          [method]('/foo')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect(200, body, done)
        })

        it('should accept single array of handlers', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route[method]([createHitHandle(1), createHitHandle(2), helloWorld])

          request(server)
          [method]('/foo')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect(200, body, done)
        })

        it('should accept nested arrays of handlers', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route[method]([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

          request(server)
          [method]('/foo')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect('x-fn-3', 'hit')
          .expect(200, body, done)
        })
      })
    })

    describe('error handling', function () {
      it('should handle errors from next(err)', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError(req, res, next) {
          next(new Error('boom!'))
        })

        route.all(helloWorld)

        route.all(function handleError(err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
        .get('/foo')
        .expect(500, 'caught: boom!', done)
      })

      it('should handle errors thrown', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError(req, res, next) {
          throw new Error('boom!')
        })

        route.all(helloWorld)

        route.all(function handleError(err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
        .get('/foo')
        .expect(500, 'caught: boom!', done)
      })

      it('should handle errors thrown in error handlers', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError(req, res, next) {
          throw new Error('boom!')
        })

        route.all(function handleError(err, req, res, next) {
          throw new Error('oh, no!')
        })

        route.all(function handleError(err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
        .get('/foo')
        .expect(500, 'caught: oh, no!', done)
      })
    })

    describe('path', function () {
      describe('using ":name"', function () {
        it('should name a capture group', function (done) {
          var router = new Router()
          var route = router.route('/:foo')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/bar')
          .expect(200, {'foo': 'bar'}, done)
        })

        it('should match single path segment', function (done) {
          var router = new Router()
          var route = router.route('/:foo')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/bar/bar')
          .expect(404, done)
        })

        it('should work multiple times', function (done) {
          var router = new Router()
          var route = router.route('/:foo/:bar')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/fizz/buzz')
          .expect(200, {'foo': 'fizz', 'bar': 'buzz'}, done)
        })

        it('should work following a partial capture group', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/user(s)?/:user/:op')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/user/tj/edit')
          .expect(200, {'user': 'tj', 'op': 'edit'}, cb)

          request(server)
          .get('/users/tj/edit')
          .expect(200, {'0': 's', 'user': 'tj', 'op': 'edit'}, cb)
        })

        it('should work inside literal paranthesis', function (done) {
          var router = new Router()
          var route = router.route('/:user\\(:op\\)')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/tj(edit)')
          .expect(200, {'user': 'tj', 'op': 'edit'}, done)
        })

        it('should work within arrays', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route(['/user/:user/poke', '/user/:user/pokes'])
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/user/tj/poke')
          .expect(200, {'user': 'tj'}, cb)

          request(server)
          .get('/user/tj/pokes')
          .expect(200, {'user': 'tj'}, cb)
        })
      })

      describe('using "*"', function () {
        it('should capture everything', function (done) {
          var router = new Router()
          var route = router.route('*')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/foo/bar/baz')
          .expect(200, {'0': '/foo/bar/baz'}, done)
        })

        it('should capture everything with pre- and post-fixes', function (done) {
          var router = new Router()
          var route = router.route('/foo/*/bar')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/foo/1/2/3/bar')
          .expect(200, {'0': '1/2/3'}, done)
        })

        it('should capture greedly', function (done) {
          var router = new Router()
          var route = router.route('/foo/*/bar')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/foo/bar/bar/bar')
          .expect(200, {'0': 'bar/bar'}, done)
        })

        it('should be an optional capture', function (done) {
          var router = new Router()
          var route = router.route('/foo*')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/foo')
          .expect(200, {'0': ''}, done)
        })

        it('should require preceeding /', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/foo/*')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/foo')
          .expect(404, cb)

          request(server)
          .get('/foo/')
          .expect(200, cb)
        })

  /*      it('should work in a named parameter', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/:foo(*)')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/bar')
          .expect(200, {'0': 'bar', 'foo': 'bar'}, cb)

          request(server)
          .get('/fizz/buzz')
          .expect(200, {'0': 'fizz/buzz', 'foo': 'fizz/buzz'}, cb)
        })*/

        it('should work before a named parameter', function (done) {
          var router = new Router()
          var route = router.route('/*/user/:id')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/poke/user/42')
          .expect(200, {'0': 'poke', 'id': '42'}, done)
        })

        it('should work within arrays', function (done) {
          var cb = after(3, done)
          var router = new Router()
          var route = router.route(['/user/:id', '/foo/*', '/:action'])
          var server = createServer(router)

          route.all(sendParams)

          request(server)
          .get('/user/42')
          .expect(200, {'id': '42'}, cb)

          request(server)
          .get('/foo/bar')
          .expect(200, {'0': 'bar'}, cb)

          request(server)
          .get('/poke')
          .expect(200, {'action': 'poke'}, cb)
        })
      })
    })
  })
})

function helloWorld(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('hello, world')
}

function setsaw(num) {
  var name = 'x-saw-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, req.method + ' ' + req.url)
    next()
  }
}

function saw(req, res) {
  var msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sendParams(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(req.params))
}
