'use strict'
const { it, describe } = require('mocha')
const assert = require('assert')
const Layer = require('../lib/layer')

describe('match', function () {
  it('should return independent results for nested path arrays', function () {
    const regexp = /^\/legacy\/(\w+)$/
    const layer = new Layer(['/users/:id', ['/posts/:id', regexp]], {}, function handle () {})
    const first = layer.match('/users/1')
    const second = layer.match('/posts/2')
    const legacy = layer.match('/legacy/3')

    assert.strictEqual(first.pattern, '/users/:id')
    assert.strictEqual(first.path, '/users/1')
    assert.strictEqual(first.params.id, '1')
    assert.deepStrictEqual(first.keys, ['id'])
    assert.strictEqual(second.pattern, '/posts/:id')
    assert.strictEqual(second.path, '/posts/2')
    assert.strictEqual(second.params.id, '2')
    assert.strictEqual(legacy.pattern, regexp)
    assert.strictEqual(legacy.path, '/legacy/3')
    assert.deepStrictEqual(legacy.params, { 0: '3' })
    assert.deepStrictEqual(legacy.keys, ['0'])

    assert.strictEqual(layer.match('/missing'), false)
    assert.strictEqual(layer.match(null), false)
    assert.strictEqual(layer.match(undefined), false)
    assert.strictEqual(first.params.id, '1')
    assert.strictEqual(first.path, '/users/1')
    assert.strictEqual(second.params.id, '2')
  })

  it('should return the root pattern for middleware without an explicit path', function () {
    const layer = new Layer('/', { end: false }, function handle () {})

    const first = layer.match('/users/1')
    const second = layer.match('/users/2')

    assert.deepStrictEqual(first, { params: {}, path: '', keys: [], pattern: '/' })
    assert.deepStrictEqual(second, first)
    assert.notStrictEqual(first.params, second.params)
    assert.notStrictEqual(first.keys, second.keys)
    assert.strictEqual(layer.match(null), false)
  })

  for (const path of ['/:id', /^\/(\w+)$/, '/']) {
    it('should match a frozen layer registered at ' + path, function () {
      const layer = Object.freeze(new Layer(path, { end: false }, function handle () {}))

      assert.ok(layer.match('/first'))
      assert.ok(layer.match('/second'))
      assert.strictEqual(layer.match(null), false)
      assert.strictEqual('params' in layer, false)
      assert.strictEqual('path' in layer, false)
      assert.strictEqual('keys' in layer, false)
    })
  }

  it('should keep a previous result after a decoding error', function () {
    const layer = Object.freeze(new Layer('/:id', {}, function handle () {}))
    const first = layer.match('/first')

    assert.throws(function () { layer.match('/%Z') }, URIError)
    assert.strictEqual(first.params.id, 'first')
    assert.strictEqual(first.path, '/first')
    assert.deepStrictEqual(first.keys, ['id'])
    assert.strictEqual(first.pattern, '/:id')
  })

  it('should return fresh wildcard params and keys for each match', function () {
    const layer = new Layer('/files{/*parts}', {}, function handle () {})
    const first = layer.match('/files/a/b')
    const second = layer.match('/files/a/b')
    const absent = layer.match('/files')

    first.params.parts.push('c')
    first.keys.push('extra')
    assert.deepStrictEqual(second.params.parts, ['a', 'b'])
    assert.deepStrictEqual(second.keys, ['parts'])
    assert.deepStrictEqual(absent.keys, [])
    assert.strictEqual(absent.params.parts, undefined)
    assert.strictEqual(absent.pattern, '/files{/*parts}')
  })

  it('should preserve empty registered patterns', function () {
    const layer = new Layer('', {}, function handle () {})
    const result = layer.match('/')

    assert.strictEqual(result.pattern, '')
    assert.strictEqual(result.path, '/')
    assert.deepStrictEqual(result.keys, [])
  })
})

describe('decodeParam', function () {
  it('should set status and statusCode to 400 on URIError', function () {
    const layer = new Layer('/:param', {}, function handle () {})

    assert.throws(function () {
      layer.match('/%Z')
    }, function (err) {
      assert.ok(err instanceof URIError)
      assert.strictEqual(err.status, 400)
      assert.strictEqual(err.statusCode, 400)
      assert.strictEqual(err.message, "Failed to decode param '%Z'")
      return true
    })
  })

  it('should successfully decode valid parameters', function () {
    // Create a layer with a parameter route - note the need to provide a handler function
    const layer = new Layer('/:param', {}, function handle () {})

    // Create a valid encoded parameter
    const original = 'test value'
    const encoded = encodeURIComponent(original)

    // Match will internally call decodeParam with our encoded value
    const matched = layer.match('/' + encoded)

    // Verify the parameter was properly decoded
    assert.ok(matched, 'Route should match')
    assert.strictEqual(matched.params.param, original, 'Parameter should be properly decoded')
  })
})
