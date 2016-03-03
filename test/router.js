
var after = require('after')
var methods = require('methods')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createServer = utils.createServer
var request = utils.request
var shouldHitHandle = utils.shouldHitHandle
var shouldNotHitHandle = utils.shouldNotHitHandle

describe('Router', function () {
  it('should return a function', function () {
    assert.equal(typeof Router(), 'function')
  })

  it('should return a function using new', function () {
    assert.equal(typeof (new Router()), 'function')
  })

  it('should reject missing callback', function () {
    var router = new Router()
    assert.throws(function () { router({}, {}) }, /argument callback is required/)
  })

  describe('.all(path, fn)', function () {
    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.all('/', helloWorld), router)
    })

    it('should respond to all methods', function (done) {
      var cb = after(methods.length, done)
      var router = new Router()
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

    it('should support array of paths', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.all(['/foo', '/bar'], saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /foo', cb)

      request(server)
      .get('/bar')
      .expect(200, 'saw GET /bar', cb)
    })

    it('should support regexp path', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.all(/^\/[a-z]oo$/, saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /foo', cb)

      request(server)
      .get('/zoo')
      .expect(200, 'saw GET /zoo', cb)
    })

    it('should support parameterized path', function (done) {
      var cb = after(4, done)
      var router = new Router()
      var server = createServer(router)

      router.all('/:thing', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /foo', cb)

      request(server)
      .get('/bar')
      .expect(200, 'saw GET /bar', cb)

      request(server)
      .get('/foo/bar')
      .expect(404, cb)
    })

    it('should not stack overflow with many registered routes', function (done) {
      var router = new Router()
      var server = createServer(router)

      for (var i = 0; i < 6000; i++) {
        router.get('/thing' + i, helloWorld)
      }

      router.get('/', helloWorld)

      request(server)
      .get('/')
      .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /FOO/bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /FOO/BAR', cb)
      })

      it('should not match paths case-sensitively when false', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: false })
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /FOO/bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /FOO/BAR', cb)
      })

      it('should match paths case-sensitively when true', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: true })
        var server = createServer(router)

        router.all('/foo/bar', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /foo/bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(404, 'Cannot GET /FOO/bar\n', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(404, 'Cannot GET /FOO/BAR\n', cb)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        var cb = after(2, done)
        var router = new Router()
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /foo/', cb)
      })

      it('should accept optional trailing slashes when false', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: false })
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /foo/', cb)
      })

      it('should not accept optional trailing slashes when true', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: true })
        var server = createServer(router)

        router.all('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /foo', cb)

        request(server)
        .get('/foo/')
        .expect(404, 'Cannot GET /foo/\n', cb)
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
      it('should be chainable', function () {
        var router = new Router()
        assert.equal(router[method]('/', helloWorld), router)
      })

      it('should respond to a ' + method.toUpperCase() + ' request', function (done) {
        var router = new Router()
        var server = createServer(router)

        router[method]('/', helloWorld)

        request(server)
        [method]('/')
        .expect(200, body, done)
      })

      it('should reject invalid fn', function () {
        var router = new Router()
        assert.throws(router[method].bind(router, '/', 2), /argument handler must be a function/)
      })

      it('should support array of paths', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router[method](['/foo', '/bar'], createHitHandle(1), helloWorld)

        request(server)
        [method]('/')
        .expect(shouldNotHitHandle(1))
        .expect(404, cb)

        request(server)
        [method]('/foo')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)

        request(server)
        [method]('/bar')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)
      })

      it('should support regexp path', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router[method](/^\/[a-z]oo$/, createHitHandle(1), helloWorld)

        request(server)
        [method]('/')
        .expect(shouldNotHitHandle(1))
        .expect(404, cb)

        request(server)
        [method]('/foo')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)

        request(server)
        [method]('/zoo')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)
      })

      it('should support parameterized path', function (done) {
        var cb = after(4, done)
        var router = new Router()
        var server = createServer(router)

        router[method]('/:thing', createHitHandle(1), helloWorld)

        request(server)
        [method]('/')
        .expect(shouldNotHitHandle(1))
        .expect(404, cb)

        request(server)
        [method]('/foo')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)

        request(server)
        [method]('/bar')
        .expect(shouldHitHandle(1))
        .expect(200, body, cb)

        request(server)
        [method]('/foo/bar')
        .expect(shouldNotHitHandle(1))
        .expect(404, cb)
      })

      it('should accept multiple arguments', function (done) {
        var router = new Router()
        var server = createServer(router)

        router[method]('/', createHitHandle(1), createHitHandle(2), helloWorld)

        request(server)
        [method]('/')
        .expect(shouldHitHandle(1))
        .expect(shouldHitHandle(2))
        .expect(200, body, done)
      })

      describe('req.baseUrl', function () {
        it('should be empty', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-url-base', JSON.stringify(req.baseUrl))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-url-base', '""')
          .expect(200, done)
        })
      })

      describe('req.route', function () {
        it('should be a Route', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-is-route', String(req.route instanceof Router.Route))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-is-route', 'true')
          .expect(200, done)
        })

        it('should be the matched route', function (done) {
          var router = new Router()
          var server = createServer(router)

          router[method]('/foo', function handle(req, res) {
            res.setHeader('x-is-route', String(req.route.path === '/foo'))
            res.end()
          })

          request(server)
          [method]('/foo')
          .expect('x-is-route', 'true')
          .expect(200, done)
        })
      })
    })
  })

  describe('.use(...fn)', function () {
    it('should reject missing functions', function () {
      var router = new Router()
      assert.throws(router.use.bind(router), /argument handler is required/)
    })

    it('should reject empty array', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, []), /argument handler is required/)
    })

    it('should reject non-functions', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, '/', 'hello'), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', 5), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', null), /argument handler must be a function/)
      assert.throws(router.use.bind(router, '/', new Date()), /argument handler must be a function/)
    })

    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.use(helloWorld), router)
    })

    it('should invoke function for all requests', function (done) {
      var cb = after(3, done)
      var router = new Router()
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

    it('should not invoke for blank URLs', function (done) {
      var router = new Router()
      var server = createServer(function hander(req, res, next) {
        req.url = ''
        router(req, res, next)
      })

      router.use(saw)

      request(server)
      .get('/')
      .expect(404, done)
    })

    it('should support another router', function (done) {
      var inner = new Router()
      var router = new Router()
      var server = createServer(router)

      inner.use(saw)
      router.use(inner)

      request(server)
      .get('/')
      .expect(200, 'saw GET /', done)
    })

    it('should accept multiple arguments', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use(createHitHandle(1), createHitHandle(2), helloWorld)

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(200, 'hello, world', done)
    })

    it('should accept single array of middleware', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use([createHitHandle(1), createHitHandle(2), helloWorld])

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(200, 'hello, world', done)
    })

    it('should accept nested arrays of middleware', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

      request(server)
      .get('/')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(shouldHitHandle(3))
      .expect(200, 'hello, world', done)
    })

    it('should not invoke singular error function', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use(function handleError(err, req, res, next) {
        throw new Error('boom!')
      })

      request(server)
      .get('/')
      .expect(404, done)
    })

    it('should support named handlers', function () {
      var router = new Router()

      var router2 = new Router()
      router.use(router2, 'router2')
      assert.notEqual(router.routes['router2'], undefined)
      assert.equal(router.routes['router2'].handler, router2)
      assert.equal(router.routes['router2'].path, '/')

      var router3 = new Router()
      router.use('/mypath', router3, 'router3')
      assert.notEqual(router.routes['router3'], undefined)
      assert.equal(router.routes['router3'].handler, router3)
      assert.equal(router.routes['router2'].handler, router2)
      assert.equal(router.routes['router3'].path, '/mypath')

      var router4 = new Router()
      router.use(router4, 'router4')
      assert.equal(router.routes['router4'].handler, router4)
      assert.equal(router.routes['router4'].path, '/')
    })

    it('should not allow duplicate names', function () {
      var router = new Router()
      router.use('/', new Router(), 'router1')
      assert.throws(router.use.bind(router, new Router(), 'router1'), /a route or handler named "router1" already exists/)
      router.route('/users', 'users')
      assert.throws(router.use.bind(router, new Router(), 'users'), /a route or handler named "users" already exists/)
    })

    it('should not allow empty names', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, new Router(), ''), /name should be a non-empty string/)
      assert.throws(router.use.bind(router, '/users', new Router(), ''), /name should be a non-empty string/)
    })

    it('should not support named handlers if handler is a function', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, '/', new Router(), new Router(), 'hello'), /Router.use cannot be called with multiple handlers if a name argument is used, each handler should have its own name/)
      assert.throws(router.use.bind(router, '/', function() {}, function () {}, 'hello'), /Router.use cannot be called with multiple handlers if a name argument is used, each handler should have its own name/)
      assert.throws(router.use.bind(router, '/', function(){}, 'hello'), /handler must implement findPath function if Router.use is called with a name argument/)
      assert.throws(router.use.bind(router, function(){}, 'hello'), /handler must implement findPath function if Router.use is called with a name argument/)
    })

    it('should not support named handlers unless path is a string', function () {
      var router = new Router()
      assert.throws(router.use.bind(router, ['/123', '/abc'], new Router(), '123abc'), /only paths that are strings can be named/)
      assert.throws(router.use.bind(router, /\/abc|\/xyz/, new Router(), '123abc'), /only paths that are strings can be named/)
    })

    describe('error handling', function () {
      it('should invoke error function after next(err)', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use(function handle(req, res, next) {
          next(new Error('boom!'))
        })

        router.use(sawError)

        request(server)
        .get('/')
        .expect(200, 'saw Error: boom!', done)
      })

      it('should invoke error function after throw err', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use(function handle(req, res, next) {
          throw new Error('boom!')
        })

        router.use(sawError)

        request(server)
        .get('/')
        .expect(200, 'saw Error: boom!', done)
      })

      it('should not invoke error functions above function', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use(sawError)

        router.use(function handle(req, res, next) {
          throw new Error('boom!')
        })

        request(server)
        .get('/')
        .expect(500, done)
      })
    })

    describe('req.baseUrl', function () {
      it('should be empty', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use(sawBase)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw ', done)
      })
    })
  })

  describe('.use(path, ...fn)', function () {
    it('should be chainable', function () {
      var router = new Router()
      assert.equal(router.use('/', helloWorld), router)
    })

    it('should invoke when req.url starts with path', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use('/foo', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /', cb)

      request(server)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb)
    })

    it('should match if path has trailing slash', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use('/foo/', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .post('/foo')
      .expect(200, 'saw POST /', cb)

      request(server)
      .post('/foo/bar')
      .expect(200, 'saw POST /bar', cb)
    })

    it('should support array of paths', function (done) {
      var cb = after(3, done)
      var router = new Router()
      var server = createServer(router)

      router.use(['/foo/', '/bar'], saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/bar')
      .expect(200, 'saw GET /', cb)
    })

    it('should support regexp path', function (done) {
      var cb = after(4, done)
      var router = new Router()
      var server = createServer(router)

      router.use(/^\/[a-z]oo/, saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/zoo/bear')
      .expect(200, 'saw GET /bear', cb)

      request(server)
      .get('/get/zoo')
      .expect(404, cb)
    })

    it('should support parameterized path', function (done) {
      var cb = after(4, done)
      var router = new Router()
      var server = createServer(router)

      router.use('/:thing', saw)

      request(server)
      .get('/')
      .expect(404, cb)

      request(server)
      .get('/foo')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/bar')
      .expect(200, 'saw GET /', cb)

      request(server)
      .get('/foo/bar')
      .expect(200, 'saw GET /bar', cb)
    })

    it('should accept multiple arguments', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.use('/foo', createHitHandle(1), createHitHandle(2), helloWorld)

      request(server)
      .get('/foo')
      .expect(shouldHitHandle(1))
      .expect(shouldHitHandle(2))
      .expect(200, 'hello, world', done)
    })

    describe('with "caseSensitive" option', function () {
      it('should not match paths case-sensitively by default', function (done) {
        var cb = after(3, done)
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /BAR', cb)
      })

      it('should not match paths case-sensitively when false', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: false })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(200, 'saw GET /BAR', cb)
      })

      it('should match paths case-sensitively when true', function (done) {
        var cb = after(3, done)
        var router = new Router({ caseSensitive: true })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', cb)

        request(server)
        .get('/FOO/bar')
        .expect(404, 'Cannot GET /FOO/bar\n', cb)

        request(server)
        .get('/FOO/BAR')
        .expect(404, 'Cannot GET /FOO/BAR\n', cb)
      })
    })

    describe('with "strict" option', function () {
      it('should accept optional trailing slashes by default', function (done) {
        var cb = after(2, done)
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })

      it('should accept optional trailing slashes when false', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: false })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })

      it('should accept optional trailing slashes when true', function (done) {
        var cb = after(2, done)
        var router = new Router({ strict: true })
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo')
        .expect(200, 'saw GET /', cb)

        request(server)
        .get('/foo/')
        .expect(200, 'saw GET /', cb)
      })
    })

    describe('req.baseUrl', function () {
      it('should contain the stripped path', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', sawBase)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw /foo', done)
      })

      it('should contain the stripped path for multiple levels', function (done) {
        var router1 = new Router()
        var router2 = new Router()
        var server = createServer(router1)

        router1.use('/foo', router2)
        router2.use('/bar', sawBase)

        request(server)
        .get('/foo/bar/baz')
        .expect(200, 'saw /foo/bar', done)
      })

      it('should be altered correctly', function(done){
        var router = new Router()
        var server = createServer(router)
        var sub1 = new Router()
        var sub2 = new Router()
        var sub3 = new Router()

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
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', saw)

        request(server)
        .get('/foo/bar')
        .expect(200, 'saw GET /bar', done)
      })

      it('should restore req.url after stripping', function (done) {
        var router = new Router()
        var server = createServer(router)

        router.use('/foo', setsaw(1))
        router.use(saw)

        request(server)
        .get('/foo/bar')
        .expect('x-saw-1', 'GET /bar')
        .expect(200, 'saw GET /foo/bar', done)
      })

      it('should strip/restore with trailing stash', function (done) {
        var router = new Router()
        var server = createServer(router)

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
      var router = new Router()
      var server = createServer(router)

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
      var router = new Router()
      var server = createServer(router)

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

  describe('.findPath(path)', function () {
    it('should only allow string paths', function() {
      var router = new Router()
      router.route('/users/:userid', 'users')
      assert.throws(router.findPath.bind(router, function(){}), /route path should be a string/)
      assert.throws(router.findPath.bind(router, new Router()), /route path should be a string/)
      assert.throws(router.findPath.bind(router, {}), /route path should be a string/)
      assert.throws(router.findPath.bind(router, new String('users'), {userid: 'user1'}), /route path should be a string/)
    })

    it('should return a path to a route', function () {
      var router = new Router()
      router.route('/users/:userid', 'users')
      var path = router.findPath('users',  {userid: 'user1'});
      assert.equal(path, '/users/user1')
      var path2 = router.findPath('users',  {userid: 'user2'});
      assert.equal(path2, '/users/user2')
    })

    it('should throw error if route cannot be matched', function () {
      var router = new Router()
      router.route('/users/:userid', 'users')
      assert.throws(router.findPath.bind(router, 'users.hello', {userid: 'user1'}), /part of route path "hello" does not match any named nested routes/)
      assert.throws(router.findPath.bind(router, 'hello', {userid: 'user1'}), /route path "hello" does not match any named routes/)
      assert.throws(router.findPath.bind(router, 'users', {abc: 'user1'}), /Expected "userid" to be defined/)
      assert.throws(router.findPath.bind(router, 'users', {}), /Expected "userid" to be defined/)
    })

    it('should support nested routers', function () {
      var routerA = new Router()
      var routerB = new Router()
      routerA.use('/base/:path', routerB, 'routerB')
      var r = routerB.route('/some/:thing', 'thing')
      var path = routerA.findPath('routerB.thing', {path: 'foo', thing: 'bar'})
      assert.equal(path, '/base/foo/some/bar')
      path = routerA.findPath('routerB', {path: 'foo'})
      assert.throws(routerA.findPath.bind(routerA, 'route', {path: 'foo'}), /route path "route" does not match any named routes/)
      assert.equal(path, '/base/foo')
      path = routerB.findPath('thing', {thing: 'bar'})
      assert.equal(path, '/some/bar')
      assert.throws(routerA.findPath.bind(routerA, 'routerB.thing.hello', {path: 'foo', thing: 'bar'}), /part of route path "hello" does not match any named nested routes/)
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
  return function saw(req, res, next) {
    res.setHeader(name, req.method + ' ' + req.url)
    next()
  }
}

function setsawBase(num) {
  var name = 'x-saw-base-' + String(num)
  return function sawBase(req, res, next) {
    res.setHeader(name, String(req.baseUrl))
    next()
  }
}

function saw(req, res) {
  var msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sawError(err, req, res, next) {
  var msg = 'saw ' + err.name + ': ' + err.message
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sawBase(req, res) {
  var msg = 'saw ' + req.baseUrl
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}
