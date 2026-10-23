const { it, describe, beforeEach, afterEach } = require('mocha')
const { AsyncLocalStorage } = require('node:async_hooks')
const path = require('node:path')
const Router = require('..')
const utils = require('./support/utils')

const assert = utils.assert
const createServer = utils.createServer
const request = utils.request

const CHANNEL = 'express.router.request'

let dc
let tracingChannel

try {
  dc = require('node:diagnostics_channel')
  if (dc.tracingChannel) {
    tracingChannel = dc.tracingChannel
  }
} catch {}

// Node 19 drops a channel once its last subscriber leaves, orphaning the
// router's cached channel. A permanent no-op subscriber keeps it alive.
if (tracingChannel && process.version.startsWith('v19')) {
  const noop = function () {}
  tracingChannel(CHANNEL).subscribe({
    start: noop, end: noop, asyncStart: noop, asyncEnd: noop, error: noop
  })
}

const describeTracing = tracingChannel ? describe : describe.skip

describeTracing('TracingChannel', function () {
  let handlers
  let events

  beforeEach(function () {
    events = []
    handlers = {
      start (ctx) { events.push({ phase: 'start', ctx }) },
      end (ctx) { events.push({ phase: 'end', ctx }) },
      asyncStart (ctx) { events.push({ phase: 'asyncStart', ctx }) },
      asyncEnd (ctx) { events.push({ phase: 'asyncEnd', ctx }) },
      error (ctx) { events.push({ phase: 'error', ctx }) }
    }
  })

  afterEach(function () {
    dc.tracingChannel(CHANNEL).unsubscribe(handlers)
  })

  // Build a router and server with the tracing handlers subscribed.
  function traced () {
    const router = new Router()
    const server = createServer(router)
    dc.tracingChannel(CHANNEL).subscribe(handlers)
    return { router, server }
  }

  describe('when no subscribers', function () {
    it('should not affect normal behavior', function (done) {
      const router = new Router()
      const server = createServer(router)

      router.get('/foo', function (req, res) {
        res.statusCode = 200
        res.end('hello')
      })

      request(server)
        .get('/foo')
        .expect(200, 'hello', done)
    })
  })

  describe('context shape', function () {
    it('should provide req, res, and layer in context', function (done) {
      const { router, server } = traced()

      router.use(function myMiddleware (req, res, next) {
        next()
      })

      router.get('/foo', function (req, res) {
        res.statusCode = 200
        res.end('hello')
      })

      request(server)
        .get('/foo')
        .expect(200, function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const middlewareStart = startEvents.find(function (e) {
            return e.ctx.layer && e.ctx.layer.name === 'myMiddleware'
          })

          assert.ok(middlewareStart, 'should have start event for myMiddleware')
          assert.ok(middlewareStart.ctx.req, 'should have req')
          assert.ok(middlewareStart.ctx.res, 'should have res')
          assert.ok(middlewareStart.ctx.layer, 'should have layer')
          assert.equal(middlewareStart.ctx.layer.name, 'myMiddleware')

          done()
        })
    })

    it('should have layer.name as <anonymous> for unnamed middleware', function (done) {
      const { router, server } = traced()

      router.use(function (req, res, next) {
        next()
      })

      router.get('/foo', function (req, res) {
        res.statusCode = 200
        res.end('hello')
      })

      request(server)
        .get('/foo')
        .expect(200, function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const anonMiddleware = startEvents.find(function (e) {
            return e.ctx.layer && e.ctx.layer.name === '<anonymous>'
          })

          assert.ok(anonMiddleware, 'should have anonymous middleware event')

          done()
        })
    })
  })

  describe('route handler tracing', function () {
    it('should have req.route set for route handlers', function (done) {
      const { router, server } = traced()

      router.get('/users/:id', function getUser (req, res) {
        res.statusCode = 200
        res.end('user')
      })

      request(server)
        .get('/users/123')
        .expect(200, function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const handlerStart = startEvents.find(function (e) {
            return e.ctx.layer && e.ctx.layer.name === 'getUser'
          })

          assert.ok(handlerStart, 'should have start event for getUser')
          assert.ok(handlerStart.ctx.req.route, 'should have req.route')
          assert.equal(handlerStart.ctx.req.route.path, '/users/:id')

          done()
        })
    })

    it('should not trace the route dispatch wrapper', function (done) {
      const { router, server } = traced()

      router.get('/foo', function myHandler (req, res) {
        res.statusCode = 200
        res.end('ok')
      })

      request(server)
        .get('/foo')
        .expect(200, function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const dispatchWrapper = startEvents.find(function (e) {
            return e.ctx.layer && e.ctx.layer.name === 'handle'
          })

          assert.ok(!dispatchWrapper, 'should not have dispatch wrapper event')

          done()
        })
    })
  })

  describe('error handler tracing', function () {
    it('should trace error handlers (fn.length === 4) and flag their ctx as errorHandler', function (done) {
      const { router, server } = traced()

      router.get('/fail', function failingHandler (req, res, next) {
        next(new Error('boom'))
      })

      router.use(function myErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/fail')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const failingEvents = events.filter(byLayer('failingHandler'))
          const errorHandlerEvents = events.filter(byLayer('myErrorHandler'))

          const errorHandlerStart = errorHandlerEvents.find(byPhase('start'))
          assert.ok(errorHandlerStart, 'should have start event for error handler')
          assert.equal(errorHandlerStart.ctx.layer.handle.length, 4)
          assert.equal(errorHandlerStart.ctx.errorHandler, true,
            'error handler ctx should be flagged errorHandler so APMs can dedup the origin error')
          assert.ok(errorHandlerStart.ctx.error,
            'error handler ctx should expose the error it received')

          assert.ok(!errorHandlerEvents.some(byPhase('error')),
            'error handler itself did not throw, so it should not emit error')

          const failingError = failingEvents.find(byPhase('error'))
          assert.ok(failingError, 'origin layer should emit error for next(err)')
          assert.equal(failingError.ctx.error.message, 'boom')
          assert.ok(!failingError.ctx.errorHandler,
            'origin layer is not an error handler, so it should not be flagged errorHandler')

          done()
        })
    })

    it('should emit error on originating layer when next(err) is recovered downstream', function (done) {
      const { router, server } = traced()

      router.get('/fail', function failingHandler (req, res, next) {
        next(new Error('boom'))
      })

      router.use(function myErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/fail')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const failingEvents = events.filter(byLayer('failingHandler'))
          const errorHandlerEvents = events.filter(byLayer('myErrorHandler'))

          const failingError = failingEvents.find(byPhase('error'))
          assert.ok(failingError,
            'originating layer should emit error, since unhandled-at-origin is always observable')
          assert.equal(failingError.ctx.error.message, 'boom')

          assert.ok(!errorHandlerEvents.some(byPhase('error')),
            'recovering error handler itself did not throw, so it should not emit error')

          const errorHandlerStart = errorHandlerEvents.find(byPhase('start'))
          assert.equal(errorHandlerStart.ctx.errorHandler, true,
            'error handler ctx is flagged errorHandler so APMs can dedup against the origin error')

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'exactly one error event fires, on the origin layer that called next(err)')

          done()
        })
    })

    it('should nest the error handler span inside the originating layer span', function (done) {
      const { router, server } = traced()

      router.use(function firstMiddleware (req, res, next) {
        next()
      })

      router.get('/fail', function failingHandler (req, res, next) {
        next(new Error('boom'))
      })

      router.use(function myErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/fail')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const syncEvents = events.filter(function (e) {
            return e.phase === 'start' || e.phase === 'end'
          }).map(function (e) {
            return e.phase + ':' + (e.ctx.layer && e.ctx.layer.name)
          })

          const failingStart = syncEvents.indexOf('start:failingHandler')
          const failingEnd = syncEvents.indexOf('end:failingHandler')
          const errorHandlerStart = syncEvents.indexOf('start:myErrorHandler')
          const errorHandlerEnd = syncEvents.indexOf('end:myErrorHandler')

          assert.notEqual(failingStart, -1, 'failingHandler should have start')
          assert.notEqual(errorHandlerStart, -1, 'myErrorHandler should have start')

          assert.ok(failingStart < errorHandlerStart,
            'failing layer start should come before error handler start')
          assert.ok(errorHandlerStart < errorHandlerEnd,
            'error handler start should come before its own end')
          assert.ok(errorHandlerEnd < failingEnd,
            'error handler end should come before failing layer end. Nesting contract: the error handler that runs via next(err) is nested inside the layer that triggered it, letting APMs attribute the error to the correct parent span')

          done()
        })
    })

    it('should not emit error for next("route") routing signal', function (done) {
      const { router, server } = traced()

      router.get('/skip', function skipToNextRoute (req, res, next) {
        next('route')
      })

      router.get('/skip', function nextRouteHandler (req, res) {
        res.statusCode = 200
        res.end('skipped')
      })

      request(server)
        .get('/skip')
        .expect(200, 'skipped', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 0,
            'next("route") is a routing signal, not an error, so nothing should publish')

          done()
        })
    })

    it('should not emit error for next("router") routing signal', function (done) {
      const { router, server } = traced()

      router.use(function ejectFromRouter (req, res, next) {
        next('router')
      })

      router.get('/foo', function shouldNotRun (req, res) {
        res.statusCode = 200
        res.end('should not reach')
      })

      request(server)
        .get('/foo')
        .expect(404, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 0,
            'next("router") is a routing signal, not an error, so nothing should publish')

          done()
        })
    })

    it('should not emit error when a handler throws the "route" routing signal', function (done) {
      const { router, server } = traced()

      router.get('/skip', function throwRoute (req, res) {
        throw 'route' // eslint-disable-line no-throw-literal
      })

      router.get('/skip', function nextRouteHandler (req, res) {
        res.statusCode = 200
        res.end('skipped')
      })

      request(server)
        .get('/skip')
        .expect(200, 'skipped', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 0,
            'a thrown "route" routing signal is not an error, so nothing should publish')

          done()
        })
    })

    it('should not emit error when a handler throws the "router" routing signal', function (done) {
      const { router, server } = traced()

      router.use(function throwRouter (req, res) {
        throw 'router' // eslint-disable-line no-throw-literal
      })

      router.get('/foo', function shouldNotRun (req, res) {
        res.statusCode = 200
        res.end('should not reach')
      })

      request(server)
        .get('/foo')
        .expect(404, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 0,
            'a thrown "router" routing signal is not an error, so nothing should publish')

          done()
        })
    })

    it('should emit error on originating layer when next(err) is unhandled', function (done) {
      const { router, server } = traced()

      router.get('/fail', function failingHandler (req, res, next) {
        next(new Error('unhandled boom'))
      })

      request(server)
        .get('/fail')
        .expect(500, function (err) {
          if (err) return done(err)

          const failingEvents = events.filter(function (e) {
            return e.ctx.layer && e.ctx.layer.name === 'failingHandler'
          })

          const failingError = failingEvents.find(byPhase('error'))
          assert.ok(failingError,
            'unhandled next(err) must be observable on the origin layer')
          assert.equal(failingError.ctx.error.message, 'unhandled boom')

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'exactly one error event fires, on the origin layer that called next(err)')

          done()
        })
    })
  })

  describe('error channel', function () {
    it('should emit error when handler throws synchronously', function (done) {
      const { router, server } = traced()

      router.get('/throw', function (req, res) {
        throw new Error('sync boom')
      })

      request(server)
        .get('/throw')
        .expect(500, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.ok(errorEvents.length > 0, 'should have error events')

          const errorEvent = errorEvents.find(function (e) {
            return e.ctx.error && e.ctx.error.message === 'sync boom'
          })
          assert.ok(errorEvent, 'should have error event with the thrown error')

          done()
        })
    })

    it('should emit error when async handler rejects', function (done) {
      const { router, server } = traced()

      router.get('/reject', async function (req, res) {
        throw new Error('async boom')
      })

      request(server)
        .get('/reject')
        .expect(500, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.ok(errorEvents.length > 0, 'should have error events')

          const errorEvent = errorEvents.find(function (e) {
            return e.ctx.error && e.ctx.error.message === 'async boom'
          })
          assert.ok(errorEvent, 'should have error event with the rejected error')

          done()
        })
    })

    it('should normalize a falsy rejection to the error the router forwards', function (done) {
      const { router, server } = traced()

      router.get('/reject', async function rejectFalsy (req, res) {
        return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
      })

      request(server)
        .get('/reject')
        .expect(500, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1, 'should report the rejection once')

          const reported = errorEvents[0].ctx.error
          assert.ok(reported instanceof Error,
            'a falsy rejection is reported as the Error the router forwards to next(), not the raw value')
          assert.equal(reported.message, 'Rejected promise')

          done()
        })
    })

    it('should keep routing after a sync falsy throw, same as the untraced path', function (done) {
      const { router, server } = traced()

      router.get('/falsy', function throwsFalsy (req, res) {
        throw undefined // eslint-disable-line no-throw-literal
      })

      router.get('/falsy', function continues (req, res) {
        res.statusCode = 200
        res.end('continued')
      })

      request(server)
        .get('/falsy')
        .expect(200, 'continued', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 0,
            'the untraced router treats a sync falsy throw as next(), so subscribing must not divert it to error handling')

          done()
        })
    })

    it('should emit error on route only when sync throw is recovered by a clean error handler', function (done) {
      const { router, server } = traced()

      router.get('/throw', function throwingHandler (req, res) {
        throw new Error('sync boom')
      })

      router.use(function cleanErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/throw')
        .expect(500, 'sync boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1, 'exactly one error event should fire')
          assert.equal(errorEvents[0].ctx.layer.name, 'throwingHandler',
            'error event should belong to the throwing route layer')

          done()
        })
    })

    it('should emit error on route only when async reject is recovered by a clean error handler', function (done) {
      const { router, server } = traced()

      router.get('/reject', async function rejectingHandler (req, res) {
        throw new Error('async boom')
      })

      router.use(function cleanErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/reject')
        .expect(500, 'async boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1, 'exactly one error event should fire')
          assert.equal(errorEvents[0].ctx.layer.name, 'rejectingHandler',
            'error event should belong to the rejecting route layer')

          done()
        })
    })

    it('should emit error on both layers when sync throw is followed by a throwing error handler', function (done) {
      const { router, server } = traced()

      router.get('/throw', function throwingHandler (req, res) {
        throw new Error('sync boom')
      })

      // eslint-disable-next-line n/handle-callback-err
      router.use(function throwingErrorHandler (err, req, res, next) {
        throw new Error('handler boom')
      })

      request(server)
        .get('/throw')
        .expect(500, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))

          assert.equal(errorEvents.length, 2, 'error should fire on both layers')

          const routeError = errorEvents.find(byLayer('throwingHandler'))
          assert.ok(routeError, 'route layer should emit error')
          assert.ok(!routeError.ctx.errorHandler,
            'route layer is not an error handler, so errorHandler flag must be absent')

          const handlerError = errorEvents.find(byLayer('throwingErrorHandler'))
          assert.ok(handlerError, 'error handler should emit its own error')
          assert.equal(handlerError.ctx.errorHandler, true,
            'error handler\'s own error event must carry errorHandler:true so APMs can classify the span correctly')

          done()
        })
    })

    it('should emit error on both layers when async reject is followed by a throwing error handler', function (done) {
      const { router, server } = traced()

      router.get('/reject', async function rejectingHandler (req, res) {
        throw new Error('async boom')
      })

      // eslint-disable-next-line n/handle-callback-err
      router.use(function throwingErrorHandler (err, req, res, next) {
        throw new Error('handler boom')
      })

      request(server)
        .get('/reject')
        .expect(500, function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))

          assert.equal(errorEvents.length, 2, 'error should fire on both layers')

          const routeError = errorEvents.find(byLayer('rejectingHandler'))
          assert.ok(routeError, 'route layer should emit error')
          assert.ok(!routeError.ctx.errorHandler,
            'route layer is not an error handler, so errorHandler flag must be absent')

          const handlerError = errorEvents.find(byLayer('throwingErrorHandler'))
          assert.ok(handlerError, 'error handler should emit its own error')
          assert.equal(handlerError.ctx.errorHandler, true,
            'error handler\'s own error event must carry errorHandler:true so APMs can classify the span correctly')

          done()
        })
    })
  })

  describe('async handlers', function () {
    it('should trace async handlers that return promises', function (done) {
      const { router, server } = traced()

      router.get('/async', function asyncHandler (req, res) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            res.statusCode = 200
            res.end('async hello')
            resolve()
          }, 10)
        })
      })

      request(server)
        .get('/async')
        .expect(200, 'async hello', function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const asyncEndEvents = events.filter(byPhase('asyncEnd'))

          assert.ok(startEvents.length > 0, 'should have start events')
          assert.ok(asyncEndEvents.length > 0, 'should have asyncEnd events')

          done()
        })
    })
  })

  describe('nested routers', function () {
    it('should trace middleware in nested routers', function (done) {
      const { router, server } = traced()
      const nested = new Router()

      nested.get('/bar', function nestedHandler (req, res) {
        res.statusCode = 200
        res.end('nested')
      })

      router.use('/foo', nested)

      request(server)
        .get('/foo/bar')
        .expect(200, 'nested', function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const handlerEvent = startEvents.find(function (e) {
            return e.ctx.layer && e.ctx.layer.name === 'nestedHandler'
          })
          assert.ok(handlerEvent, 'should have event from nested route handler')
          assert.ok(handlerEvent.ctx.req.route, 'should have req.route')

          done()
        })
    })
  })

  describe('parameter callbacks', function () {
    it('should report the parameter callback with only an error subscriber', async function () {
      const router = new Router()
      const server = createServer(router)
      dc.tracingChannel(CHANNEL).error.subscribe(handlers.error)

      function validateId (req, res, next) { next(new Error('Invalid ID')) }

      router.param('id', validateId)
      router.get('/users/:id', function unexpected (req, res) { res.end('unexpected') })
      router.use(function forwarding (err, req, res, next) { next(err) })
      router.use(recover)

      await request(server).get('/users/123').expect(500, 'Invalid ID')

      assert.strictEqual(events.length, 1)
      assert.strictEqual(events[0].phase, 'error')
      assert.strictEqual(events[0].ctx.handler, validateId)
      assert.strictEqual(events[0].ctx.param, 'id')
    })

    it('should run asynchronous parameter callbacks in the bound tracing store', async function () {
      const { router, server } = traced()
      const store = new AsyncLocalStorage()
      const channel = dc.tracingChannel(CHANNEL).start
      channel.bindStore(store, function (ctx) { return ctx })
      let observed

      async function load (req, res, next) {
        observed = store.getStore()
        await new Promise(function (resolve) { setImmediate(resolve) })
        assert.strictEqual(store.getStore(), observed)
        next()
      }

      router.param('id', load)
      router.get('/users/:id', function user (req, res) {
        assert.notStrictEqual(store.getStore(), observed)
        res.end('ok')
      })

      try {
        await request(server).get('/users/123').expect(200, 'ok')
        assert.strictEqual(observed.handler, load)
        assert.strictEqual(observed.param, 'id')
        assert.strictEqual(observed.route, '/users/:id')
      } finally {
        channel.unbindStore(store)
        store.disable()
      }
    })

    for (const failure of ['next', 'throw', 'reject', 'async next']) {
      for (const forward of [false, true]) {
        it('should report a parameter ' + failure + ' at its origin when ' + (forward ? 'forwarded' : 'recovered'), async function () {
          const { router, server } = traced()
          const error = new Error('Invalid ID')

          function validateId (req, res, next) {
            if (failure === 'throw') throw error
            if (failure === 'reject') return Promise.reject(error)
            if (failure === 'async next') return setImmediate(next, error)
            next(error)
          }

          router.param('id', validateId)
          router.get('/users/:id', function unexpected (req, res) { res.end('unexpected') })

          if (forward) {
            router.use(function forwarding (err, req, res, next) { next(err) })
          }
          router.use(recover)

          await request(server).get('/users/123').expect(500, 'Invalid ID')

          const errors = events.filter(byPhase('error'))
          assert.strictEqual(errors.length, 1)
          const ctx = errors[0].ctx
          assert.strictEqual(ctx.error, error)
          assert.strictEqual(ctx.handler, validateId)
          assert.strictEqual(ctx.param, 'id')
          assert.strictEqual(ctx.route, '/users/:id')
          assert.strictEqual(ctx.layer, router.stack[0])
          assert.strictEqual(ctx.errorHandler, undefined)

          const ownEvents = events.filter(function (e) { return e.ctx === ctx })
          assert.deepStrictEqual(ownEvents.map(function (e) { return e.phase }), failure === 'reject'
            ? ['start', 'end', 'error', 'asyncStart', 'asyncEnd']
            : failure === 'async next' ? ['start', 'end', 'error'] : ['start', 'error', 'end'])
        })
      }
    }

    it('should retain callback identity and arguments when parameters are chained and cached', async function () {
      const { router, server } = traced()

      function normalizeId (req, res, next, value, name) {
        assert.strictEqual(value, '123')
        assert.strictEqual(name, 'id')
        req.params.id = Number(value)
        next()
      }

      function loadUser (req, res, next, value, name) {
        assert.strictEqual(value, '123')
        assert.strictEqual(name, 'id')
        assert.strictEqual(req.params.id, 123)
        next()
        return Promise.resolve()
      }

      function validateSlug (req, res, next, value, name) {
        assert.strictEqual(value, 'profile')
        assert.strictEqual(name, 'slug')
        next()
      }

      router.param('id', normalizeId)
      router.param('id', loadUser)
      router.param('slug', validateSlug)
      router.use('/users/:id/:slug', function middleware (req, res, next) { next() })
      router.get('/users/:id/:slug', function user (req, res) {
        assert.strictEqual(req.params.id, 123)
        res.end('ok')
      })

      await request(server).get('/users/123/profile').expect(200, 'ok')

      const starts = events.filter(byPhase('start')).filter(function (e) { return e.ctx.param !== undefined })
      assert.deepStrictEqual(starts.map(function (e) { return [e.ctx.handler, e.ctx.param] }),
        [[normalizeId, 'id'], [loadUser, 'id'], [validateSlug, 'slug']])
      for (const event of starts) {
        assert.strictEqual(event.ctx.layer, router.stack[0])
        assert.strictEqual(event.ctx.route, '/users/:id/:slug')
        assert.strictEqual(event.ctx.req.originalUrl, '/users/123/profile')
        assert.ok(event.ctx.res)
      }
      assert.deepStrictEqual(events.filter(function (e) { return e.ctx.handler === loadUser })
        .map(function (e) { return e.phase }), ['start', 'end', 'asyncStart', 'asyncEnd'])
      assert.strictEqual(router.stack[0].name, 'middleware')
    })

    it('should wait for next even when a parameter promise resolves', async function () {
      const { router } = traced()
      let resume
      let reached = false

      function load (req, res, next) {
        resume = next
        return Promise.resolve()
      }

      router.param('id', load)
      router.get('/users/:id', function user (req, res, next) {
        reached = true
        next()
      })

      const completed = new Promise(function (resolve, reject) {
        router({ method: 'GET', url: '/users/123' }, {}, function (err) {
          if (err) return reject(err)
          resolve()
        })
      })

      await new Promise(function (resolve) { setImmediate(resolve) })
      assert.strictEqual(reached, false)
      assert.deepStrictEqual(events.filter(function (e) { return e.ctx.handler === load })
        .map(function (e) { return e.phase }), ['start', 'end', 'asyncStart', 'asyncEnd'])
      resume()
      await completed
      assert.strictEqual(reached, true)
    })

    for (const signal of ['route', 'router']) {
      for (const kind of ['next', 'throw', 'reject']) {
        it('should preserve a parameter ' + kind + ' with the ' + signal + ' signal', async function () {
          const { router, server } = traced()
          const nested = new Router()

          function skip (req, res, next) {
            if (kind === 'throw') throw signal
            if (kind === 'reject') return Promise.reject(signal)
            next(signal)
          }

          nested.param('id', skip)
          nested.get('/users/:id', function unexpected (req, res) { res.end('unexpected') })
          nested.get('/users/123', function fallback (req, res) { res.end('route') })
          router.use(nested)
          router.get('/users/123', function outer (req, res) { res.end('router') })

          await request(server).get('/users/123').expect(200, signal)

          assert.strictEqual(events.filter(byPhase('error')).length, 0)
          const ownEvents = events.filter(function (e) { return e.ctx.handler === skip })
          assert.deepStrictEqual(ownEvents.map(function (e) { return e.phase }), kind === 'reject'
            ? ['start', 'end', 'asyncStart', 'asyncEnd']
            : ['start', 'end'])
          assert.strictEqual(ownEvents[0].ctx.param, 'id')
        })
      }
    }

    for (const kind of ['throw', 'reject']) {
      it('should preserve a falsy parameter ' + kind, async function () {
        const { router, server } = traced()

        function falsy (req, res, next) {
          if (kind === 'throw') throw undefined // eslint-disable-line no-throw-literal
          return Promise.reject() // eslint-disable-line prefer-promise-reject-errors
        }

        router.param('id', falsy)
        router.get('/users/:id', function user (req, res) { res.end('ok') })
        router.use(recover)

        await request(server).get('/users/123')
          .expect(kind === 'reject' ? 500 : 200, kind === 'reject' ? 'Rejected promise' : 'ok')

        const errors = events.filter(byPhase('error'))
        assert.strictEqual(errors.length, kind === 'reject' ? 1 : 0)
        if (kind === 'reject') {
          assert.strictEqual(errors[0].ctx.handler, falsy)
          assert.strictEqual(errors[0].ctx.error.message, 'Rejected promise')
        }
      })
    }

    it('should report a parameter error once across separately loaded routers', async function () {
      const { router, server } = traced()
      const RouterCopy = loadRouterCopy()
      const nested = new RouterCopy()

      function validateId (req, res, next) { next(new Error('Invalid ID')) }

      nested.param('id', validateId)
      nested.get('/users/:id', function unexpected (req, res) { res.end('unexpected') })
      nested.use(function forwarding (err, req, res, next) { next(err) })
      router.use('/api', nested)
      router.use(function rethrowing (err, req, res, next) { throw err })
      router.use(recover)

      await request(server).get('/api/users/123').expect(500, 'Invalid ID')

      assert.notStrictEqual(RouterCopy, Router)
      const errors = events.filter(byPhase('error'))
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].ctx.handler, validateId)
      assert.strictEqual(errors[0].ctx.layer, nested.stack[0])
      assert.strictEqual(errors[0].ctx.route, '/users/:id')
      assert.strictEqual(errors[0].ctx.param, 'id')
    })

    it('should attribute downstream errors to the handler instead of the parameter callback', async function () {
      const { router, server } = traced()

      function load (req, res, next) { next() }
      function fail (req, res) { throw new Error('route failed') }

      router.param('id', load)
      router.get('/users/:id', fail)
      router.use(recover)

      await request(server).get('/users/123').expect(500, 'route failed')

      const errors = events.filter(byPhase('error'))
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].ctx.handler, fail)
      assert.strictEqual(errors[0].ctx.param, undefined)
    })

    for (const fail of [false, true]) {
      it('should preserve the parameter context across concurrent requests that ' + (fail ? 'fail' : 'succeed'), async function () {
        const { router, server } = traced()
        let resume
        let entered
        const waiting = new Promise(function (resolve) { entered = resolve })

        function load (req, res, next, id) {
          if (id !== '1') {
            next()
            return Promise.resolve()
          }
          return new Promise(function (resolve, reject) {
            resume = function () {
              if (fail) {
                reject(new Error('first failed'))
              } else {
                next()
                resolve()
              }
            }
            entered()
          })
        }

        router.param('id', load)
        router.get(['/users/:id', '/posts/:id'], function item (req, res) { res.end(req.params.id) })
        router.use(recover)

        const first = request(server).get('/users/1').expect(fail ? 500 : 200, fail ? 'first failed' : '1')
          .then(function () {})
        await waiting
        try {
          await request(server).get('/posts/2').expect(200, '2')
        } finally {
          resume()
          await first
        }

        const ownEvents = events.filter(function (e) { return e.ctx.handler === load })
        for (const url of ['/users/1', '/posts/2']) {
          const requestEvents = ownEvents.filter(function (e) { return e.ctx.req.originalUrl === url })
          assert.deepStrictEqual(requestEvents.map(function (e) { return e.phase }), fail && url === '/users/1'
            ? ['start', 'end', 'error', 'asyncStart', 'asyncEnd']
            : ['start', 'end', 'asyncStart', 'asyncEnd'])
          for (const event of requestEvents) {
            assert.strictEqual(event.ctx.route, url === '/users/1' ? '/users/:id' : '/posts/:id')
            assert.strictEqual(event.ctx.param, 'id')
          }
        }
      })
    }
  })

  describe('route pattern', function () {
    function startFor (predicate) {
      return events.filter(byPhase('start')).find(function (e) {
        return predicate(e.ctx.layer)
      })
    }

    it('should provide the matched path for middleware', function (done) {
      const { router, server } = traced()

      router.use('/api/:version', function apiMiddleware (req, res, next) {
        next()
      })

      router.get('/api/:version/users', function (req, res) {
        res.statusCode = 200
        res.end('users')
      })

      request(server)
        .get('/api/v1/users')
        .expect(200, 'users', function (err) {
          if (err) return done(err)

          const startEvent = startFor(function (layer) { return layer.name === 'apiMiddleware' })
          assert.ok(startEvent, 'should have start event for apiMiddleware')
          assert.equal(startEvent.ctx.route, '/api/:version')

          done()
        })
    })

    it('should provide the route path for route handlers', function (done) {
      const { router, server } = traced()

      router.get('/users/:id', function getUser (req, res) {
        res.statusCode = 200
        res.end('user')
      })

      request(server)
        .get('/users/42')
        .expect(200, 'user', function (err) {
          if (err) return done(err)

          const startEvent = startFor(function (layer) { return layer.name === 'getUser' })
          assert.ok(startEvent, 'should have start event for getUser')
          assert.equal(startEvent.ctx.route, '/users/:id')

          done()
        })
    })

    it('should provide the path that matched for array paths', function (done) {
      const { router, server } = traced()

      router.get(['/foo', ['/bar', '/baz/:id']], function multi (req, res) {
        res.statusCode = 200
        res.end('multi')
      })

      request(server)
        .get('/baz/1')
        .expect(200, 'multi', function (err) {
          if (err) return done(err)

          const startEvent = startFor(function (layer) { return layer.name === 'multi' })
          assert.ok(startEvent, 'should have start event for multi')
          assert.equal(startEvent.ctx.route, '/baz/:id')

          done()
        })
    })

    for (const kind of ['route handlers', 'middleware', 'error middleware']) {
      for (const otherPath of ['/posts/2', '/missing']) {
        it('should preserve the matched path for ' + kind + ' during a request to ' + otherPath, async function () {
          const { router, server } = traced()
          let resume
          let entered
          const waiting = new Promise(function (resolve) { entered = resolve })

          router.param('id', function (req, res, next, id) {
            if (id === '1') {
              resume = next
              entered()
            } else {
              next()
            }
          })

          const handler = kind === 'error middleware'
            ? function onError (err, req, res, next) {
              assert.equal(err.message, 'boom')
              res.statusCode = 500
              res.end(req.params.id)
            }
            : function onRequest (req, res) {
              res.end(req.params.id)
            }

          if (kind === 'error middleware') {
            router.use(function (req, res, next) { next(new Error('boom')) })
          }

          router[kind === 'route handlers' ? 'get' : 'use'](['/users/:id', '/posts/:id'], handler)

          // Handle unmatched requests with a pending error without finalhandler logging it.
          router.use(function (err, req, res, next) {
            res.statusCode = 404
            res.end(err.message)
          })

          const status = kind === 'error middleware' ? 500 : 200
          const first = request(server).get('/users/1').expect(status, '1').then(function () {})

          await waiting
          try {
            await request(server).get(otherPath).expect(otherPath === '/missing' ? 404 : status)
          } finally {
            resume()
            await first
          }

          const paths = events.filter(byPhase('start'))
            .filter(function (e) { return e.ctx.handler === handler })
            .map(function (e) { return [e.ctx.req.originalUrl, e.ctx.route] })

          assert.deepStrictEqual(paths, otherPath === '/missing'
            ? [['/users/1', '/users/:id']]
            : [['/posts/2', '/posts/:id'], ['/users/1', '/users/:id']])
        })
      }
    }

    it('should preserve an empty matched pattern', async function () {
      const { router, server } = traced()

      router.get('', function root (req, res) { res.end('root') })

      await request(server).get('/').expect(200, 'root')

      const event = startFor(function (layer) { return layer.name === 'root' })
      assert.ok(event)
      assert.strictEqual(event.ctx.route, '')
    })

    for (const signal of ['next', 'error', 'router']) {
      it('should restore the outer route pattern after a nested router calls ' + signal, async function () {
        const { router, server } = traced()
        const nested = new Router()
        const fail = signal === 'error'

        nested.get('/users/*rest', function inner (req, res, next) {
          setImmediate(next, fail ? new Error('boom') : signal === 'router' ? 'router' : undefined)
        })

        router.get('/users/:id', nested,
          function outer (req, res) { res.end('outer') },
          function outerError (err, req, res, next) {
            res.statusCode = 500
            res.end(err.message)
          })

        await request(server).get('/users/1').expect(fail ? 500 : 200, fail ? 'boom' : 'outer')

        const innerEvent = startFor(function (layer) { return layer.name === 'inner' })
        const outerEvent = startFor(function (layer) { return layer.name === (fail ? 'outerError' : 'outer') })
        assert.ok(innerEvent)
        assert.ok(outerEvent)
        assert.strictEqual(innerEvent.ctx.route, '/users/*rest')
        assert.strictEqual(outerEvent.ctx.route, '/users/:id')
      })
    }

    it('should preserve the route pattern while a parameter callback invokes a router', async function () {
      const { router, server } = traced()
      const nested = new Router()

      nested.use(function middleware (req, res, next) { setImmediate(next) })
      router.param('id', function (req, res, next) { nested(req, res, next) })
      router.get('/users/:id', function user (req, res) { res.end(req.params.id) })

      await request(server).get('/users/1').expect(200, '1')

      const middlewareEvent = startFor(function (layer) { return layer.name === 'middleware' })
      const userEvent = startFor(function (layer) { return layer.name === 'user' })
      assert.ok(middlewareEvent)
      assert.ok(userEvent)
      assert.strictEqual(middlewareEvent.ctx.route, '/')
      assert.strictEqual(userEvent.ctx.route, '/users/:id')
    })

    it('should provide the route path for error handlers inside a route', function (done) {
      const { router, server } = traced()

      router.get('/fail/:id', function fail (req, res, next) {
        next(new Error('boom'))
      }, function routeErrorHandler (err, req, res, next) {
        res.statusCode = 500
        res.end(err.message)
      })

      request(server)
        .get('/fail/1')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const startEvent = startFor(function (layer) { return layer.name === 'routeErrorHandler' })
          assert.ok(startEvent, 'should have start event for routeErrorHandler')
          assert.equal(startEvent.ctx.route, '/fail/:id')

          done()
        })
    })

    it('should provide the mount path for mounted routers', function (done) {
      const { router, server } = traced()
      const nested = new Router()

      nested.get('/:id', function getItem (req, res) {
        res.statusCode = 200
        res.end('item')
      })

      router.use('/items', nested)

      request(server)
        .get('/items/7')
        .expect(200, 'item', function (err) {
          if (err) return done(err)

          const mountEvent = startFor(function (layer) { return layer.handle === nested })
          const itemEvent = startFor(function (layer) { return layer.name === 'getItem' })
          assert.ok(mountEvent, 'should have start event for the mounted router')
          assert.ok(itemEvent, 'should have start event for getItem')
          assert.equal(mountEvent.ctx.route, '/items')
          assert.equal(itemEvent.ctx.route, '/:id')

          done()
        })
    })
  })

  describe('error deduplication', function () {
    it('should report a next(err) error once, on the origin layer, across mounted routers', function (done) {
      const { router: outer, server } = traced()
      const nested = new Router()

      nested.get('/bar', function innerHandler (req, res, next) {
        next(new Error('boom'))
      })
      outer.use('/foo', nested)
      outer.use(recover)

      request(server)
        .get('/foo/bar')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'the same error bubbling through the mounted router must be reported once')
          assert.equal(errorEvents[0].ctx.layer.name, 'innerHandler',
            'the single error event belongs to the origin layer')

          done()
        })
    })

    it('should report a next(err) error once across separate copies of the router', function (done) {
      const { router: outer, server } = traced()
      const RouterCopy = loadRouterCopy()
      const nested = new RouterCopy()

      assert.notStrictEqual(RouterCopy, Router)

      nested.get('/bar', function innerHandler (req, res, next) {
        next(new Error('boom'))
      })
      outer.use('/foo', nested)
      outer.use(recover)

      request(server)
        .get('/foo/bar')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'an app can end up with multiple copies of router, so dedup must not be scoped to one copy')
          assert.equal(errorEvents[0].ctx.layer.name, 'innerHandler')

          done()
        })
    })

    it('should report a next(err) error once across two mount levels', function (done) {
      const { router: outer, server } = traced()
      const mid = new Router()
      const deep = new Router()

      deep.get('/baz', function deepHandler (req, res, next) {
        next(new Error('boom'))
      })
      mid.use('/bar', deep)
      outer.use('/foo', mid)
      outer.use(recover)

      request(server)
        .get('/foo/bar/baz')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'the error must not be re-reported at each ancestor router')
          assert.equal(errorEvents[0].ctx.layer.name, 'deepHandler')

          done()
        })
    })

    it('should report a thrown error once across mounted routers', function (done) {
      const { router: outer, server } = traced()
      const nested = new Router()

      nested.get('/bar', function innerThrow (req, res) {
        throw new Error('boom')
      })
      outer.use('/foo', nested)
      outer.use(recover)

      request(server)
        .get('/foo/bar')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'a thrown error must be reported once, at its origin')
          assert.equal(errorEvents[0].ctx.layer.name, 'innerThrow')

          done()
        })
    })

    it('should report a rejected error once across mounted routers', function (done) {
      const { router: outer, server } = traced()
      const nested = new Router()

      nested.get('/bar', async function innerReject (req, res) {
        throw new Error('boom')
      })
      outer.use('/foo', nested)
      outer.use(recover)

      request(server)
        .get('/foo/bar')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'a rejected error must be reported once, at its origin')
          assert.equal(errorEvents[0].ctx.layer.name, 'innerReject')

          done()
        })
    })

    it('should report next(err) once when an error handler forwards it', function (done) {
      const { router, server } = traced()

      router.get('/fail', function origin (req, res, next) {
        next(new Error('boom'))
      })
      router.use(function forwarding (err, req, res, next) {
        next(err)
      })
      router.use(recover)

      request(server)
        .get('/fail')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'forwarding the same error with next(err) must not re-report it')
          assert.equal(errorEvents[0].ctx.layer.name, 'origin')

          done()
        })
    })

    it('should report next(err) once when an error handler rethrows it', function (done) {
      const { router, server } = traced()

      router.get('/fail', function origin (req, res, next) {
        next(new Error('boom'))
      })
      router.use(function rethrowing (err, req, res, next) {
        throw err
      })
      router.use(recover)

      request(server)
        .get('/fail')
        .expect(500, 'boom', function (err) {
          if (err) return done(err)

          const errorEvents = events.filter(byPhase('error'))
          assert.equal(errorEvents.length, 1,
            'throw err and next(err) are equivalent to the router, so rethrowing the same error must not re-report it')
          assert.equal(errorEvents[0].ctx.layer.name, 'origin')

          done()
        })
    })
  })

  describe('event ordering', function () {
    it('should emit only start and end for a synchronous handler', function (done) {
      const { router, server } = traced()

      router.get('/order', function syncHandler (req, res) {
        res.statusCode = 200
        res.end('ok')
      })

      request(server)
        .get('/order')
        .expect(200, function (err) {
          if (err) return done(err)

          const phases = events.filter(byLayer('syncHandler')).map(function (e) { return e.phase })
          assert.equal(phases.length, 2, 'a synchronous handler has no async phase')
          assert.equal(phases[0], 'start')
          assert.equal(phases[1], 'end')
          assert.ok(phases.indexOf('asyncStart') < 0 && phases.indexOf('asyncEnd') < 0,
            'a synchronous handler should not emit asyncStart/asyncEnd')

          done()
        })
    })

    it('should emit start before asyncEnd for an asynchronous handler', function (done) {
      const { router, server } = traced()

      router.get('/order', async function asyncHandler (req, res) {
        res.statusCode = 200
        res.end('ok')
      })

      request(server)
        .get('/order')
        .expect(200, function (err) {
          if (err) return done(err)

          const phases = events.filter(byLayer('asyncHandler')).map(function (e) { return e.phase })
          assert.ok(phases.indexOf('start') >= 0, 'should have start')
          assert.ok(phases.indexOf('asyncEnd') >= 0, 'should have asyncEnd')
          assert.ok(phases.indexOf('start') < phases.indexOf('asyncEnd'),
            'start should come before asyncEnd')

          done()
        })
    })
  })

  describe('multiple middleware', function () {
    it('should emit events for each middleware in the chain', function (done) {
      const { router, server } = traced()

      router.use(function first (req, res, next) {
        next()
      })

      router.use(function second (req, res, next) {
        next()
      })

      router.get('/multi', function handler (req, res) {
        res.statusCode = 200
        res.end('multi')
      })

      request(server)
        .get('/multi')
        .expect(200, function (err) {
          if (err) return done(err)

          const startEvents = events.filter(byPhase('start'))
          const names = startEvents.map(function (e) { return e.ctx.layer.name })

          assert.ok(names.indexOf('first') >= 0, 'should trace first middleware')
          assert.ok(names.indexOf('second') >= 0, 'should trace second middleware')

          done()
        })
    })
  })
})

// Load a separate instance of the router module, as when an app installs more
// than one copy (e.g. a direct dependency alongside the one bundled by express).
function loadRouterCopy () {
  const root = path.dirname(require.resolve('..'))
  const isRouterModule = function (key) {
    return key === path.join(root, 'index.js') || key.startsWith(path.join(root, 'lib') + path.sep)
  }

  const original = {}
  Object.keys(require.cache).filter(isRouterModule).forEach(function (key) {
    original[key] = require.cache[key]
    delete require.cache[key]
  })

  try {
    return require('..')
  } finally {
    Object.keys(require.cache).filter(isRouterModule).forEach(function (key) {
      delete require.cache[key]
    })
    Object.assign(require.cache, original)
  }
}

// Predicate matching a captured event by its layer name.
function byLayer (name) {
  return function (e) { return e.ctx.layer && e.ctx.layer.name === name }
}

// Predicate matching a captured event by its lifecycle phase.
function byPhase (name) {
  return function (e) { return e.phase === name }
}

// Error handler that recovers by ending the response with the error message.
function recover (err, req, res, next) {
  res.statusCode = 500
  res.end(err.message)
}
