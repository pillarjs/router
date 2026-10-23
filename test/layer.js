'use strict'
const { it, describe } = require('mocha')
const assert = require('assert')
const Layer = require('../lib/layer')

describe('match', function () {
  it('should return the matched pattern when requested and preserve boolean matching', function () {
    const regexp = /^\/legacy\/(\w+)$/
    const layer = new Layer(['/users/:id', ['/posts/:id', regexp]], {}, function handle () {})
    const first = layer.match('/users/1', true)

    assert.strictEqual(layer.match('/posts/2', true), '/posts/:id')
    assert.strictEqual(layer.match('/legacy/3', true), regexp)
    assert.strictEqual(layer.match('/missing', true), false)
    assert.strictEqual(first, '/users/:id')
    assert.strictEqual(layer.match('/users/1'), true)
    assert.strictEqual(layer.match('/users/1', false), true)
    assert.strictEqual(layer.match('/missing'), false)
    assert.strictEqual(layer.match(null, true), false)
    assert.strictEqual(layer.match(undefined, true), false)
  })

  it('should return the root pattern for middleware without an explicit path', function () {
    const layer = new Layer('/', { end: false }, function handle () {})

    assert.strictEqual(layer.match('/users/1', true), '/')
    assert.strictEqual(layer.match('/users/2'), true)
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
    assert.strictEqual(matched, true, 'Route should match')
    assert.strictEqual(layer.params.param, original, 'Parameter should be properly decoded')
  })
})
