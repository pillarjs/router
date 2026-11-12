/*!
 * router
 * MIT Licensed
 */

'use strict'

const isPromise = require('is-promise')
const deprecate = require('depd')('router')

module.exports = callParam

// Share invocation and promise handling between traced and untraced callbacks.
// A resolved promise may notify tracing, but does not call next().
function callParam (fn, req, res, next, value, name, onSettle) {
  try {
    const ret = fn(req, res, next, value, name)
    if (isPromise(ret)) {
      if (!(ret instanceof Promise)) {
        deprecate('parameters that are Promise-like are deprecated, use a native Promise instead')
      }

      ret.then(onSettle || null, function (err) {
        next(err || new Error('Rejected promise'))
        if (onSettle) onSettle()
      })
    }
  } catch (err) {
    next(err)
  }
}
