
var after = require('after')
var Buffer = require('safe-buffer').Buffer
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createServer = utils.createServer
var request = utils.request
var shouldHaveBody = utils.shouldHaveBody
var shouldHitHandle = utils.shouldHitHandle
var shouldNotHaveBody = utils.shouldNotHaveBody
var shouldNotHitHandle = utils.shouldNotHitHandle

var describePromises = global.Promise ? describe : describe.skip

describe('Router', function () {
  describe('.route(path)', function () {
    it('should return a new route', function () {
      var router = new Router()
      var route = router.route('/foo')
      assert.equal(route.path, '/foo')
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

      router.use(saw)

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
      var cb = after(2, done)
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      assert.ok(route)

      request(server)
        .get('/foo')
        .expect(404, cb)

      request(server)
        .head('/foo')
        .expect(404, cb)
    })

    it('should not invoke singular error route', function (done) {
      var router = new Router()
      var route = router.route('/foo')
      var server = createServer(router)

      route.all(function handleError (err, req, res, next) {
        throw err || new Error('boom!')
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
        ? shouldHaveBody(Buffer.from('hello, world'))
        : shouldNotHaveBody()

      describe('.' + method + '(...fn)', function () {
        it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
          var router = new Router()
          var route = router.route('/')
          var server = createServer(router)

          route[method](helloWorld)

          request(server)[method]('/')
            .expect(200)
            .expect(body)
            .end(done)
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

          request(server)[method]('/foo')
            .expect(200)
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect(body)
            .end(done)
        })

        it('should accept single array of handlers', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route[method]([createHitHandle(1), createHitHandle(2), helloWorld])

          request(server)[method]('/foo')
            .expect(200)
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect(body)
            .end(done)
        })

        it('should accept nested arrays of handlers', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route[method]([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

          request(server)[method]('/foo')
            .expect(200)
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect('x-fn-3', 'hit')
            .expect(body)
            .end(done)
        })
      })
    })

    describe('error handling', function () {
      it('should handle errors from next(err)', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError (req, res, next) {
          next(new Error('boom!'))
        })

        route.all(helloWorld)

        route.all(function handleError (err, req, res, next) {
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

        route.all(function createError (req, res, next) {
          throw new Error('boom!')
        })

        route.all(helloWorld)

        route.all(function handleError (err, req, res, next) {
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

        route.all(function createError (req, res, next) {
          throw new Error('boom!')
        })

        route.all(function handleError (err, req, res, next) {
          throw new Error('ouch: ' + err.message)
        })

        route.all(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
          .get('/foo')
          .expect(500, 'caught: ouch: boom!', done)
      })
    })

    describe('next("route")', function () {
      it('should invoke next handler', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.get(function handle (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        router.use(saw)

        request(server)
          .get('/foo')
          .expect('x-next', 'route')
          .expect(200, 'saw GET /foo', done)
      })

      it('should invoke next route', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.get(function handle (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        router.route('/foo').all(saw)

        request(server)
          .get('/foo')
          .expect('x-next', 'route')
          .expect(200, 'saw GET /foo', done)
      })

      it('should skip next handlers in route', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(createHitHandle(1))
        route.get(function goNext (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })
        route.all(createHitHandle(2))

        router.use(saw)

        request(server)
          .get('/foo')
          .expect(shouldHitHandle(1))
          .expect('x-next', 'route')
          .expect(shouldNotHitHandle(2))
          .expect(200, 'saw GET /foo', done)
      })

      it('should not invoke error handlers', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function goNext (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        route.all(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
          .get('/foo')
          .expect('x-next', 'route')
          .expect(404, done)
      })
    })

    describe('next("router")', function () {
      it('should exit the router', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        function handle (req, res, next) {
          res.setHeader('x-next', 'router')
          next('router')
        }

        route.get(handle, createHitHandle(1))

        router.use(saw)

        request(server)
          .get('/foo')
          .expect('x-next', 'router')
          .expect(shouldNotHitHandle(1))
          .expect(404, done)
      })

      it('should not invoke error handlers', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function goNext (req, res, next) {
          res.setHeader('x-next', 'router')
          next('router')
        })

        route.all(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        router.use(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
          .get('/foo')
          .expect('x-next', 'router')
          .expect(404, done)
      })
    })

    describePromises('promise support', function () {
      it('should pass rejected promise value', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError (req, res, next) {
          return Promise.reject(new Error('boom!'))
        })

        route.all(helloWorld)

        route.all(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
          .get('/foo')
          .expect(500, 'caught: boom!', done)
      })

      it('should pass rejected promise without value', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError (req, res, next) {
          return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
        })

        route.all(helloWorld)

        route.all(function handleError (err, req, res, next) {
          res.statusCode = 500
          res.end('caught: ' + err.message)
        })

        request(server)
          .get('/foo')
          .expect(500, 'caught: Rejected promise', done)
      })

      it('should ignore resolved promise', function (done) {
        var router = new Router()
        var route = router.route('/foo')
        var server = createServer(router)

        route.all(function createError (req, res, next) {
          saw(req, res)
          return Promise.resolve('foo')
        })

        route.all(function () {
          done(new Error('Unexpected route invoke'))
        })

        request(server)
          .get('/foo')
          .expect(200, 'saw GET /foo', done)
      })

      describe('error handling', function () {
        it('should pass rejected promise value', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route.all(function createError (req, res, next) {
            return Promise.reject(new Error('boom!'))
          })

          route.all(function handleError (err, req, res, next) {
            return Promise.reject(new Error('caught: ' + err.message))
          })

          route.all(function handleError (err, req, res, next) {
            res.statusCode = 500
            res.end('caught again: ' + err.message)
          })

          request(server)
            .get('/foo')
            .expect(500, 'caught again: caught: boom!', done)
        })

        it('should pass rejected promise without value', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route.all(function createError (req, res, next) {
            return Promise.reject(new Error('boom!'))
          })

          route.all(function handleError (err, req, res, next) {
            assert.equal(err.message, 'boom!')
            return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
          })

          route.all(function handleError (err, req, res, next) {
            res.statusCode = 500
            res.end('caught again: ' + err.message)
          })

          request(server)
            .get('/foo')
            .expect(500, 'caught again: Rejected promise', done)
        })

        it('should ignore resolved promise', function (done) {
          var router = new Router()
          var route = router.route('/foo')
          var server = createServer(router)

          route.all(function createError (req, res, next) {
            return Promise.reject(new Error('boom!'))
          })

          route.all(function handleError (err, req, res, next) {
            res.statusCode = 500
            res.end('caught: ' + err.message)
            return Promise.resolve('foo')
          })

          route.all(function () {
            done(new Error('Unexpected route invoke'))
          })

          request(server)
            .get('/foo')
            .expect(500, 'caught: boom!', done)
        })
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
            .expect(200, { foo: 'bar' }, done)
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
            .expect(200, { foo: 'fizz', bar: 'buzz' }, done)
        })

        it('should work following a partial capture group', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/user(s?)/:user/:op')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/user/tj/edit')
            .expect(200, { 0: '', user: 'tj', op: 'edit' }, cb)

          request(server)
            .get('/users/tj/edit')
            .expect(200, { 0: 's', user: 'tj', op: 'edit' }, cb)
        })

        it('should work inside literal paranthesis', function (done) {
          var router = new Router()
          var route = router.route('/:user\\(:op\\)')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/tj(edit)')
            .expect(200, { user: 'tj', op: 'edit' }, done)
        })

        it('should work within arrays', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route(['/user/:user/poke', '/user/:user/pokes'])
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/user/tj/poke')
            .expect(200, { user: 'tj' }, cb)

          request(server)
            .get('/user/tj/pokes')
            .expect(200, { user: 'tj' }, cb)
        })
      })

      describe('using ":name?"', function () {
        it('should name an optional parameter', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/:foo?')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/bar')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/')
            .expect(200, {}, cb)
        })

        it('should work in any segment', function (done) {
          var cb = after(2, done)
          var router = new Router()
          var route = router.route('/user/:foo?/delete')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/user/bar/delete')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/user/delete')
            .expect(200, {}, cb)
        })
      })

      describe('using ":name*"', function () {
        it('should name a zero-or-more repeated parameter', function (done) {
          var cb = after(3, done)
          var router = new Router()
          var route = router.route('/:foo*')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/')
            .expect(200, {}, cb)

          request(server)
            .get('/bar')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/fizz/buzz')
            .expect(200, { foo: 'fizz/buzz' }, cb)
        })

        it('should work in any segment', function (done) {
          var cb = after(3, done)
          var router = new Router()
          var route = router.route('/user/:foo*/delete')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/user/delete')
            .expect(200, {}, cb)

          request(server)
            .get('/user/bar/delete')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/user/fizz/buzz/delete')
            .expect(200, { foo: 'fizz/buzz' }, cb)
        })
      })

      describe('using ":name+"', function () {
        it('should name a one-or-more repeated parameter', function (done) {
          var cb = after(3, done)
          var router = new Router()
          var route = router.route('/:foo+')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/')
            .expect(404, cb)

          request(server)
            .get('/bar')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/fizz/buzz')
            .expect(200, { foo: 'fizz/buzz' }, cb)
        })

        it('should work in any segment', function (done) {
          var cb = after(3, done)
          var router = new Router()
          var route = router.route('/user/:foo+/delete')
          var server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/user/delete')
            .expect(404, cb)

          request(server)
            .get('/user/bar/delete')
            .expect(200, { foo: 'bar' }, cb)

          request(server)
            .get('/user/fizz/buzz/delete')
            .expect(200, { foo: 'fizz/buzz' }, cb)
        })
      })
    })
  })
})

function helloWorld (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('hello, world')
}

function saw (req, res) {
  var msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sendParams (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(req.params))
}
