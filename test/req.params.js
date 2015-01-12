
var after = require('after')
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createServer = utils.createServer
var request = utils.request

describe('req.params', function () {
  it('should default to empty object', function (done) {
    var router = Router()
    var server = createServer(router)

    router.get('/', sawParams)

    request(server)
    .get('/')
    .expect(200, '{}', done)
  })

  it('should not exist outside the router', function (done) {
    var router = Router()
    var server = createServer(function (req, res, next) {
      router(req, res, function (err) {
        if (err) return next(err)
        sawParams(req, res)
      })
    })

    router.get('/', hitParams(1))

    request(server)
    .get('/')
    .expect('x-params-1', '{}')
    .expect(200, '', done)
  })
})

function hitParams(num) {
  var name = 'x-params-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, JSON.stringify(req.params))
    next()
  }
}

function sawParams(req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(req.params))
}
