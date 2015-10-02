
var Router = require('..')
var utils = require('./support/utils')
var Promise = require('bluebird')

var assert = utils.assert
var createHitHandle = utils.createHitHandle
var createErrorHitHandle = utils.createErrorHitHandle
var shouldHitHandle = utils.shouldHitHandle
var createServer = utils.createServer
var request = utils.request

describe('Promise', function () {
  it('rejecting will trigger error handlers', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(function (req, res) {
      return new Promise(function (resolve, reject) {
        reject(new Error('Happy error'))
      })
    })

    request(server)
    .get('/')
    .expect(500, done)
  })

  it('will be ignored if next is called', function (done) {
    var router = Router()
    var server = createServer(router)
    var timeoutCalled = false

    router.use(createHitHandle(1), function (req, res, next) {
      return new Promise(function (resolve, reject) {
        next()
        setTimeout(function () {
          timeoutCalled = true
          resolve()
        }, 5)
      })
    })

    router.use(createHitHandle(2), function (req, res) {
      assert(!timeoutCalled)
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(200, done)
  })

  it('can be used in error handlers', function (done) {
    var router = Router()
    var server = createServer(router)

    router.use(createHitHandle(1), function (req, res, next) {
      next(new Error('Happy error'))
    })

    router.use(createErrorHitHandle(2), function (error, req, res, next) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          next(error)
          resolve()
        }, 5)
      })
    })

    router.use(function () {
      done(new Error('This should never be reached'))
    })

    router.use(createErrorHitHandle(3), function (error, req, res, next) {
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(shouldHitHandle(1))
    .expect(shouldHitHandle(2))
    .expect(shouldHitHandle(3))
    .expect(200, done)
  })
})
