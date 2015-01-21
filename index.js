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

var Engine = require('./engine')
var pathToRegexp = require('./lib/path-to-regexp')
var slice = Array.prototype.slice

/**
 * Expose `Router`.
 */

module.exports = Router
module.exports.Engine = Engine
module.exports.Route = Engine.Route

/**
 * Construct a router instance.
 */

function Router (options) {
  if (!(this instanceof Router)) {
    return new Router(options)
  }

  var opts = options || {}
  var router = Engine.call(this, opts)

  router.strict = opts.strict
  router.caseSensitive = opts.caseSensitive

  return router
}

/**
 * Inherits from the router engine.
 */

Router.prototype = Object.create(Engine.prototype)

/**
 * Create a `path-to-regexp` compatible `.use`.
 */

Router.prototype.use = function use() {
  var opts = Engine.sanitizeUse.apply(null, arguments)

  var match = pathToRegexp(opts.path, {
    sensitive: this.caseSensitive,
    strict: false,
    end: false
  })

  return Engine.prototype.use.call(this, opts.path, match, opts.callbacks)
}

/**
 * Create a `path-to-regexp` compatible route.
 */

Router.prototype.route = function route(path) {
  var match = pathToRegexp(path, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true
  })

  return Engine.prototype.route.call(this, path, match)
}

// create Router#VERB functions
Engine.methods.forEach(function (method) {
  Router.prototype[method] = function (path) {
    var route = this.route(path)
    route[method].apply(route, slice.call(arguments, 1))
    return this
  }
})
