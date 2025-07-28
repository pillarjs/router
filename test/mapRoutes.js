const { it, describe } = require('mocha')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert

describe('_mapRoutes', function () {
  it('should return empty array for router with no registered routes', function () {
    const router = new Router()

    assert.deepStrictEqual(router._mapRoutes(), [])
  })

  it('should map different route types including strings, regex patterns, and parameter routes', function () {
    const router = new Router()

    router.all('/', noop)
    router.route('/test2/')
    router.route('/test/').get(noop)
    router.all(/^\/[a-z]oo$/, noop)
    router.get(['/foo', '/bar'], noop)
    router.post('/:id/setting/:thing', noop)

    assert.deepStrictEqual(router._mapRoutes(),
      [
        { path: '/', methods: ['_ALL'] },
        { path: '/test2/', methods: [] },
        { path: '/test/', methods: ['GET'] },
        { path: '/^\\/[a-z]oo$/', methods: ['_ALL'] },
        { path: '/foo', methods: ['GET'] },
        { path: '/bar', methods: ['GET'] },
        { path: '/:id/setting/:thing', methods: ['POST'] }
      ])
  })

  it('should consolidate HTTP methods for routes registered multiple times', function () {
    const router = new Router()
    router.post(['/test', '/test2'], noop)

    for (let i = 0; i < 20; i++) {
      router.get(['/test', '/test3'], noop)
    }

    router.put('/test3', noop)

    assert.deepStrictEqual(router._mapRoutes(), [
      { path: '/test', methods: ['POST', 'GET'] },
      { path: '/test2', methods: ['POST'] },
      { path: '/test3', methods: ['GET', 'PUT'] }
    ])
  })

  it('should deduplicate routes and flatten nested router paths correctly', function () {
    const router = new Router()
    const inner = new Router()
    router.post('/test', noop)

    for (let i = 0; i < 100; i++) {
      router.get('/test', noop)
    }

    for (let i = 0; i < 20; i++) {
      inner.get('/test', noop)
    }

    router.use(['/test/', '/test2', '/test3'], inner)
    router.use('/test4/', inner)

    assert.deepStrictEqual(router._mapRoutes(), [
      { path: '/test', methods: ['POST', 'GET'] },
      { path: '/test/test', methods: ['GET'] },
      { path: '/test2/test', methods: ['GET'] },
      { path: '/test3/test', methods: ['GET'] },
      { path: '/test4/test', methods: ['GET'] }
    ])
  })

  it('should handle complex nested router hierarchies with multiple mount points', function () {
    const router = new Router()
    const inner = new Router()
    const subinner = new Router()

    subinner.put('/t5', noop)
    subinner.all(/^\/[a-z]oo$/, noop)
    subinner.use(noop)

    inner.use('/t3', subinner)
    inner.all('/t4', noop)
    inner.get('/', noop)
    inner.use(noop)

    router.use('/t2', inner)
    router.use(['/t5', '/t7'], inner)

    router.use(noop)
    router.use('/test1', noop)

    assert.deepStrictEqual(router._mapRoutes(), [
      { path: '/t2/t3/t5', methods: ['PUT'] },
      { path: '/t2/t3/^\\/[a-z]oo$/', methods: ['_ALL'] },
      { path: '/t2/t4', methods: ['_ALL'] },
      { path: '/t2/', methods: ['GET'] },
      { path: '/t5/t3/t5', methods: ['PUT'] },
      { path: '/t5/t3/^\\/[a-z]oo$/', methods: ['_ALL'] },
      { path: '/t5/t4', methods: ['_ALL'] },
      { path: '/t5/', methods: ['GET'] },
      { path: '/t7/t3/t5', methods: ['PUT'] },
      { path: '/t7/t3/^\\/[a-z]oo$/', methods: ['_ALL'] },
      { path: '/t7/t4', methods: ['_ALL'] },
      { path: '/t7/', methods: ['GET'] }
    ])
  })
})

function noop () {}
