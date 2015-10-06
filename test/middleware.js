
var Router = require('..')
var utils = require('./support/utils')

var assert = utils.assert
var createServer = utils.createServer
var request = utils.request

describe('middleware', function () {
  it('cannot call the next function twice', function (done) {
    var router = Router()
    var server = createServer(router)
    var mochaUncaughtException = process.listeners('uncaughtException').pop()
    // Needed in node 0.10.5+
    process.removeListener('uncaughtException', mochaUncaughtException)

    router.use(function (req, res, next) {
      next()
      next()
    })

    router.use(function (req, res, next) {
      res.writeHead(200)
      res.end('Hooray!')
    })

    router.use(function () { done(new Error('this should not be called')) })

    function uncaughtException(err) { assert.equal(err.message, 'cannot call `next` more than once') }
    process.once('uncaughtException', uncaughtException)

    request(server)
    .get('/')
    .expect(200, 'Hooray!', function (err) {
      if (err) { return done(err) }
      assert.equal(process.listeners('uncaughtException').indexOf(uncaughtException), -1)
      process.addListener('uncaughtException', mochaUncaughtException)
      done()
    })
  })
})
