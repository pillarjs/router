/*!
 * router
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2022 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

const dc = require('node:diagnostics_channel')
const isPromise = require('is-promise')
const pathRegexp = require('path-to-regexp')
const debug = require('debug')('router:layer')
const deprecate = require('depd')('router')

/**
 * Module variables.
 * @private
 */

const TRAILING_SLASH_REGEXP = /\/+$/
const MATCHING_GROUP_REGEXP = /\((?:\?<(.*?)>)?(?!\?)/g

/**
 * TracingChannel setup.
 * @private
 */

const requestChannel = dc.tracingChannel && dc.tracingChannel('express.router.request')

// Tracks errors already reported for a request so the same error bubbling up
// through mounted routers or forwarding error handlers is only reported once.
// Registered globally so the dedup holds when an app loads multiple copies of
// router (e.g. a direct dependency alongside the one bundled by express).
const publishedErrors = Symbol.for('router.tracing.publishedErrors')

// TracingChannel#hasSubscribers is undefined before Node 20.13/22, so check the sub-channels.
function shouldTrace (ch) {
  return Boolean(ch) && (
    ch.start.hasSubscribers ||
    ch.end.hasSubscribers ||
    ch.asyncStart.hasSubscribers ||
    ch.asyncEnd.hasSubscribers ||
    ch.error.hasSubscribers
  )
}

/**
 * Expose `Layer`.
 */

module.exports = Layer

function Layer (path, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(path, options, fn)
  }

  debug('new %o', path)
  const opts = options || {}

  this.handle = fn
  this.keys = []
  this.name = fn.name || '<anonymous>'
  this.params = undefined
  this.path = undefined
  // flat unnests nested path arrays and snapshots the caller's array
  this.rawPath = Array.isArray(path) ? path.flat(Infinity) : path
  this.slash = path === '/' && opts.end === false

  function matcher (_path) {
    if (_path instanceof RegExp) {
      const keys = []
      let name = 0
      let m
      // eslint-disable-next-line no-cond-assign
      while (m = MATCHING_GROUP_REGEXP.exec(_path.source)) {
        keys.push({
          name: m[1] || name++,
          offset: m.index
        })
      }

      return function regexpMatcher (p) {
        const match = _path.exec(p)
        if (!match) {
          return false
        }

        const params = {}
        for (let i = 1; i < match.length; i++) {
          const key = keys[i - 1]
          const prop = key.name
          const val = decodeParam(match[i])

          if (val !== undefined) {
            params[prop] = val
          }
        }

        return {
          params,
          path: match[0]
        }
      }
    }

    return pathRegexp.match((opts.strict ? _path : loosen(_path)), {
      sensitive: opts.sensitive,
      end: opts.end,
      trailing: !opts.strict,
      decode: decodeParam
    })
  }
  this.matchers = Array.isArray(path) ? path.map(matcher) : [matcher(path)]
}

/**
 * Handle the error for the layer.
 *
 * @param {Error} error
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 * @api private
 */

Layer.prototype.handleError = function handleError (error, req, res, next) {
  const fn = this.handle

  if (fn.length !== 4) {
    // not a standard error handler
    return next(error)
  }

  if (!shouldTrace(requestChannel)) {
    try {
      // invoke function
      const ret = handlePromise(fn(error, req, res, next))

      // wait for returned promise
      if (ret) {
        ret.then(null, function (error) {
          next(error || new Error('Rejected promise'))
        })
      }
    } catch (err) {
      next(err)
    }
    return
  }

  invokeWithTrace(function (wrappedNext) {
    return fn(error, req, res, wrappedNext)
  }, {
    req,
    res,
    error,
    layer: this,
    errorHandler: true
  }, next)
}

/**
 * Handle the request for the layer.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 * @api private
 */

