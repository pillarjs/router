/*!
 * router
 * MIT Licensed
 */

'use strict'

const dc = require('node:diagnostics_channel')
const isPromise = require('is-promise')
const callParam = require('./param')

const requestChannel = dc.tracingChannel && dc.tracingChannel('express.router.request')

// Share error identity tracking across callbacks and router boundaries. Keep
// the registered symbol compatible with separately installed copies of router.
const seenErrors = Symbol.for('router.tracing.publishedErrors')

exports.publishEnd = publishEnd
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
  if (ctx.errorHandler) recordError(ctx.req, ctx.incomingError)

  // An error reported before the handler returns is held until publishEnd,
  // since it can't be placed around `end` until we know if a promise follows.
  let running = true
  let pending

  function wrappedNext (err) {
    // Routing signals aren't errors. Report a real error once, at its origin,
    // before forwarding it to another callback, layer or enclosing router.
    if (err && recordError(ctx.req, err)) {
      if (!running) publishError(ctx, err)
      else if (!pending) pending = err
    }
    next(err)
  }

  wrappedNext.release = function release () {
    running = false
    if (pending) publishError(ctx, pending)
  }

  return wrappedNext
}

function publishError (ctx, err) {
  ctx.error = err
  requestChannel.error.publish(ctx)
}

// Same as tracePromise, an error from a sync return is published before `end`
// and one from a promise after it, so `result` or `error` at `end` means done.
function publishEnd (ctx, wrappedNext, async) {
  if (!async) wrappedNext.release()
  requestChannel.end.publish(ctx)
  if (async) wrappedNext.release()
}

function traceAsyncEnd (ctx) {
  // Scope completion to asyncStart's bound stores without scheduling more work.
  requestChannel.asyncStart.runStores(ctx, publishAsyncEnd, null, ctx)
}

function publishAsyncEnd (ctx) {
  requestChannel.asyncEnd.publish(ctx)
}

// Wrap the shared parameter invocation with its tracing context and lifecycle.
function traceParam (fn, ctx, next, value, name) {
  const wrappedNext = wrapNext(ctx, next)
  let async = false

  requestChannel.start.runStores(ctx, function () {
    try {
      callParam(invoke, ctx.req, ctx.res, wrappedNext, value, name, settle)
    } finally {
      publishEnd(ctx, wrappedNext, async)
    }
  })

  // Same as layers, a throw skips the assignment so no result is set
  function invoke (req, res, next, value, name) {
    const ret = fn(req, res, next, value, name)
    async = isPromise(ret)
    if (!async) ctx.result = ret

    return ret
  }

  function settle (value, rejected) {
    if (!rejected) ctx.result = value
    traceAsyncEnd(ctx)
  }
}
