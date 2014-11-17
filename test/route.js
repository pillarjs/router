
var after = require('after')
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createServer = utils.createServer
var request = utils.request

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

      route.post(sethit(1))
      route.all(sethit(2))
      route.get(sethit(3))
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

        route.all(sethit(1), sethit(2), helloWorld)

        request(server)
        .get('/foo')
        .expect('x-fn-1', 'hit')
        .expect('x-fn-2', 'hit')
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
          var route = router.route('/')
          var server = createServer(router)

          route[method](sethit(1), sethit(2), helloWorld)

          request(server)
          [method]('/')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
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
  })
})

function helloWorld(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('hello, world')
}

function sethit(num) {
  var name = 'x-fn-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, 'hit')
    next()
  }
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
