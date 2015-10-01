
var Router = require('..')
var utils = require('./support/utils')
var Promise = require('bluebird')

var assert = utils.assert
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
    var count = 0

    router.use(function (req, res, next) {
      count++
      return new Promise(function (resolve, reject) {
        count++
        next()
        setTimeout(function () {
          count++
          resolve()
        }, 5)
      })
    })

    router.use(function (req, res) {
      assert.equal(count, 2)
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(200, done)
  })

  it('can be used in error handlers', function (done) {
    var router = Router()
    var server = createServer(router)
    var count = 0

    router.use(function (req, res, next) {
      count++
      next(new Error('Happy error'))
    })

    router.use(function (error, req, res, next) {
      count++
      return new Promise(function (resolve, reject) {
        count++
        setTimeout(function () {
          count++
          next(error)
          resolve()
        }, 5)
      })
    })

    router.use(function () {
      done(new Error('This should never be reached'))
    })

    router.use(function (error, req, res, next) {
      assert.equal(count, 4)
      res.end('Awesome!')
    })

    request(server)
    .get('/')
    .expect(200, done)
  })
})
