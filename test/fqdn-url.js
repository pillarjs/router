
var Router = require('..')
var utils = require('./support/utils')

var createServer = utils.createServer
var rawrequest = utils.rawrequest

describe('FQDN url', function () {
  it('should not obscure FQDNs', function (done) {
    var router = new Router()
    var server = createServer(router)

    router.use(saw)

    rawrequest(server)
    .get('http://example.com/foo')
    .expect(200, 'saw GET http://example.com/foo', done)
  })

  it('should strip/restore FQDN req.url', function (done) {
    var router = new Router()
    var server = createServer(router)

    router.use('/blog', setsaw(1))
    router.use(saw)

    rawrequest(server)
    .get('http://example.com/blog/post/1')
    .expect('x-saw-1', 'GET http://example.com/post/1')
    .expect(200, 'saw GET http://example.com/blog/post/1', done)
  })

  it('should ignore FQDN in search', function (done) {
    var router = new Router()
    var server = createServer(router)

    router.use('/proxy', setsaw(1))
    router.use(saw)

    rawrequest(server)
    .get('/proxy?url=http://example.com/blog/post/1')
    .expect('x-saw-1', 'GET /?url=http://example.com/blog/post/1')
    .expect(200, 'saw GET /proxy?url=http://example.com/blog/post/1', done)
  })

  it('should ignore FQDN in path', function (done) {
    var router = new Router()
    var server = createServer(router)

    router.use('/proxy', setsaw(1))
    router.use(saw)

    rawrequest(server)
    .get('/proxy/http://example.com/blog/post/1')
    .expect('x-saw-1', 'GET /http://example.com/blog/post/1')
    .expect(200, 'saw GET /proxy/http://example.com/blog/post/1', done)
  })
})

function setsaw(num) {
  var name = 'x-saw-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, req.method + ' ' + req.url)
    next()
  }
}

function saw(req, res) {
  var msg = 'saw ' + req.method + ' ' + req.url
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end(msg)
}
