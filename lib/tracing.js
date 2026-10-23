/*!
 * router
 * MIT Licensed
 */

'use strict'

const dc = require('node:diagnostics_channel')
const isPromise = require('is-promise')
const deprecate = require('depd')('router')

const requestChannel = dc.tracingChannel && dc.tracingChannel('express.router.request')

// Share error identity tracking across callbacks and router boundaries. Keep
// the registered symbol compatible with separately installed copies of router.
const seenErrors = Symbol.for('router.tracing.publishedErrors')

exports.recordError = recordError
exports.requestChannel = requestChannel
exports.shouldTrace = shouldTrace
exports.traceAsyncEnd = traceAsyncEnd
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

// Remember errors already observed, including those from untraced code or
// route matching. Only the first report from a traced invocation is published.
function recordError (req, err) {
  if (!err || err === 'route' || err === 'router') return false

  let seen = req[seenErrors]
  if (!seen) {
    seen = req[seenErrors] = new Set()
  } else if (seen.has(err)) {
    return false
  }
  seen.add(err)
  return true
}

function wrapNext (ctx, next) {
  // An error received by an error handler did not originate there, even if
  // tracing was disabled at its origin. A replacement error is still reported.
  if (ctx.errorHandler) recordError(ctx.req, ctx.error)

  return function (err) {
    // Routing signals aren't errors. Report a real error once, at its origin,
    // before forwarding it to another callback, layer or enclosing router.
    if (err && recordError(ctx.req, err)) {
      ctx.error = err
      requestChannel.error.publish(ctx)
    }
    next(err)
  }
}

function traceAsyncEnd (ctx) {
  // Scope completion to asyncStart's bound stores without scheduling more work.
  requestChannel.asyncStart.runStores(ctx, publishAsyncEnd, null, ctx)
}

function publishAsyncEnd (ctx) {
  requestChannel.asyncEnd.publish(ctx)
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
            traceAsyncEnd(ctx)
          },
          function (err) {
            wrappedNext(err || new Error('Rejected promise'))
            traceAsyncEnd(ctx)
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
