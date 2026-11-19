const { it, describe } = require('mocha')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert

describe('listRoutes', function () {
  it('should return an empty array when no routes are registered', function () {
    const router = new Router()

    assert.deepStrictEqual(router.listRoutes(), [])
  })

  it('should list routes for strings, regexps, arrays, and parameterized paths', function () {
    const router = new Router()

    router.get('/foo', noop)
    router.post('/:id/setting/:thing', noop)
    router.all(/^\/[a-z]oo$/, noop)
    router.get(['/bar', '/baz'], noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/foo', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/:id/setting/:thing', methods: ['POST'], router: undefined },
      { path: /^\/[a-z]oo$/, methods: ['*'], router: undefined },
      { path: '/bar', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/baz', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should include the automatic HEAD method for GET routes, but not duplicate an explicit one', function () {
    const router = new Router()

    router.get('/implicit', noop)
    router.route('/explicit').get(noop).head(noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/implicit', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/explicit', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should list all methods registered on a route', function () {
    const router = new Router()

    router.route('/test')
      .get(noop)
      .post(noop)
      .put(noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/test', methods: ['GET', 'POST', 'PUT', 'HEAD'], router: undefined }
    ])
  })

  it('should return empty methods for routes created without handlers', function () {
    const router = new Router()

    router.route('/draft')

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/draft', methods: [], router: undefined }
    ])
  })

  it('should list a wildcard for .all() routes', function () {
    const router = new Router()

    router.all('/test', noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/test', methods: ['*'], router: undefined }
    ])
  })

  it('should preserve registration order when combining .all() with verbs', function () {
    const router = new Router()

    router.route('/users')
      .all(noop)
      .get(noop)
      .post(noop)

    router.route('/posts')
      .get(noop)
      .post(noop)
      .all(noop)

    router.route('/explicit-head')
      .head(noop)
      .all(noop)
      .get(noop)
      .post(noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/users', methods: ['*', 'GET', 'POST', 'HEAD'], router: undefined },
      { path: '/posts', methods: ['GET', 'POST', '*', 'HEAD'], router: undefined },
      { path: '/explicit-head', methods: ['HEAD', '*', 'GET', 'POST'], router: undefined }
    ])
  })

  it('should keep the first registration position for repeated methods and .all() handlers', function () {
    const router = new Router()

    router.route('/users').get(noop).all(noop).post(noop).all(noop).get(noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/users', methods: ['GET', '*', 'POST', 'HEAD'], router: undefined }
    ])
  })

  it('should repeat routes registered multiple times', function () {
    const router = new Router()

    router.get('/test', noop)
    router.get('/test', noop)
    router.post('/test', noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/test', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/test', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/test', methods: ['POST'], router: undefined }
    ])
  })

  it('should not share the methods array between entries of an array path', function () {
    const router = new Router()

    router.get(['/bar', '/baz'], noop)

    const routes = router.listRoutes()

    routes[0].methods.push('POST')

    assert.deepStrictEqual(routes[1].methods, ['GET', 'HEAD'])
  })

  it('should not list plain middleware', function () {
    const router = new Router()

    router.use(noop)
    router.use('/admin', noop)
    router.get('/test', noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/test', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should flatten nested arrays of paths', function () {
    const router = new Router()
    const nested = ['/b']

    router.get(['/a', nested], noop)
    nested.push('/c')

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/a', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/b', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should not reflect later mutations of a registered path array', function () {
    const router = new Router()
    const paths = ['/a']

    router.get(paths, noop)
    paths.push('/b')

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/a', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should not list middleware that merely has a listRoutes property', function () {
    const router = new Router()

    function metrics (req, res, next) { next() }
    metrics.listRoutes = () => 'not routes'

    router.use('/status', metrics)

    assert.deepStrictEqual(router.listRoutes(), [])
  })

  it('should list mounted routers that do not implement listRoutes', function () {
    const router = new Router()

    function legacy (req, res, next) { next() }
    legacy.stack = []

    router.use('/legacy', legacy)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/legacy', methods: undefined, router: legacy }
    ])
  })

  it('should expose mounted routers without recursing', function () {
    const router = new Router()
    const inner = new Router()

    inner.get('/api', noop)
    router.use('/inner', inner)
    router.get('/test', noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/inner', methods: undefined, router: inner },
      { path: '/test', methods: ['GET', 'HEAD'], router: undefined }
    ])

    assert.deepStrictEqual(inner.listRoutes(), [
      { path: '/api', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should expose a router referenced by a middleware wrapper', function () {
    const router = new Router()
    const inner = new Router()

    function wrapper (req, res, next) { inner(req, res, next) }
    wrapper.router = inner
    inner.get('/users', noop)
    router.use(['/api', '/v1'], wrapper)

    const routes = router.listRoutes()

    assert.deepStrictEqual(routes, [
      { path: '/api', methods: undefined, router: inner },
      { path: '/v1', methods: undefined, router: inner }
    ])
    assert.deepStrictEqual(routes[0].router.listRoutes(), [
      { path: '/users', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should resolve a wrapped router lazily when listing routes', function () {
    const router = new Router()
    let inner
    let reads = 0

    function wrapper (req, res, next) { inner(req, res, next) }
    Object.defineProperty(wrapper, 'router', {
      get () {
        reads++
        return inner || (inner = new Router())
      }
    })

    router.use('/api', wrapper)
    assert.strictEqual(reads, 0)
    assert.strictEqual(inner, undefined)

    const routes = router.listRoutes()
    assert.strictEqual(reads, 1)
    assert.strictEqual(routes[0].router, inner)
    assert.deepStrictEqual(inner.listRoutes(), [])

    inner.get('/users', noop)
    assert.deepStrictEqual(routes[0].router.listRoutes(), [
      { path: '/users', methods: ['GET', 'HEAD'], router: undefined }
    ])
  })

  it('should prefer the mounted router over its router property', function () {
    const router = new Router()
    const inner = new Router()

    Object.defineProperty(inner, 'router', {
      get () { throw new Error('unexpected router property access') }
    })
    router.use('/api', inner)

    assert.strictEqual(router.listRoutes()[0].router, inner)
  })

  it('should skip middleware whose router property is not a callable router', function () {
    const router = new Router()

    for (const value of [undefined, null, true, 'router', {}, { stack: [] }, { stack: {} }, noop]) {
      function middleware (req, res, next) { next() }
      middleware.router = value
      router.use('/api', middleware)
    }

    assert.deepStrictEqual(router.listRoutes(), [])
  })

  it('should expose wrapped routers that do not implement listRoutes', function () {
    const router = new Router()

    function legacy (req, res, next) { next() }
    legacy.stack = []
    function wrapper (req, res, next) { legacy(req, res, next) }
    wrapper.router = legacy
    router.use('/legacy', wrapper)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/legacy', methods: undefined, router: legacy }
    ])
  })

  it('should dispatch through the wrapper after listing its router', function (done) {
    const router = new Router()
    const inner = new Router()
    let handled = false

    function wrapper (req, res, next) {
      req.wrapped = true
      inner(req, res, next)
    }
    wrapper.router = inner
    inner.get('/users', function (req, res, next) {
      assert.strictEqual(req.wrapped, true)
      handled = true
      next()
    })
    router.use('/api', wrapper)
    assert.strictEqual(router.listRoutes()[0].router, inner)

    router({ method: 'GET', url: '/api/users' }, {}, function (err) {
      assert.ifError(err)
      assert.strictEqual(handled, true)
      done()
    })
  })

  it('should use the default path when mounting a router without a path', function () {
    const router = new Router()
    const inner = new Router()

    inner.get('/api', noop)
    router.use(inner)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/', methods: undefined, router: inner }
    ])
  })

  it('should list routers mounted at a RegExp path', function () {
    const router = new Router()
    const inner = new Router()

    inner.get('/api', noop)
    router.use(/^\/page_([0-9]+)/, inner)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: /^\/page_([0-9]+)/, methods: undefined, router: inner }
    ])
  })

  it('should list a mounted router once per path in an array', function () {
    const router = new Router()
    const inner = new Router()

    router.use(['/foo', '/bar'], inner)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/foo', methods: undefined, router: inner },
      { path: '/bar', methods: undefined, router: inner }
    ])
  })

  it('should allow consumers to recurse into cyclic routers without blowing the stack', function () {
    const router = new Router()
    const inner = new Router()

    inner.get('/api', noop)
    router.use('/inner', inner)
    inner.use('/loop', router)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/inner', methods: undefined, router: inner }
    ])

    assert.deepStrictEqual(inner.listRoutes(), [
      { path: '/api', methods: ['GET', 'HEAD'], router: undefined },
      { path: '/loop', methods: undefined, router }
    ])
  })
})

function noop () {}
