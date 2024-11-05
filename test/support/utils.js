const assert = require('assert')
const finalhandler = require('finalhandler')
const http = require('http')
const { METHODS } = require('node:http')
const request = require('supertest')

const methods = METHODS.map((method) => method.toLowerCase())

exports.assert = assert
exports.createHitHandle = createHitHandle
exports.createServer = createServer
exports.rawrequest = rawrequest
exports.request = request
exports.shouldHaveBody = shouldHaveBody
exports.shouldNotHaveBody = shouldNotHaveBody
exports.shouldHitHandle = shouldHitHandle
exports.shouldNotHitHandle = shouldNotHitHandle
exports.methods = methods

function createHitHandle (num) {
  const name = 'x-fn-' + String(num)
  return function hit (req, res, next) {
    res.setHeader(name, 'hit')
    next()
  }
}

function createServer (router) {
  return http.createServer(function onRequest (req, res) {
    router(req, res, finalhandler(req, res))
  })
}

function rawrequest (server) {
  const _headers = {}
  let _method
  let _path
  const _test = {}

  methods.forEach(function (method) {
    _test[method] = go.bind(null, method)
  })

  function expect (status, body, callback) {
    if (arguments.length === 2) {
      _headers[status.toLowerCase()] = body
      return this
    }

    let _server

    if (!server.address()) {
      _server = server.listen(0, onListening)
      return
    }

    onListening.call(server)

    function onListening () {
      const addr = this.address()
      const port = addr.port

      const req = http.request({
        host: '127.0.0.1',
        method: _method,
        path: _path,
        port
      })
      req.on('response', function (res) {
        let buf = ''

        res.setEncoding('utf8')
        res.on('data', function (s) { buf += s })
        res.on('end', function () {
          let err = null

          try {
            for (const key in _headers) {
              assert.equal(res.headers[key], _headers[key])
            }

            assert.equal(res.statusCode, status)
            assert.equal(buf, body)
          } catch (e) {
            err = e
          }

          if (_server) {
            _server.close()
          }

          callback(err)
        })
      })
      req.end()
    }
  }

  function go (method, path) {
    _method = method
    _path = path

    return {
      expect
    }
  }

  return _test
}

function shouldHaveBody (buf) {
  return function (res) {
    const body = !Buffer.isBuffer(res.body)
      ? Buffer.from(res.text)
      : res.body
    assert.ok(body, 'response has body')
    assert.strictEqual(body.toString('hex'), buf.toString('hex'))
  }
}

function shouldHitHandle (num) {
  const header = 'x-fn-' + String(num)
  return function (res) {
    assert.equal(res.headers[header], 'hit', 'should hit handle ' + num)
  }
}

function shouldNotHaveBody () {
  return function (res) {
    assert.ok(res.text === '' || res.text === undefined)
  }
}

function shouldNotHitHandle (num) {
  return shouldNotHaveHeader('x-fn-' + String(num))
}

function shouldNotHaveHeader (header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have header ' + header)
  }
}
