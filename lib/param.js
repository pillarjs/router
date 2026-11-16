/*!
 * router
 * MIT Licensed
 */

'use strict'

const isPromise = require('is-promise')
const deprecate = require('depd')('router')

module.exports = callParam

// Share invocation and promise handling between traced and untraced callbacks.
// A resolved promise may notify tracing, but does not call next(). onSettle gets
// the resolved value, or (reason, true) if the promise rejected.
function callParam (fn, req, res, next, value, name, onSettle) {
  try {
    const ret = fn(req, res, next, value, name)
    if (isPromise(ret)) {
      if (!(ret instanceof Promise)) {
        deprecate('parameters that are Promise-like are deprecated, use a native Promise instead')
      }

      try {
        ret.then(onSettle || noop, function (err) {
          rejected(err || new Error('Rejected promise'))
        })
      } catch (err) {
        // A `then` that throws is a rejection, forwarded verbatim as before
        rejected(err)
      }
    }
  } catch (err) {
    next(err)
  }

  function rejected (err) {
    next(err)
    if (onSettle) onSettle(err, true)
  }
}

/**
 * Passed to then() instead of null, since some thenables call their callbacks
 * without checking, and the traced path always passes a function.
 */
function noop () {}
