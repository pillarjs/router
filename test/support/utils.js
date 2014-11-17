
var assert = require('assert')
var finalhandler = require('finalhandler')
var http = require('http')
var request = require('supertest')

exports.assert = assert
exports.createServer = createServer
exports.rawrequest = rawrequest
exports.request = request

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
