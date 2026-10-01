const { it, describe, beforeEach, afterEach } = require('mocha')
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

      router.use(function myErrorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
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

      router.use(function myErrorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
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

      router.use(function myErrorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
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

      router.use(function cleanErrorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
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

      router.use(function cleanErrorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
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

      // eslint-disable-next-line no-unused-vars, n/handle-callback-err
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

      // eslint-disable-next-line no-unused-vars, n/handle-callback-err
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
      router.use(function rethrowing (err, req, res, next) { // eslint-disable-line no-unused-vars
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
function recover (err, req, res, next) { // eslint-disable-line no-unused-vars
  res.statusCode = 500
  res.end(err.message)
}
