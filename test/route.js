const { it, describe } = require('mocha')
const Buffer = require('safe-buffer').Buffer
const methods = require('methods')
const series = require('run-series')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert
const createHitHandle = utils.createHitHandle
const createServer = utils.createServer
const request = utils.request
const shouldHaveBody = utils.shouldHaveBody
const shouldHitHandle = utils.shouldHitHandle
const shouldNotHaveBody = utils.shouldNotHaveBody
const shouldNotHitHandle = utils.shouldNotHitHandle

const describePromises = global.Promise ? describe : describe.skip

describe('Router', function () {
  describe('.route(path)', function () {
    it('should return a new route', function () {
      const router = new Router()
      const route = router.route('/foo')
      assert.equal(route.path, '/foo')
    })

    it('should respond to multiple methods', function (done) {
      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(router)

      route.get(saw)
      route.post(saw)

      series([
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /foo', cb)
        },
        function (cb) {
          request(server)
            .post('/foo')
            .expect(200, 'saw POST /foo', cb)
        },
        function (cb) {
          request(server)
            .put('/foo')
            .expect(404, cb)
        }
      ], done)
    })

    it('should route without method', function (done) {
      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(function (req, res, next) {
        req.method = undefined
        router(req, res, next)
      })

      route.post(createHitHandle(1))
      route.all(createHitHandle(2))
      route.get(createHitHandle(3))

      router.get('/foo', createHitHandle(4))
      router.use(saw)

      request(server)
        .get('/foo')
        .expect(shouldNotHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(shouldNotHitHandle(3))
        .expect(shouldNotHitHandle(4))
        .expect(200, 'saw undefined /foo', done)
    })

    it('should stack', function (done) {
      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(router)

      route.post(createHitHandle(1))
      route.all(createHitHandle(2))
      route.get(createHitHandle(3))

      router.use(saw)

      series([
        function (cb) {
          request(server)
            .get('/foo')
            .expect('x-fn-2', 'hit')
            .expect('x-fn-3', 'hit')
            .expect(200, 'saw GET /foo', cb)
        },
        function (cb) {
          request(server)
            .post('/foo')
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect(200, 'saw POST /foo', cb)
        },
        function (cb) {
          request(server)
            .put('/foo')
            .expect('x-fn-2', 'hit')
            .expect(200, 'saw PUT /foo', cb)
        }
      ], done)
    })

    it('should not error on empty route', function (done) {
      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(router)

      assert.ok(route)

      series([
        function (cb) {
          request(server)
            .get('/foo')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .head('/foo')
            .expect(404, cb)
        }
      ], done)
    })

    it('should not invoke singular error route', function (done) {
      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(router)

      route.all(function handleError (err, req, res, next) {
        throw err || new Error('boom!')
      })

      request(server)
        .get('/foo')
        .expect(404, done)
    })

    it('should not stack overflow with a large sync stack', function (done) {
      this.timeout(5000) // long-running test

      const router = new Router()
      const route = router.route('/foo')
      const server = createServer(router)

      for (let i = 0; i < 6000; i++) {
        route.all(function (req, res, next) { next() })
      }

      route.get(helloWorld)

      request(server)
        .get('/foo')
        .expect(200, 'hello, world', done)
    })

    describe('.all(...fn)', function () {
      it('should reject no arguments', function () {
        const router = new Router()
        const route = router.route('/')
        assert.throws(route.all.bind(route), /argument handler is required/)
      })

      it('should reject empty array', function () {
        const router = new Router()
        const route = router.route('/')
        assert.throws(route.all.bind(route, []), /argument handler is required/)
      })

      it('should reject invalid fn', function () {
        const router = new Router()
        const route = router.route('/')
        assert.throws(route.all.bind(route, 2), /argument handler must be a function/)
      })

      it('should respond to all methods', function (done) {
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

        route.all(saw)

        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /foo', cb)
          },
          function (cb) {
            request(server)
              .post('/foo')
              .expect(200, 'saw POST /foo', cb)
          },
          function (cb) {
            request(server)
              .put('/foo')
              .expect(200, 'saw PUT /foo', cb)
          }
        ], done)
      })

      it('should accept multiple arguments', function (done) {
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

        route.all(createHitHandle(1), createHitHandle(2), helloWorld)

        request(server)
          .get('/foo')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect(200, 'hello, world', done)
      })

      it('should accept single array of handlers', function (done) {
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

        route.all([createHitHandle(1), createHitHandle(2), helloWorld])

        request(server)
          .get('/foo')
          .expect('x-fn-1', 'hit')
          .expect('x-fn-2', 'hit')
          .expect(200, 'hello, world', done)
      })

      it('should accept nested arrays of handlers', function (done) {
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
      if (method === 'query' && process.version.startsWith('v21')) {
        return
      }

      const body = method !== 'head'
        ? shouldHaveBody(Buffer.from('hello, world'))
        : shouldNotHaveBody()

      describe('.' + method + '(...fn)', function () {
        it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
          const router = new Router()
          const route = router.route('/')
          const server = createServer(router)

          route[method](helloWorld)

          request(server)[method]('/')
            .expect(200)
            .expect(body)
            .end(done)
        })

        it('should reject no arguments', function () {
          const router = new Router()
          const route = router.route('/')
          assert.throws(route[method].bind(route), /argument handler is required/)
        })

        it('should reject empty array', function () {
          const router = new Router()
          const route = router.route('/')
          assert.throws(route[method].bind(route, []), /argument handler is required/)
        })

        it('should reject invalid fn', function () {
          const router = new Router()
          const route = router.route('/')
          assert.throws(route[method].bind(route, 2), /argument handler must be a function/)
        })

        it('should accept multiple arguments', function (done) {
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

          route[method](createHitHandle(1), createHitHandle(2), helloWorld)

          request(server)[method]('/foo')
            .expect(200)
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect(body)
            .end(done)
        })

        it('should accept single array of handlers', function (done) {
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

          route[method]([createHitHandle(1), createHitHandle(2), helloWorld])

          request(server)[method]('/foo')
            .expect(200)
            .expect('x-fn-1', 'hit')
            .expect('x-fn-2', 'hit')
            .expect(body)
            .end(done)
        })

        it('should accept nested arrays of handlers', function (done) {
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
        const router = new Router()
        const route = router.route('/foo')
        const server = createServer(router)

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
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

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
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

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
          const router = new Router()
          const route = router.route('/foo')
          const server = createServer(router)

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
          const router = new Router()
          const route = router.route('/:foo')
          const server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/bar')
            .expect(200, { foo: 'bar' }, done)
        })

        it('should match single path segment', function (done) {
          const router = new Router()
          const route = router.route('/:foo')
          const server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/bar/bar')
            .expect(404, done)
        })

        it('should work multiple times', function (done) {
          const router = new Router()
          const route = router.route('/:foo/:bar')
          const server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/fizz/buzz')
            .expect(200, { foo: 'fizz', bar: 'buzz' }, done)
        })

        it('should work inside literal paranthesis', function (done) {
          const router = new Router()
          const route = router.route('/:user\\(:op\\)')
          const server = createServer(router)

          route.all(sendParams)

          request(server)
            .get('/tj(edit)')
            .expect(200, { user: 'tj', op: 'edit' }, done)
        })

        it('should work within arrays', function (done) {
          const router = new Router()
          const route = router.route(['/user/:user/poke', '/user/:user/pokes'])
          const server = createServer(router)

          route.all(sendParams)
          series([
            function (cb) {
              request(server)
                .get('/user/tj/poke')
                .expect(200, { user: 'tj' }, cb)
            },
            function (cb) {
              request(server)
                .get('/user/tj/pokes')
                .expect(200, { user: 'tj' }, cb)
            }
          ], done)
        })
      })

      describe('using "{:name}"', function () {
        it('should name an optional parameter', function (done) {
          const router = new Router()
          const route = router.route('{/:foo}')
          const server = createServer(router)

          route.all(sendParams)
          series([
            function (cb) {
              request(server)
                .get('/bar')
                .expect(200, { foo: 'bar' }, cb)
            },
            function (cb) {
              request(server)
                .get('/')
                .expect(200, {}, cb)
            }
          ], done)
        })

        it('should work in any segment', function (done) {
          const router = new Router()
          const route = router.route('/user{/:foo}/delete')
          const server = createServer(router)

          route.all(sendParams)
          series([
            function (cb) {
              request(server)
                .get('/user/bar/delete')
                .expect(200, { foo: 'bar' }, cb)
            },
            function (cb) {
              request(server)
                .get('/user/delete')
                .expect(200, {}, cb)
            }
          ], done)
        })
      })

      describe('using "*name"', function () {
        it('should name a zero-or-more repeated parameter', function (done) {
          const router = new Router()
          const route = router.route('{/*foo}')
          const server = createServer(router)

          route.all(sendParams)
          series([
            function (cb) {
              request(server)
                .get('/')
                .expect(200, {}, cb)
            },
            function (cb) {
              request(server)
                .get('/bar')
                .expect(200, { foo: [ 'bar' ] }, cb)
            },
            function (cb) {
              request(server)
                .get('/fizz/buzz')
                .expect(200, { foo: [ 'fizz', 'buzz' ] }, cb)
            }
          ], done)
        })

        it('should work in any segment', function (done) {
          const router = new Router()
          const route = router.route('/user{/*foo}/delete')
          const server = createServer(router)

          route.all(sendParams)
          series([
            function (cb) {
              request(server)
                .get('/user/delete')
                .expect(200, {}, cb)
            },
            function (cb) {
              request(server)
                .get('/user/bar/delete')
                .expect(200, { foo: [ 'bar' ] }, cb)
            },
            function (cb) {
              request(server)
                .get('/user/fizz/buzz/delete')
                .expect(200, { foo: [ 'fizz', 'buzz' ] }, cb)
            }
          ], done)
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
  const msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sendParams (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(req.params))
}
