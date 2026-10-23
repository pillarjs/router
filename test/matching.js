'use strict'

const { it, describe } = require('mocha')
const assert = require('node:assert')
const Router = require('..')

describe('request-scoped matches', function () {
  it('should dispatch overlapping requests through frozen layers', async function () {
    const router = Router()
    const child = Router({ mergeParams: true })
    const observed = []
    const callbacks = []
    const parentParams = { parent: 'original' }
    const firstReq = { method: 'GET', url: '/users/1/alpha/detail/a?q=1', params: parentParams }
    let resume

    router.param('id', function (req, res, next, id) {
      callbacks.push(['id', id])
      resume = function () {
        req.params.id = Number(id)
        next()
      }
    })
    router.param('tail', function (req, res, next, tail) {
      callbacks.push(['tail', tail])
      req.params.tail = tail.toUpperCase()
      next()
    })
    child.param('child', function (req, res, next, value) {
      callbacks.push(['child', value])
      next()
    })
    child.get('/detail/:child', function (req, res, next) {
      observed.push({
        params: { ...req.params },
        url: req.url,
        baseUrl: req.baseUrl
      })
      next()
    })
    router.use(['/users/:id/:tail', '/posts/:slug'], child)
    freezeLayers(router)
    freezeLayers(child)

    const first = dispatch(router, firstReq)
    try {
      assert.strictEqual(typeof resume, 'function')
      await dispatch(router, { method: 'GET', url: '/posts/2/detail/b' })
      await dispatch(router, { method: 'GET', url: '/missing' })
    } finally {
      if (resume) resume()
      await first
    }

    assert.deepStrictEqual(observed, [
      { params: { slug: '2', child: 'b' }, url: '/detail/b', baseUrl: '/posts/2' },
      { params: { id: 1, tail: 'ALPHA', child: 'a' }, url: '/detail/a?q=1', baseUrl: '/users/1/alpha' }
    ])
    assert.deepStrictEqual(callbacks, [['id', '1'], ['child', 'b'], ['tail', 'alpha'], ['child', 'a']])
    assert.strictEqual(firstReq.params, parentParams)
    assert.strictEqual(firstReq.url, '/users/1/alpha/detail/a?q=1')
    assert.strictEqual(firstReq.baseUrl, undefined)
  })

  it('should retain the matched keys when mergeParams offsets numeric captures', async function () {
    const router = Router({ mergeParams: true })
    const parentParams = { 0: 'parent' }
    const req = { method: 'GET', url: '/first/second', params: parentParams }
    const callbacks = []
    let observed

    for (const name of ['0', '1', '2']) {
      router.param(name, function (req, res, next, value) {
        callbacks.push([name, value])
        next()
      })
    }
    router.get(/^\/([^/]+)\/([^/]+)$/, function (req, res, next) {
      observed = { ...req.params }
      next()
    })
    freezeLayers(router)

    await dispatch(router, req)

    assert.deepStrictEqual(observed, { 0: 'parent', 1: 'first', 2: 'second' })
    assert.deepStrictEqual(callbacks, [['0', 'parent'], ['1', 'first']])
    assert.strictEqual(req.params, parentParams)
    assert.deepStrictEqual(parentParams, { 0: 'parent' })
  })
})

function dispatch (router, req) {
  return new Promise(function (resolve, reject) {
    router(req, {}, function (err) { err ? reject(err) : resolve() })
  })
}

function freezeLayers (router) {
  for (const layer of router.stack) {
    Object.freeze(layer)
    if (layer.route) layer.route.stack.forEach(Object.freeze)
  }
}
