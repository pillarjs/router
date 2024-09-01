const { it, describe } = require('mocha')
const Router = require('..')
const utils = require('./support/utils')

const createServer = utils.createServer
const request = utils.request

describe('HEAD', function () {
  it('should invoke get without head', function (done) {
    const router = Router()
    const server = createServer(router)

    router.get('/users', sethit(1), saw)

    request(server)
      .head('/users')
      .expect('Content-Type', 'text/plain')
      .expect('x-fn-1', 'hit')
      .expect(200, done)
  })

  it('should invoke head if prior to get', function (done) {
    const router = Router()
    const server = createServer(router)

    router.head('/users', sethit(1), saw)
    router.get('/users', sethit(2), saw)

    request(server)
      .head('/users')
      .expect('Content-Type', 'text/plain')
      .expect('x-fn-1', 'hit')
      .expect(200, done)
  })
})

function saw (req, res) {
  const msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}

function sethit (num) {
  const name = 'x-fn-' + String(num)
  return function hit (req, res, next) {
    res.setHeader(name, 'hit')
    next()
  }
}