Layer.prototype.handleRequest = function handleRequest (req, res, next) {
  const fn = this.handle

  if (fn.length > 3) {
    // not a standard request handler
    return next()
  }

  // Skip tracing for route dispatch wrappers (this.route is only set on the
  // internal layer that calls route.dispatch); the user handlers inside the
  // route are traced individually. Also skip when there are no subscribers,
  // to avoid allocating a context object on every request.
  if (this.route || !shouldTrace(requestChannel)) {
    try {
      // invoke function
      const ret = handlePromise(fn(req, res, next))

      // wait for returned promise
      if (ret) {
        ret.then(null, function (error) {
          next(error || new Error('Rejected promise'))
        })
      }
    } catch (err) {
      next(err)
    }
    return
  }

  invokeWithTrace(function (wrappedNext) {
    return fn(req, res, wrappedNext)
  }, {
    req,
    res,
    layer: this
  }, next)
}

/**
 * Record an error as reported for this request. Returns false when the same
 * error was already reported, so it isn't published again as it bubbles up.
 * @private
 */

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

// 'route' and 'router' signal to exit the route / router (see route.js), not
// real errors.
function isRoutingSignal (err) {
  return err === 'route' || err === 'router'
}

/**
 * Invoke a handler wrapped in the request TracingChannel. Only called when the
 * channel has subscribers, so ctx is always present.
 * @private
 */

function invokeWithTrace (exec, ctx, next) {
  const wrappedNext = function (err) {
    // Routing signals aren't errors; only report a real error once, at its
    // origin, not again as it bubbles up through outer layers.
    if (err && !isRoutingSignal(err) && recordError(ctx.req, err)) {
      ctx.error = err
      requestChannel.error.publish(ctx)
    }
    next(err)
  }

  // runStores fires `start` and sets the async context; the rest are published
  // manually, so a synchronous layer emits only start/end. All outcomes flow
  // through wrappedNext to keep signal filtering and dedup in one place.
  requestChannel.start.runStores(ctx, function () {
    let out
    try {
      out = handlePromise(exec(wrappedNext))
    } catch (err) {
      // A sync throw is forwarded verbatim, so a falsy value keeps routing
      // exactly as the untraced path does.
      wrappedNext(err)
      requestChannel.end.publish(ctx)
      return
    }

    if (!out) {
      requestChannel.end.publish(ctx)
      return
    }

    requestChannel.end.publish(ctx)
    out.then(
      function () {
        requestChannel.asyncStart.publish(ctx)
        requestChannel.asyncEnd.publish(ctx)
      },
      function (err) {
        // A rejected promise is an error even when the reason is falsy;
        // normalize it to the error the router forwards to next().
        wrappedNext(err || new Error('Rejected promise'))
        requestChannel.asyncStart.publish(ctx)
        requestChannel.asyncEnd.publish(ctx)
      }
    )
  })
}

/**
 * If the return value is a promise, validate it and return it.
 * @private
 */

function handlePromise (ret) {
  if (isPromise(ret)) {
    if (!(ret instanceof Promise)) {
      deprecate('handlers that are Promise-like are deprecated, use a native Promise instead')
    }
    return ret
  }
}

/**
 * Check if this route matches `path`, if so
 * populate `.params`.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

Layer.prototype.match = function match (path) {
  let match

  if (path != null) {
    // fast path non-ending match for / (any path matches)
    if (this.slash) {
      this.params = {}
      this.path = ''
      return true
    }

    let i = 0
    while (!match && i < this.matchers.length) {
      // match the path
      match = this.matchers[i](path)
      i++
    }
  }

  if (!match) {
    this.params = undefined
    this.path = undefined
    return false
  }

  // store values
  this.params = match.params
  this.path = match.path
  this.keys = Object.keys(match.params)

  return true
}

/**
 * Decode param value.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function decodeParam (val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val
  }

  try {
    return decodeURIComponent(val)
  } catch (err) {
    if (err instanceof URIError) {
      err.message = 'Failed to decode param \'' + val + '\''
      err.status = 400
    }

    throw err
  }
}

/**
 * Loosens the given path for path-to-regexp matching.
 */
function loosen (path) {
  if (path instanceof RegExp || path === '/') {
    return path
  }

  return Array.isArray(path)
    ? path.map(function (p) { return loosen(p) })
    : String(path).replace(TRAILING_SLASH_REGEXP, '')
}
