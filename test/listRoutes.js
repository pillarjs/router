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
      { path: /^\/[a-z]oo$/, methods: undefined, router: undefined },
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

  it('should return undefined methods for .all() routes', function () {
    const router = new Router()

    router.all('/test', noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/test', methods: undefined, router: undefined }
    ])
  })

  it('should keep the specific methods of routes that combine .all() with verbs', function () {
    const router = new Router()

    router.route('/users')
      .all(noop)
      .get(noop)
      .post(noop)

    assert.deepStrictEqual(router.listRoutes(), [
      { path: '/users', methods: ['GET', 'POST', 'HEAD'], router: undefined }
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
