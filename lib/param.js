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
// the resolved value, or (undefined, true) if the promise rejected.
function callParam (fn, req, res, next, value, name, onSettle) {
  try {
    const ret = fn(req, res, next, value, name)
    if (isPromise(ret)) {
      if (!(ret instanceof Promise)) {
        deprecate('parameters that are Promise-like are deprecated, use a native Promise instead')
      }

      ret.then(onSettle || null, function (err) {
        next(err || new Error('Rejected promise'))
        if (onSettle) onSettle(undefined, true)
      })
    }
  } catch (err) {
    next(err)
  }
}
