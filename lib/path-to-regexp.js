/*!
 * router
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var pathToRegexp = require('path-to-regexp')

/**
 * Expose `pathRegexp`.
 */

module.exports = pathRegexp

/**
 * Create a function to match paths using `path-to-regexp`.
 *
 * @param {String} path
 * @param {Object} options
 * @api private
 */

function pathRegexp (path, options) {
  var keys = []
  var regexp = pathToRegexp(path, keys, options)

  return function (pathname) {
    var m = regexp.exec(pathname)

    if (!m) {
      return false
    }

    // store values
    var path = m[0]
    var params = {}
    var prop
    var n = 0
    var key
    var val

    for (var i = 1, len = m.length; i < len; ++i) {
      key = keys[i - 1]
      prop = key
        ? key.name
        : n++
      val = m[i]

      if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
        params[prop] = val
      }
    }

    return { path: path, params: params }
  }

}
