
var assert = require('assert')
var finalhandler = require('finalhandler')
var http = require('http')
var request = require('supertest')

exports.assert = assert
exports.createHitHandle = createHitHandle
exports.createServer = createServer
exports.rawrequest = rawrequest
exports.request = request
exports.shouldHitHandle = shouldHitHandle
exports.shouldNotHitHandle = shouldNotHitHandle

function createHitHandle(num) {
  var name = 'x-fn-' + String(num)
  return function hit(req, res, next) {
    res.setHeader(name, 'hit')
    next()
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
    assert.equal(res.headers[header], 'hit')
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
