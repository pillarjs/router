'use strict'
const { it, describe } = require('mocha')
const assert = require('assert')
const Layer = require('../lib/layer')

describe('decodeParam', function () {
  it('should set statusCode to 400 on URIError', function () {
    const layer = new Layer('/:param', {}, function handle () {})

    // Create a malformed URI component that will cause a decoding error
    const malformedParam = '%Z'

    try {
      // Using match will internally call decodeParam with our malformed value
      layer.match('/' + malformedParam)

      // If we reach here, no error was thrown, which is a failure
      assert.fail('Expected URIError to be thrown')
    } catch (err) {
      // Verify that the URIError was enhanced with the correct status properties
      assert.strictEqual(err.status, 400, 'Expected err.status to be 400')
      assert.strictEqual(err.statusCode, 400, 'Expected err.statusCode to be 400')
      assert.strictEqual(err.message, `Failed to decode param '${malformedParam}'`, 'Expected proper error message')
    }
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
