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

var pathRegexp = require('path-to-regexp')
var debug = require('debug')('router:layer')
var flatten = require('array-flatten')

/**
 * Module variables.
 * @private
 */

var hasOwnProperty = Object.prototype.hasOwnProperty

/**
 * Expose `Layer`.
 */

module.exports = Layer

function Layer(p, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(p, options, fn)
  }

  debug('new %o', paths)
  var opts = options || {}

  // If not in strict allow both with or without trailing slash
  var paths = p
  if (!opts.strict) {
    if (!Array.isArray(paths) && paths !== '/' && paths[paths.length - 1] === '/') {
      paths = paths.substr(0, paths.length - 1)
    } else {
      for (var i = 0; i < paths.length; i++) {
        if (paths[i] !== '/' && paths[i][paths[i].length - 1] === '/') {
          paths[i] = paths[i].substr(0, paths[i].length - 1)
        }
      }
    }
  }

  this.handle = fn
  this.name = fn.name || '<anonymous>'
  this.params = undefined
  this.path = undefined
  this.matchedPath = undefined

  // set fast path flags
  this.fastStar = paths === '*'
  this.fastSlash = paths === '/' && opts.end === false

  this.paths = (!Array.isArray(paths) ? [paths] : flatten(paths)).map(function (path) {
    var keys = []
    var pathObj = {
      path: path,
      keys: keys,
      regexp: pathRegexp(path, keys, opts)
    }

    return pathObj
  })
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

Layer.prototype.handle_error = function handle_error(error, req, res, next) {
  var fn = this.handle

  if (fn.length !== 4) {
    // not a standard error handler
    return next(error)
  }

  try {
    // invoke function
    var ret = fn(error, req, res, next)

    // wait for returned promise
    if (isPromise(ret)) {
      ret.then(null, function (error) {
        next(error || new Error('Rejected promise'))
      })
    }
  } catch (err) {
    next(err)
  }
}

/**
 * Handle the request for the layer.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 * @api private
 */

Layer.prototype.handle_request = function handle(req, res, next) {
  var fn = this.handle

  if (fn.length > 3) {
    // not a standard request handler
    return next()
  }

  try {
    // invoke function
    var ret = fn(req, res, next)

    // wait for returned promise
    if (isPromise(ret)) {
      ret.then(null, function (error) {
        next(error || new Error('Rejected promise'))
      })
    }
  } catch (err) {
    next(err)
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

Layer.prototype.match = function match(path) {
  var match
  var checkPath

  if (path != null) {
    // fast path non-ending match for / (any path matches)
    if (this.fastSlash) {
      this.params = {}
      this.path = ''
      this.matchedPath = this.paths[0]
      return true
    }

    // fast path for * (everything matched in a param)
    if (this.fastStar) {
      this.params = {'0': decode_param(path)}
      this.path = path
      this.matchedPath = this.paths[0]
      return true
    }

    // match the path
    for (var i = 0; i < this.paths.length; i++) {
      checkPath = this.paths[i]
      if (match = checkPath.regexp.exec(path)) {
        this.matchedPath = checkPath
        break
      }
    }
  }

  if (!match) {
    this.params = undefined
    this.path = undefined
    this.matchedPath = undefined
    return false
  }

  // store values
  this.params = {}
  this.path = match[0]

  // iterate matches
  var keys = this.keys
  var params = this.params

  for (var i = 1; i < match.length; i++) {
    var key = this.matchedPath.keys[i - 1]
    var prop = key.name
    var val = decode_param(match[i])

    if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
      params[prop] = val
    }
  }

  return true
}

/**
 * Decode param value.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function decode_param(val){
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
 * Returns true if the val is a Promise.
 *
 * @param {*} val
 * @return {boolean}
 * @private
 */

function isPromise (val) {
  return val &&
    typeof val === 'object' &&
    typeof val.then === 'function'
}
