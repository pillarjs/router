
var after = require('after')
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createServer = utils.createServer
var request = utils.request

describe('Engine', function () {
  var Engine = Router.Engine

  it('should return a function', function () {
    assert.equal(typeof Engine(), 'function')
  })

  it('should return a function using new', function () {
    assert.equal(typeof (new Engine()), 'function')
  })

  describe('errors', function () {
    it('should throw when omitting Engine#use path', function () {
      assert.throws(function() {
        Engine.prototype.use.call({})
      }, /argument path is required/)
    })

    it('should throw when omitting Engine#use match', function () {
      assert.throws(function() {
        Engine.prototype.use.call({}, '/foo')
      }, /argument match is required/)
    })

    it('should throw when Engine#use match is not a function', function () {
      assert.throws(function() {
        Engine.prototype.use.call({}, '/foo', {})
      }, /argument match must be a function/)
    })

    it('should throw when Engine#use has a no handlers', function () {
      assert.throws(function() {
        Engine.prototype.use.call({}, '/foo', function () {}, [])
      }, /argument handler is required/)
    })

    it('should throw when omitting Engine#route path', function () {
      assert.throws(function() {
        Engine.prototype.route.call({})
      }, /argument path is required/)
    })

    it('should throw when omitting Engine#route match', function () {
      assert.throws(function() {
        Engine.prototype.route.call({}, '/foo')
      }, /argument match is required/)
    })

    it('should throw when Engine#route match is not a function', function () {
      assert.throws(function() {
        Engine.prototype.route.call({}, '/foo', {})
      }, /argument match must be a function/)
    })
  })

  describe('custom router', function () {
    var slice = Array.prototype.slice

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

    function ExactRouter (options) {
      return Engine.call(this, options)
    }

    ExactRouter.prototype = Object.create(Engine.prototype)

    ExactRouter.prototype.use = function () {
      var opts = Engine.sanitizeUse.apply(null, arguments)
      var match = toFunction(opts.path, { end: false })

      return Engine.prototype.use.call(this, opts.path, match, opts.callbacks)
    }

    ExactRouter.prototype.route = function (path) {
      var match = toFunction(path, { end: true })

      return Engine.prototype.route.call(this, path, match)
    }

    Engine.methods.forEach(function (method) {
      ExactRouter.prototype[method] = function (path) {
        var route = this.route(path)
        route[method].apply(route, slice.call(arguments, 1))
        return this
      }
    })

    describe('.all(path, fn)', function () {
      it('should respond to all methods', function (done) {
        var cb = after(methods.length, done)
        var router = new ExactRouter()
        var server = createServer(router)
        router.all('/', helloWorld)

        methods.forEach(function (method) {
          if (method === 'connect') {
            // CONNECT is tricky and supertest doesn't support it
            return cb()
          }

          var body = method !== 'head'
            ? 'hello, world'
            : ''

          request(server)
          [method]('/')
          .expect(200, body, cb)
        })
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

      describe('.' + method + '(path, ...fn)', function () {
        it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
          var router = new ExactRouter()
          var server = createServer(router)

          router[method]('/', helloWorld)

          request(server)
          [method]('/')
          .expect(200, body, done)
        })

        it('should accept multiple arguments', function (done) {
          var router = new ExactRouter()
          var server = createServer(router)

          router[method]('/bar', sethit(1), sethit(2), helloWorld)

          request(server)
          [method]('/bar')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect(200, body, done)
        })
      })
    })

    describe('.use(...fn)', function () {
      it('should invoke function for all requests', function (done) {
        var cb = after(3, done)
        var router = new ExactRouter()
        var server = createServer(router)

        router.use(saw)

        request(server)
        .get('/')
        .expect(200, 'saw GET /', cb)

        request(server)
        .options('/')
        .expect(200, 'saw OPTIONS /', cb)

        request(server)
        .post('/foo')
        .expect(200, 'saw POST /foo', cb)
      })
    })
  })
})

function saw(req, res) {
  var msg = 'saw ' + req.method + ' ' + req.originalUrl
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

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
