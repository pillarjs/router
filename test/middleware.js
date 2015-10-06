
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createErrorHitHandle = utils.createErrorHitHandle
var shouldHitHandle = utils.shouldHitHandle
var shouldNotHitHandle = utils.shouldNotHitHandle
var createServer = utils.createServer
var request = utils.request

describe('middleware', function () {
  it('cannot call the next function twice', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1))

    router.use(function (req, res, next) {
      next()
      next()
    })

    router.use(createHitHandle(2), function (req, res, next) { res.end() })
    router.use(createHitHandle(3))
    router.use(createErrorHitHandle(4))
    router.use(function (a, b, c, d) { assert.equal(error.message, 'next() cannot be called twice') })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(shouldNotHitHandle(3))
    .expect(shouldNotHitHandle(4))
    .expect(200, done)
  })

  it('cannot call the next function twice in an error handler', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1), function (req, res, next) {
      next(new Error('Happy error'))
    })

    router.use(createErrorHitHandle(2))

    router.use(function (error, req, res, next) {
      next(error)
      next(error)
    })

    router.use(createErrorHitHandle(3), function (error, req, res, next) { res.end() })
    router.use(createErrorHitHandle(4))
    router.use(createHitHandle(5))
    router.use(function (a, b, c, d) { assert.equal(error.message, 'next() cannot be called twice') })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(shouldHitHandle(3))
    .expect(shouldNotHitHandle(4))
    .expect(shouldNotHitHandle(5))
    .expect(200, done)
  })
})
