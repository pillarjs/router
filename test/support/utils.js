
var assert = require('assert')
var finalhandler = require('finalhandler')
var http = require('http')
var request = require('supertest')

exports.assert = assert
exports.createHitHandle = createHitHandle
exports.createErrorHitHandle = createErrorHitHandle
exports.createServer = createServer
exports.rawrequest = rawrequest
exports.request = request
exports.shouldHitHandle = shouldHitHandle
exports.shouldNotHitHandle = shouldNotHitHandle
exports.manyAsyncCalls = manyAsyncCalls

function createHitHandle(num) {
  var name = 'x-fn-' + String(num)
  return function hit(req, res, next) {
    if (!(res.headersSent || res._headerSent)) { res.setHeader(name, 'hit') }
    next()
  }
}

function createErrorHitHandle(num) {
  var hit = createHitHandle(num)
  return function hitError(error, req, res, next) {
    hit(req, res, function () { next(error) })
  }
}

function createServer(router) {
  return http.createServer(function onRequest(req, res) {
    router(req, res, finalhandler(req, res))
  })
}

function rawrequest(server) {
  var _headers = {}
  var _path

  function expect(status, body, callback) {
    if (arguments.length === 2) {
      _headers[status.toLowerCase()] = body
      return this
    }

    server.listen(function(){
      var addr = this.address()
      var hostname = addr.family === 'IPv6' ? '::1' : '127.0.0.1'
      var port = addr.port

      var req = http.get({
        host: hostname,
        path: _path,
        port: port
      })
      req.on('response', function(res){
        var buf = ''

        res.setEncoding('utf8')
        res.on('data', function(s){ buf += s })
        res.on('end', function(){
          var err = null

          try {
            for (var key in _headers) {
              assert.equal(res.headers[key], _headers[key])
            }

            assert.equal(res.statusCode, status)
            assert.equal(buf, body)
          } catch (e) {
            err = e
          }

          server.close()
          callback(err)
        })
      })
    })
  }

  function get(path) {
    _path = path

    return {
      expect: expect
    }
  }

  return {
    get: get
  }
}

function shouldHitHandle(num) {
  var header = 'x-fn-' + String(num)
  return function (res) {
    assert.equal(res.headers[header], 'hit', 'header ' + header + ' was included in the response')
  }
}

function shouldNotHitHandle(num) {
  return shouldNotHaveHeader('x-fn-' + String(num))
}

function shouldNotHaveHeader(header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have header ' + header)
  }
}

function manyAsyncCalls(done, calls) {
  return function (err) {
    if (err) {
      calls = 0
      return done(err)
    }
    calls--
    if (calls === 0) { done() }
  }
}
