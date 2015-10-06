
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createErrorHitHandle = utils.createErrorHitHandle
var shouldHitHandle = utils.shouldHitHandle
var shouldNotHitHandle = utils.shouldNotHitHandle
var manyAsyncCalls = utils.manyAsyncCalls
var createServer = utils.createServer
var request = utils.request

describe('middleware', function () {
  it('cannot call the next function twice', function (done) {
    var router = Router()
    var server = createServer(router)
    done = manyAsyncCalls(done, 2)

    router.use(function (req, res, next) {
      next()
      next()
    })

    router.use(function (req, res, next) { res.end() })
    router.use(createHitHandle(1))
    router.use(createErrorHitHandle(2))

    router.use(function (error, req, res, next) {
      assert.equal(error.message, 'next() cannot be called twice')
      done()
    })

    request(server)
    .get('/')
    .expect(shouldNotHitHandle(1))
    .expect(shouldNotHitHandle(2))
    .expect(200, done)
  })

  it('cannot call the next function twice in an error handler', function (done) {
    var router = Router()
    var server = createServer(router)
    done = manyAsyncCalls(done, 2)

    router.use(function (req, res, next) {
      next(new Error('Happy error'))
    })

    router.use(function (error, req, res, next) {
      next()
      next()
    })

    router.use(function (req, res, next) { res.end() })
    router.use(createHitHandle(1))
    router.use(createErrorHitHandle(2))

    router.use(function (error, req, res, next) {
      assert.equal(error.message, 'next() cannot be called twice')
      done()
    })

    request(server)
    .get('/')
    .expect(shouldNotHitHandle(1))
    .expect(shouldNotHitHandle(2))
    .expect(200, done)
  })

  it('can call next multiple times with an error', function (done) {
    var router = Router()
    var server = createServer(router)
    done = manyAsyncCalls(done, 3)

    router.use(function (req, res, next) {
      next(new Error('1'))
      next(new Error('2'))
      res.end()
    })

    router.use(createHitHandle(1))

    router.use(function (error, req, res, next) {
      assert.equal(error.message, '1')
      done()
    })

    router.use(function (error, req, res, next) {
      assert.equal(error.message, '2')
      done()
    })

    request(server)
    .get('/')
    .expect(shouldNotHitHandle(1))
    .expect(200, done)
  })
})
