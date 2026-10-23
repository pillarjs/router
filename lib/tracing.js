/*!
 * router
 * MIT Licensed
 */

'use strict'

const dc = require('node:diagnostics_channel')
const isPromise = require('is-promise')
const deprecate = require('depd')('router')

const requestChannel = dc.tracingChannel && dc.tracingChannel('express.router.request')

// Share error deduplication across layers, parameter callbacks and separately
// installed copies of router handling the same request.
const publishedErrors = Symbol.for('router.tracing.publishedErrors')

exports.requestChannel = requestChannel
exports.shouldTrace = shouldTrace
exports.traceParam = traceParam
exports.wrapNext = wrapNext

// TracingChannel#hasSubscribers is undefined before Node 20.13/22.
function shouldTrace (ch) {
  return Boolean(ch) && (
    ch.start.hasSubscribers ||
    ch.end.hasSubscribers ||
    ch.asyncStart.hasSubscribers ||
    ch.asyncEnd.hasSubscribers ||
    ch.error.hasSubscribers
  )
}

function recordError (req, err) {
  let seen = req[publishedErrors]
  if (!seen) {
    seen = req[publishedErrors] = new Set()
  } else if (seen.has(err)) {
    return false
  }
  seen.add(err)
  return true
}

function wrapNext (ctx, next) {
  return function (err) {
    // Routing signals aren't errors. Report a real error once, at its origin,
    // before forwarding it to another callback, layer or enclosing router.
    if (err && err !== 'route' && err !== 'router' && recordError(ctx.req, err)) {
      ctx.error = err
      requestChannel.error.publish(ctx)
    }
    next(err)
  }
}

// Parameter callbacks have their own signature and promise deprecation. Keep
// their invocation separate from Layer's request/error handler arity checks.
function traceParam (fn, ctx, next, value, name) {
  const wrappedNext = wrapNext(ctx, next)

  requestChannel.start.runStores(ctx, function () {
    try {
      const ret = fn(ctx.req, ctx.res, wrappedNext, value, name)
      if (isPromise(ret)) {
        if (!(ret instanceof Promise)) {
          deprecate('parameters that are Promise-like are deprecated, use a native Promise instead')
        }

        ret.then(
          function () {
            requestChannel.asyncStart.publish(ctx)
            requestChannel.asyncEnd.publish(ctx)
          },
          function (err) {
            wrappedNext(err || new Error('Rejected promise'))
            requestChannel.asyncStart.publish(ctx)
            requestChannel.asyncEnd.publish(ctx)
          }
        )
      }
    } catch (err) {
      wrappedNext(err)
    } finally {
      requestChannel.end.publish(ctx)
    }
  })
}
