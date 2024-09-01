const { it, describe } = require('mocha')
const series = require('run-series')
const Buffer = require('safe-buffer').Buffer
const methods = require('methods')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert
const createHitHandle = utils.createHitHandle
const createServer = utils.createServer
const rawrequest = utils.rawrequest
const request = utils.request
const shouldHaveBody = utils.shouldHaveBody
const shouldHitHandle = utils.shouldHitHandle
const shouldNotHaveBody = utils.shouldNotHaveBody
const shouldNotHitHandle = utils.shouldNotHitHandle

const describePromises = global.Promise ? describe : describe.skip

describe('Router', function () {
  it('should return a function', function () {
    assert.equal(typeof Router(), 'function')
  })

  it('should return a function using new', function () {
    assert.equal(typeof (new Router()), 'function')
  })

  it('should reject missing callback', function () {
    const router = new Router()
    assert.throws(function () { router({}, {}) }, /argument callback is required/)
  })

  it('should invoke callback without "req.url"', function (done) {
    const router = new Router()
    router.use(saw)
    router({}, {}, done)
  })

  describe('.all(path, fn)', function () {
    it('should be chainable', function () {
      const router = new Router()
      assert.equal(router.all('/', helloWorld), router)
    })

    it('should respond to all methods', function (done) {
      const router = new Router()
      const server = createServer(router)
      router.all('/', helloWorld)

      series(methods.map(function (method) {
        return function (cb) {
          if (method === 'connect') {
            // CONNECT is tricky and supertest doesn't support it
            return cb()
          }
          if (method === 'query' && process.version.startsWith('v21')) {
            return cb()
          }

          const body = method !== 'head'
            ? shouldHaveBody(Buffer.from('hello, world'))
            : shouldNotHaveBody()

          request(server)[method]('/')
            .expect(200)
            .expect(body)
            .end(cb)
        }
      }), done)
    })

    it('should support array of paths', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.all(['/foo', '/bar'], saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /foo', cb)
        },
        function (cb) {
          request(server)
            .get('/bar')
            .expect(200, 'saw GET /bar', cb)
        }
      ], done)
    })

    it('should support regexp path', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.all(/^\/[a-z]oo$/, saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /foo', cb)
        },
        function (cb) {
          request(server)
            .get('/zoo')
            .expect(200, 'saw GET /zoo', cb)
        }
      ], done)
    })

    it('should support parameterized path', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.all('/:thing', saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /foo', cb)
        },
        function (cb) {
          request(server)
            .get('/bar')
            .expect(200, 'saw GET /bar', cb)
        },
        function (cb) {
          request(server)
            .get('/foo/bar')
            .expect(404, cb)
        }
      ], done)
    })

    it('should not stack overflow with many registered routes', function (done) {
      this.timeout(5000) // long-running test

      const router = new Router()
      const server = createServer(router)

      for (let i = 0; i < 6000; i++) {
        router.get('/thing' + i, helloWorld)
      }

      router.get('/', helloWorld)

      request(server)
        .get('/')
        .expect(200, 'hello, world', done)
    })

    it('should not stack overflow with a large sync stack', function (done) {
      this.timeout(5000) // long-running test

      const router = new Router()
      const server = createServer(router)

      for (let i = 0; i < 6000; i++) {
        router.get('/foo', function (req, res, next) { next() })
      }

      router.get('/foo', helloWorld)

      request(server)
        .get('/foo')
        .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.all('/foo/bar', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /foo/bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(200, 'saw GET /FOO/bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(200, 'saw GET /FOO/BAR', cb)
          }
        ], done)
      })

      it('should not match paths case-sensitively when false', function (done) {
        const router = new Router({ caseSensitive: false })
        const server = createServer(router)

        router.all('/foo/bar', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /foo/bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(200, 'saw GET /FOO/bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(200, 'saw GET /FOO/BAR', cb)
          }
        ], done)
      })

      it('should match paths case-sensitively when true', function (done) {
        const router = new Router({ caseSensitive: true })
        const server = createServer(router)

        router.all('/foo/bar', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /foo/bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(404, cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(404, cb)
          }
        ], done)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.all('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /foo', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(200, 'saw GET /foo/', cb)
          }
        ], done)
      })

      it('should accept optional trailing slashes when false', function (done) {
        const router = new Router({ strict: false })
        const server = createServer(router)

        router.all('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /foo', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(200, 'saw GET /foo/', cb)
          }
        ], done)
      })

      it('should not accept optional trailing slashes when true', function (done) {
        const router = new Router({ strict: true })
        const server = createServer(router)

        router.all('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /foo', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(404, cb)
          }
        ], done)
      })
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

    describe('.' + method + '(path, ...fn)', function () {
      it('should be chainable', function () {
        const router = new Router()
        assert.equal(router[method]('/', helloWorld), router)
      })

      it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
        const router = new Router()
        const server = createServer(router)

        router[method]('/', helloWorld)

        request(server)[method]('/')
          .expect(200)
          .expect(body)
          .end(done)
      })

      it('should reject invalid fn', function () {
        const router = new Router()
        assert.throws(router[method].bind(router, '/', 2), /argument handler must be a function/)
      })

      it('should support array of paths', function (done) {
        const router = new Router()
        const server = createServer(router)

        router[method](['/foo', '/bar'], createHitHandle(1), helloWorld)
        series([
          function (cb) {
            request(server)[method]('/')
              .expect(404)
              .expect(shouldNotHitHandle(1))
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/foo')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/bar')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          }
        ], done)
      })

      it('should support regexp path', function (done) {
        const router = new Router()
        const server = createServer(router)

        router[method](/^\/[a-z]oo$/, createHitHandle(1), helloWorld)
        series([
          function (cb) {
            request(server)[method]('/')
              .expect(404)
              .expect(shouldNotHitHandle(1))
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/foo')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/zoo')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          }
        ], done)
      })

      it('should support parameterized path', function (done) {
        const router = new Router()
        const server = createServer(router)

        router[method]('/:thing', createHitHandle(1), helloWorld)

        series([
          function (cb) {
            request(server)[method]('/')
              .expect(404)
              .expect(shouldNotHitHandle(1))
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/foo')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/bar')
              .expect(200)
              .expect(shouldHitHandle(1))
              .expect(body)
              .end(cb)
          },
          function (cb) {
            request(server)[method]('/foo/bar')
              .expect(404)
              .expect(shouldNotHitHandle(1))
              .end(cb)
          }
        ], done)
      })

      it('should accept multiple arguments', function (done) {
        const router = new Router()
        const server = createServer(router)

        router[method]('/', createHitHandle(1), createHitHandle(2), helloWorld)

        request(server)[method]('/')
          .expect(200)
          .expect(shouldHitHandle(1))
          .expect(shouldHitHandle(2))
          .expect(body)
          .end(done)
      })

      describe('req.baseUrl', function () {
        it('should be empty', function (done) {
          const router = new Router()
          const server = createServer(router)

          router[method]('/foo', function handle (req, res) {
            res.setHeader('x-url-base', JSON.stringify(req.baseUrl))
            res.end()
          })

          request(server)[method]('/foo')
            .expect('x-url-base', '""')
            .expect(200, done)
        })
      })

      describe('req.route', function () {
        it('should be a Route', function (done) {
          const router = new Router()
          const server = createServer(router)

          router[method]('/foo', function handle (req, res) {
            res.setHeader('x-is-route', String(req.route instanceof Router.Route))
            res.end()
          })

          request(server)[method]('/foo')
            .expect('x-is-route', 'true')
            .expect(200, done)
        })

        it('should be the matched route', function (done) {
          const router = new Router()
          const server = createServer(router)

          router[method]('/foo', function handle (req, res) {
            res.setHeader('x-is-route', String(req.route.path === '/foo'))
            res.end()
          })

          request(server)[method]('/foo')
            .expect('x-is-route', 'true')
            .expect(200, done)
        })
      })
    })
  })

  describe('.use(...fn)', function () {
    it('should reject missing functions', function () {
      const router = new Router()
      assert.throws(router.use.bind(router), /argument handler is required/)
    })

    it('should reject empty array', function () {
      const router = new Router()
      assert.throws(router.use.bind(router, []), /argument handler is required/)
    })

    it('should reject non-functions', function () {
      const router = new Router()
      assert.throws(router.use.bind(router, '/', 'hello'), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', 5), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', null), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', new Date()), /argument handler must be a function/)
    })

    it('should be chainable', function () {
      const router = new Router()
      assert.equal(router.use(helloWorld), router)
    })

    it('should invoke function for all requests', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(saw)

      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(200, 'saw GET /', cb)
        },
        function (cb) {
          request(server)
            .put('/')
            .expect(200, 'saw PUT /', cb)
        },
        function (cb) {
          request(server)
            .post('/foo')
            .expect(200, 'saw POST /foo', cb)
        },
        function (cb) {
          rawrequest(server)
            .options('*')
            .expect(200, 'saw OPTIONS *', cb)
        }
      ], done)
    })

    it('should not invoke for blank URLs', function (done) {
      const router = new Router()
      const server = createServer(function hander (req, res, next) {
        req.url = ''
        router(req, res, next)
      })

      router.use(saw)

      request(server)
        .get('/')
        .expect(404, done)
    })

    it('should support another router', function (done) {
      const inner = new Router()
      const router = new Router()
      const server = createServer(router)

      inner.use(saw)
      router.use(inner)

      request(server)
        .get('/')
        .expect(200, 'saw GET /', done)
    })

    it('should accept multiple arguments', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(createHitHandle(1), createHitHandle(2), helloWorld)

      request(server)
        .get('/')
        .expect(shouldHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(200, 'hello, world', done)
    })

    it('should accept single array of middleware', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use([createHitHandle(1), createHitHandle(2), helloWorld])

      request(server)
        .get('/')
        .expect(shouldHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(200, 'hello, world', done)
    })

    it('should accept nested arrays of middleware', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

      request(server)
        .get('/')
        .expect(shouldHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(shouldHitHandle(3))
        .expect(200, 'hello, world', done)
    })

    it('should not invoke singular error function', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(function handleError (err, req, res, next) {
        throw err || new Error('boom!')
      })

      request(server)
        .get('/')
        .expect(404, done)
    })

    it('should not stack overflow with a large sync stack', function (done) {
      this.timeout(5000) // long-running test

      const router = new Router()
      const server = createServer(router)

      for (let i = 0; i < 6000; i++) {
        router.use(function (req, res, next) { next() })
      }

      router.use(helloWorld)

      request(server)
        .get('/')
        .expect(200, 'hello, world', done)
    })

    describe('error handling', function () {
      it('should invoke error function after next(err)', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function handle (req, res, next) {
          next(new Error('boom!'))
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect(200, 'saw Error: boom!', done)
      })

      it('should invoke error function after throw err', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function handle (req, res, next) {
          throw new Error('boom!')
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect(200, 'saw Error: boom!', done)
      })

      it('should not invoke error functions above function', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(sawError)

        router.use(function handle (req, res, next) {
          throw new Error('boom!')
        })

        request(server)
          .get('/')
          .expect(500, done)
      })
    })

    describe('next("route")', function () {
      it('should invoke next handler', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function handle (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        router.use(saw)

        request(server)
          .get('/')
          .expect('x-next', 'route')
          .expect(200, 'saw GET /', done)
      })

      it('should invoke next function', function (done) {
        const router = new Router()
        const server = createServer(router)

        function goNext (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        }

        router.use(createHitHandle(1), goNext, createHitHandle(2), saw)

        request(server)
          .get('/')
          .expect(shouldHitHandle(1))
          .expect('x-next', 'route')
          .expect(shouldHitHandle(2))
          .expect(200, 'saw GET /', done)
      })

      it('should not invoke error handlers', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function handle (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect('x-next', 'route')
          .expect(404, done)
      })
    })

    describe('next("router")', function () {
      it('should exit the router', function (done) {
        const router = new Router()
        const server = createServer(router)

        function handle (req, res, next) {
          res.setHeader('x-next', 'router')
          next('router')
        }

        router.use(handle, createHitHandle(1))
        router.use(saw)

        request(server)
          .get('/')
          .expect('x-next', 'router')
          .expect(shouldNotHitHandle(1))
          .expect(404, done)
      })

      it('should not invoke error handlers', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function handle (req, res, next) {
          res.setHeader('x-next', 'router')
          next('route')
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect('x-next', 'router')
          .expect(404, done)
      })
    })

    describePromises('promise support', function () {
      it('should pass rejected promise value', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function createError (req, res, next) {
          return Promise.reject(new Error('boom!'))
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect(200, 'saw Error: boom!', done)
      })

      it('should pass rejected promise without value', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function createError (req, res, next) {
          return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
        })

        router.use(sawError)

        request(server)
          .get('/')
          .expect(200, 'saw Error: Rejected promise', done)
      })

      it('should ignore resolved promise', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(function createError (req, res, next) {
          saw(req, res)
          return Promise.resolve('foo')
        })

        router.use(function () {
          done(new Error('Unexpected middleware invoke'))
        })

        request(server)
          .get('/foo')
          .expect(200, 'saw GET /foo', done)
      })

      describe('error handling', function () {
        it('should pass rejected promise value', function (done) {
          const router = new Router()
          const server = createServer(router)

          router.use(function createError (req, res, next) {
            return Promise.reject(new Error('boom!'))
          })

          router.use(function handleError (err, req, res, next) {
            return Promise.reject(new Error('caught: ' + err.message))
          })

          router.use(sawError)

          request(server)
            .get('/')
            .expect(200, 'saw Error: caught: boom!', done)
        })

        it('should pass rejected promise without value', function (done) {
          const router = new Router()
          const server = createServer(router)

          router.use(function createError (req, res, next) {
            return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
          })

          router.use(function handleError (err, req, res, next) {
            return Promise.reject(new Error('caught: ' + err.message))
          })

          router.use(sawError)

          request(server)
            .get('/')
            .expect(200, 'saw Error: caught: Rejected promise', done)
        })

        it('should ignore resolved promise', function (done) {
          const router = new Router()
          const server = createServer(router)

          router.use(function createError (req, res, next) {
            return Promise.reject(new Error('boom!'))
          })

          router.use(function handleError (err, req, res, next) {
            sawError(err, req, res, next)
            return Promise.resolve('foo')
          })

          router.use(function () {
            done(new Error('Unexpected middleware invoke'))
          })

          request(server)
            .get('/foo')
            .expect(200, 'saw Error: boom!', done)
        })
      })
    })

    describe('req.baseUrl', function () {
      it('should be empty', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use(sawBase)

        request(server)
          .get('/foo/bar')
          .expect(200, 'saw ', done)
      })
    })
  })

  describe('.use(path, ...fn)', function () {
    it('should be chainable', function () {
      const router = new Router()
      assert.equal(router.use('/', helloWorld), router)
    })

    it('should invoke when req.url starts with path', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use('/foo', saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .post('/foo')
            .expect(200, 'saw POST /', cb)
        },
        function (cb) {
          request(server)
            .post('/foo/bar')
            .expect(200, 'saw POST /bar', cb)
        }
      ], done)
    })

    it('should match if path has trailing slash', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use('/foo/', saw)

      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .post('/foo')
            .expect(200, 'saw POST /', cb)
        },
        function (cb) {
          request(server)
            .post('/foo/bar')
            .expect(200, 'saw POST /bar', cb)
        }
      ], done)
    })

    it('should support array of paths', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(['/foo/', '/bar'], saw)

      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /', cb)
        },
        function (cb) {
          request(server)
            .get('/bar')
            .expect(200, 'saw GET /', cb)
        }
      ], done)
    })

    it('should support regexp path', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(/^\/[a-z]oo/, saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /', cb)
        },
        function (cb) {
          request(server)
            .get('/fooo')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/zoo/bear')
            .expect(200, 'saw GET /bear', cb)
        },
        function (cb) {
          request(server)
            .get('/get/zoo')
            .expect(404, cb)
        }
      ], done)
    })

    it('should ensure regexp matches path prefix', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use(/\/api.*/, createHitHandle(1))
      router.use(/api/, createHitHandle(2))
      router.use(/\/test/, createHitHandle(3))
      router.use(helloWorld)

      request(server)
        .get('/test/api/1234')
        .expect(shouldNotHitHandle(1))
        .expect(shouldNotHitHandle(2))
        .expect(shouldHitHandle(3))
        .expect(200, done)
    })

    it('should support parameterized path', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use('/:thing', saw)
      series([
        function (cb) {
          request(server)
            .get('/')
            .expect(404, cb)
        },
        function (cb) {
          request(server)
            .get('/foo')
            .expect(200, 'saw GET /', cb)
        },
        function (cb) {
          request(server)
            .get('/bar')
            .expect(200, 'saw GET /', cb)
        },
        function (cb) {
          request(server)
            .get('/foo/bar')
            .expect(200, 'saw GET /bar', cb)
        }
      ], done)
    })

    it('should accept multiple arguments', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.use('/foo', createHitHandle(1), createHitHandle(2), helloWorld)

      request(server)
        .get('/foo')
        .expect(shouldHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(200, 'saw GET /bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(200, 'saw GET /BAR', cb)
          }
        ], done)
      })

      it('should not match paths case-sensitively when false', function (done) {
        const router = new Router({ caseSensitive: false })
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(200, 'saw GET /bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(200, 'saw GET /BAR', cb)
          }
        ], done)
      })

      it('should match paths case-sensitively when true', function (done) {
        const router = new Router({ caseSensitive: true })
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo/bar')
              .expect(200, 'saw GET /bar', cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/bar')
              .expect(404, cb)
          },
          function (cb) {
            request(server)
              .get('/FOO/BAR')
              .expect(404, cb)
          }
        ], done)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(200, 'saw GET /', cb)
          }
        ], done)
      })

      it('should accept optional trailing slashes when false', function (done) {
        const router = new Router({ strict: false })
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(200, 'saw GET /', cb)
          }
        ], done)
      })

      it('should accept optional trailing slashes when true', function (done) {
        const router = new Router({ strict: true })
        const server = createServer(router)

        router.use('/foo', saw)
        series([
          function (cb) {
            request(server)
              .get('/foo')
              .expect(200, 'saw GET /', cb)
          },
          function (cb) {
            request(server)
              .get('/foo/')
              .expect(200, 'saw GET /', cb)
          }
        ], done)
      })
    })

    describe('next("route")', function () {
      it('should invoke next handler', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', function handle (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        })

        router.use('/foo', saw)

        request(server)
          .get('/foo')
          .expect('x-next', 'route')
          .expect(200, 'saw GET /', done)
      })

      it('should invoke next function', function (done) {
        const router = new Router()
        const server = createServer(router)

        function goNext (req, res, next) {
          res.setHeader('x-next', 'route')
          next('route')
        }

        router.use('/foo', createHitHandle(1), goNext, createHitHandle(2), saw)

        request(server)
          .get('/foo')
          .expect(shouldHitHandle(1))
          .expect('x-next', 'route')
          .expect(shouldHitHandle(2))
          .expect(200, 'saw GET /', done)
      })
    })

    describe('req.baseUrl', function () {
      it('should contain the stripped path', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', sawBase)

        request(server)
          .get('/foo/bar')
          .expect(200, 'saw /foo', done)
      })

      it('should contain the stripped path for multiple levels', function (done) {
        const router1 = new Router()
        const router2 = new Router()
        const server = createServer(router1)

        router1.use('/foo', router2)
        router2.use('/bar', sawBase)

        request(server)
          .get('/foo/bar/baz')
          .expect(200, 'saw /foo/bar', done)
      })

      it('should be altered correctly', function (done) {
        const router = new Router()
        const server = createServer(router)
        const sub1 = new Router()
        const sub2 = new Router()
        const sub3 = new Router()

        sub3.get('/zed', setsawBase(1))

        sub2.use('/baz', sub3)

        sub1.use('/', setsawBase(2))

        sub1.use('/bar', sub2)
        sub1.use('/bar', setsawBase(3))

        router.use(setsawBase(4))
        router.use('/foo', sub1)
        router.use(setsawBase(5))
        router.use(helloWorld)

        request(server)
          .get('/foo/bar/baz/zed')
          .expect('x-saw-base-1', '/foo/bar/baz')
          .expect('x-saw-base-2', '/foo')
          .expect('x-saw-base-3', '/foo/bar')
          .expect('x-saw-base-4', '')
          .expect('x-saw-base-5', '')
          .expect(200, done)
      })
    })

    describe('req.url', function () {
      it('should strip path from req.url', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', saw)

        request(server)
          .get('/foo/bar')
          .expect(200, 'saw GET /bar', done)
      })

      it('should restore req.url after stripping', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', setsaw(1))
        router.use(saw)

        request(server)
          .get('/foo/bar')
          .expect('x-saw-1', 'GET /bar')
          .expect(200, 'saw GET /foo/bar', done)
      })

      it('should strip/restore with trailing stash', function (done) {
        const router = new Router()
        const server = createServer(router)

        router.use('/foo', setsaw(1))
        router.use(saw)

        request(server)
          .get('/foo/')
          .expect('x-saw-1', 'GET /')
          .expect(200, 'saw GET /foo/', done)
      })
    })
  })

  describe('request rewriting', function () {
    it('should support altering req.method', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.put('/foo', createHitHandle(1))
      router.post('/foo', createHitHandle(2), function (req, res, next) {
        req.method = 'PUT'
        next()
      })

      router.post('/foo', createHitHandle(3))
      router.put('/foo', createHitHandle(4))
      router.use(saw)

      request(server)
        .post('/foo')
        .expect(shouldNotHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(shouldNotHitHandle(3))
        .expect(shouldHitHandle(4))
        .expect(200, 'saw PUT /foo', done)
    })

    it('should support altering req.url', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.get('/bar', createHitHandle(1))
      router.get('/foo', createHitHandle(2), function (req, res, next) {
        req.url = '/bar'
        next()
      })

      router.get('/foo', createHitHandle(3))
      router.get('/bar', createHitHandle(4))
      router.use(saw)

      request(server)
        .get('/foo')
        .expect(shouldNotHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(shouldNotHitHandle(3))
        .expect(shouldHitHandle(4))
        .expect(200, 'saw GET /bar', done)
    })
  })
})

function helloWorld (req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('hello, world')
}

function setsaw (num) {
  const name = 'x-saw-' + String(num)
  return function saw (req, res, next) {
    res.setHeader(name, req.method + ' ' + req.url)
    next()
  }
}

function setsawBase (num) {
  const name = 'x-saw-base-' + String(num)
  return function sawBase (req, res, next) {
    res.setHeader(name, String(req.baseUrl))
    next()
  }
}

function saw (req, res) {
  const msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sawError (err, req, res, next) {
  const msg = 'saw ' + err.name + ': ' + err.message
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sawBase (req, res) {
  const msg = 'saw ' + req.baseUrl
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}
