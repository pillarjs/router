// IMPORTANT: Do not include 'use strict' anywhere else in this file
// @see https://github.com/pillarjs/router/pull/25#discussion_r40988513

var Router = require('..')
var utils = require('./support/utils')

var createServer = utils.createServer
var request = utils.request

describe('this', function () {
  describe('when middleware is sloppy', function () {
    it('should have global context', function (done) {
      var router = new Router()
      var server = createServer(router)

      router.get('/', function (req, res) {
        res.end(String(this === global))
      })

      request(server)
      .get('/')
      .expect(200, 'true', done)
    })
  })

  describe('when middleware is strict', function () {
    it('should have null context', function (done) {
      'use strict'
      var router = new Router()
      var server = createServer(router)

      router.get('/', function (req, res) {
        res.end(String(this === global))
      })

      request(server)
      .get('/')
      .expect(200, 'false', done)
    })
  })
})
