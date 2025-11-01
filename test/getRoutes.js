const { it, describe } = require('mocha')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert

describe('getRoutes', function () {
  it('should return an empty array when no routes are registered', function () {
    const router = new Router()

    assert.deepStrictEqual(router.getRoutes(), [])
  })

  it('should return route information for various route types (strings, arrays, and parameterized paths)', function () {
    const router = new Router()

    router.all('/', noop)
    router.route('/test2/')
    router.route('/test/').get(noop)
    router.all(/^\/[a-z]oo$/, noop)
    router.get(['/foo', '/bar'], noop)
    router.post('/:id/setting/:thing', noop)

    assert.deepStrictEqual(router.getRoutes(),
      [
        { name: 'handle', path: '/', methods: ['_ALL'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
        { name: 'handle', path: '/test2/', methods: [], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }, // Todo: Investigate
        { name: 'handle', path: '/test/', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
        { name: 'handle', path: /^\/[a-z]oo$/, methods: ['_ALL'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
        { name: 'handle', path: '/foo', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
        { name: 'handle', path: '/bar', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
        { name: 'handle', path: '/:id/setting/:thing', methods: ['POST'], keys: [{ name: 'id', type: 'param' }, { name: 'thing', type: 'param' }], options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
      ])
  })

  it('should track multiple registrations of the same route with different HTTP methods', function () {
    const router = new Router()

    router.post(['/test', '/test2'], noop)

    for (let i = 0; i < 2; i++) {
      router.get(['/test', '/test3'], noop)
    }

    router.put('/test3', noop)

    assert.deepStrictEqual(router.getRoutes(), [
      { name: 'handle', path: '/test', methods: ['POST'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test2', methods: ['POST'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test3', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test3', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test3', methods: ['PUT'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
    ])
  })

  it('should properly handle nested routers and multiple mount points', function () {
    const router = new Router()
    const inner = new Router()
    router.post('/test', noop)

    for (let i = 0; i < 2; i++) {
      router.get('/test', noop)
    }

    for (let i = 0; i < 2; i++) {
      inner.get('/test', noop)
    }

    router.use(['/test/', '/test2', '/test3'], inner)
    router.use('/test4/', inner)
    router.route('/test5').get(noop).post(noop)

    assert.deepStrictEqual(router.getRoutes(), [
      { name: 'handle', path: '/test', methods: ['POST'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      { name: 'handle', path: '/test', methods: ['GET'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
      {
        name: 'router',
        path: '/test/',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }, {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }]
      },
      {
        name: 'router',
        path: '/test2',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }, {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }]
      },
      {
        name: 'router',
        path: '/test3',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }, {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }]
      },
      {
        name: 'router',
        path: '/test4/',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }, {
            name: 'handle',
            keys: undefined,
            methods: ['GET'],
            options: { strict: undefined, caseSensitive: undefined, end: true },
            path: '/test',
            router: undefined
          }]
      },
      { name: 'handle', path: '/test5', methods: ['GET', 'POST'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
    ])
  })

  it('should correctly flatten deeply nested router hierarchies with multiple levels', function () {
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

    assert.deepStrictEqual(router.getRoutes(), [
      {
        name: 'router',
        path: '/t2',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'router',
            path: '/t3',
            methods: undefined,
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: false },
            router: [
              { name: 'handle', path: '/t5', methods: ['PUT'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
              { name: 'handle', path: /^\/[a-z]oo$/, methods: ['_ALL'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
            ]
          },
          {
            name: 'handle',
            path: '/t4',
            methods: ['_ALL'],
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: true },
            router: undefined
          },
          {
            name: 'handle',
            path: '/',
            methods: ['GET'],
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: true },
            router: undefined
          }
        ]
      },
      {
        name: 'router',
        path: '/t5',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'router',
          path: '/t3',
          methods: undefined,
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: false },
          router: [
            { name: 'handle', path: '/t5', methods: ['PUT'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
            { name: 'handle', path: /^\/[a-z]oo$/, methods: ['_ALL'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
          ]
        },
        {
          name: 'handle',
          path: '/t4',
          methods: ['_ALL'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        },
        {
          name: 'handle',
          path: '/',
          methods: ['GET'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }
        ]
      },
      {
        name: 'router',
        path: '/t7',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [
          {
            name: 'router',
            path: '/t3',
            methods: undefined,
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: false },
            router: [
              { name: 'handle', path: '/t5', methods: ['PUT'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined },
              { name: 'handle', path: /^\/[a-z]oo$/, methods: ['_ALL'], keys: undefined, options: { strict: undefined, caseSensitive: undefined, end: true }, router: undefined }
            ]
          },
          {
            name: 'handle',
            path: '/t4',
            methods: ['_ALL'],
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: true },
            router: undefined
          },
          {
            name: 'handle',
            path: '/',
            methods: ['GET'],
            keys: undefined,
            options: { strict: undefined, caseSensitive: undefined, end: true },
            router: undefined
          }
        ]
      }

    ])
  })

  it('should avoid double slashes when mounting routers at root path', function () {
    const router = new Router()
    const subRouter = new Router()

    subRouter.get('/api', () => {})
    router.use('/', subRouter)

    const routes = router.getRoutes()

    assert.deepStrictEqual(routes, [
      {
        name: 'router',
        path: '/',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'handle',
          path: '/api',
          methods: ['GET'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }]
      }
    ])
  })

  it('should return keys for routes with regex', function () {
    const router = new Router()
    const subRouter = new Router()

    subRouter.get(/\/(?<foo>[0-9]+)/, () => {})

    router.use(/\/page_([0-9]+)/, subRouter)

    const routes = router.getRoutes()

    assert.deepStrictEqual(routes, [
      {
        name: 'router',
        path: /\/page_([0-9]+)/,
        methods: undefined,
        keys: [{ name: 0 }],
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'handle',
          path: /\/(?<foo>[0-9]+)/,
          methods: ['GET'],
          keys: [{ name: 'foo' }],
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }]
      }
    ])
  })

  it('should return keys for dynamic routes', function () {
    const router = new Router()
    const subRouter = new Router()
    const anotherSubRouter = new Router()

    subRouter.get('/api', () => {})
    anotherSubRouter.get('/api2', () => {})

    router.use('/:test', subRouter)
    router.use(['/:lang', '/ls'], anotherSubRouter)

    const routes = router.getRoutes()

    assert.deepStrictEqual(routes, [
      {
        name: 'router',
        path: '/:test',
        methods: undefined,
        keys: [{ name: 'test', type: 'param' }],
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'handle',
          path: '/api',
          methods: ['GET'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }]
      }, {
        name: 'router',
        path: '/:lang',
        methods: undefined,
        keys: [{ name: 'lang', type: 'param' }],
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'handle',
          path: '/api2',
          methods: ['GET'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }]
      }, {
        name: 'router',
        path: '/ls',
        methods: undefined,
        keys: undefined,
        options: { strict: undefined, caseSensitive: undefined, end: false },
        router: [{
          name: 'handle',
          path: '/api2',
          methods: ['GET'],
          keys: undefined,
          options: { strict: undefined, caseSensitive: undefined, end: true },
          router: undefined
        }]
      }
    ])
  })

  it('should preserve router configuration options from parent to child routers', function () {
    const router = new Router({ strict: true, caseSensitive: true })
    const inner = new Router({ strict: true, caseSensitive: false, end: false })
    const subinner = new Router({ strict: false, caseSensitive: false })

    subinner.put('/t8', noop)
    subinner.use(noop)

    inner.use('/t3', subinner)
    inner.all('/t4', noop)
    inner.get('/', noop)
    inner.use(noop)

    router.use('/t2', inner)
    router.use(['/t5', '/t7'], inner)

    router.use(noop)
    router.get('/test', noop)

    assert.deepStrictEqual(router.getRoutes(), [
      {
        name: 'router',
        path: '/t2',
        methods: undefined,
        keys: undefined,
        options: { strict: true, caseSensitive: true, end: false },
        router: [
          {
            name: 'router',
            path: '/t3',
            methods: undefined,
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: false },
            router: [
              { name: 'handle', path: '/t8', methods: ['PUT'], keys: undefined, options: { strict: false, caseSensitive: false, end: true }, router: undefined }
            ]
          }, {
            name: 'handle',
            path: '/t4',
            methods: ['_ALL'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }, {
            name: 'handle',
            path: '/',
            methods: ['GET'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }
        ]
      },
      {
        name: 'router',
        path: '/t5',
        methods: undefined,
        keys: undefined,
        options: { strict: true, caseSensitive: true, end: false },
        router: [
          {
            name: 'router',
            path: '/t3',
            methods: undefined,
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: false },
            router: [
              { name: 'handle', path: '/t8', methods: ['PUT'], keys: undefined, options: { strict: false, caseSensitive: false, end: true }, router: undefined }
            ]
          }, {
            name: 'handle',
            path: '/t4',
            methods: ['_ALL'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }, {
            name: 'handle',
            path: '/',
            methods: ['GET'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }
        ]
      },
      {
        name: 'router',
        path: '/t7',
        methods: undefined,
        keys: undefined,
        options: { strict: true, caseSensitive: true, end: false },
        router: [
          {
            name: 'router',
            path: '/t3',
            methods: undefined,
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: false },
            router: [
              { name: 'handle', path: '/t8', methods: ['PUT'], keys: undefined, options: { strict: false, caseSensitive: false, end: true }, router: undefined }
            ]
          }, {
            name: 'handle',
            path: '/t4',
            methods: ['_ALL'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }, {
            name: 'handle',
            path: '/',
            methods: ['GET'],
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: true },
            router: undefined
          }
        ]
      },
      {
        name: 'handle',
        path: '/test',
        methods: ['GET'],
        keys: undefined,
        options: { strict: true, caseSensitive: true, end: true },
        router: undefined
      }
    ])
  })

  it('should handle multiple routers with different configuration options mounted at the same path', function () {
    const router = new Router({ strict: true, caseSensitive: true })
    const inner = new Router({ strict: true, caseSensitive: false, end: false })
    const otherInner = new Router({ strict: true, caseSensitive: true, end: false })
    const otherInner2 = new Router({ strict: true, caseSensitive: false })

    otherInner2.put('/:t5', noop)
    otherInner2.get('/:t6', noop)

    otherInner.put('/:t5', noop)
    otherInner.post('/:t6', noop)

    inner.use('/t2', otherInner)
    inner.use('/t2', otherInner2)

    router.use(inner)

    assert.deepStrictEqual(router.getRoutes(), [
      {
        name: 'router',
        path: '/',
        methods: undefined,
        keys: undefined,
        options: { strict: true, caseSensitive: true, end: false },
        router: [
          {
            name: 'router',
            path: '/t2',
            methods: undefined,
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: false },
            router: [
              {
                name: 'handle',
                path: '/:t5',
                methods: ['PUT'],
                keys: [{ name: 't5', type: 'param' }],
                options: { strict: true, caseSensitive: true, end: true },
                router: undefined
              },
              {
                name: 'handle',
                path: '/:t6',
                methods: ['POST'],
                keys: [{ name: 't6', type: 'param' }],
                options: { strict: true, caseSensitive: true, end: true },
                router: undefined
              }
            ]
          },
          {
            name: 'router',
            path: '/t2',
            methods: undefined,
            keys: undefined,
            options: { strict: true, caseSensitive: false, end: false },
            router: [{
              name: 'handle',
              path: '/:t5',
              methods: ['PUT'],
              keys: [{ name: 't5', type: 'param' }],
              options: { strict: true, caseSensitive: false, end: true },
              router: undefined
            },
            {
              name: 'handle',
              path: '/:t6',
              methods: ['GET'],
              keys: [{ name: 't6', type: 'param' }],
              options: { strict: true, caseSensitive: false, end: true },
              router: undefined
            }]
          }
        ]
      }
    ])
  })
})

function noop () {}
