/*!
 * router
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var debug = require('debug')('router')
var Layer = require('./lib/layer')
var methods = require('methods')
var mixin = require('utils-merge')
var parseUrl = require('parseurl')
var Route = require('./lib/route')
var utils = require('./lib/utils')

/**
 * Module variables.
 * @private
 */

var slice = Array.prototype.slice

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Expose `Router`.
 */

module.exports = Router

/**
 * Expose `Route`.
 */

module.exports.Route = Route

/**
 * Initialize a new `Router` with the given `options`.
 *
 * @param {object} options
 * @return {Router} which is an callable function
 * @public
 */

function Router(options) {
  if (!(this instanceof Router)) {
    return new Router(options)
  }

  var opts = options || {}

  function router(req, res, next) {
    router.handle(req, res, next)
  }

  // inherit from the correct prototype
  router.__proto__ = this

  router.caseSensitive = opts.caseSensitive
  router.mergeParams = opts.mergeParams
  router.params = {}
  router.strict = opts.strict
  router.stack = []

  return router
}

/**
 * Router prototype inherits from a Function.
 */

/* istanbul ignore next */
Router.prototype = function () {}

/**
 * Map the given param placeholder `name`(s) to the given callback.
 *
 * Parameter mapping is used to provide pre-conditions to routes
 * which use normalized placeholders. For example a _:user_id_ parameter
 * could automatically load a user's information from the database without
 * any additional code.
 *
 * The callback uses the same signature as middleware, the only difference
 * being that the value of the placeholder is passed, in this case the _id_
 * of the user. Once the `next()` function is invoked, just like middleware
 * it will continue on to execute the route, or subsequent parameter functions.
 *
 * Just like in middleware, you must either respond to the request or call next
 * to avoid stalling the request.
 *
 *  router.param('user_id', function(req, res, next, id){
 *    User.find(id, function(err, user){
 *      if (err) {
 *        return next(err)
 *      } else if (!user) {
 *        return next(new Error('failed to load user'))
 *      }
 *      req.user = user
 *      next()
 *    })
 *  })
 *
 * @param {string} name
 * @param {function} fn
 * @public
 */

Router.prototype.param = function param(name, fn) {
  if (!name) {
    throw new TypeError('argument name is required')
  }

  if (typeof name !== 'string') {
    throw new TypeError('argument name must be a string')
  }

  if (!fn) {
    throw new TypeError('argument fn is required')
  }

  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  if (name[0] === ':') {
    name = name.substr(1)
  }

  var params = this.params[name]

  if (!params) {
    params = this.params[name] = []
  }

  params.push(fn)

  return this
}

/**
 * Dispatch a req, res into the router.
 *
 * @private
 */

Router.prototype.handle = function handle(req, res, callback) {
  if (!callback) {
    throw new TypeError('argument callback is required')
  }

  debug('dispatching %s %s', req.method, req.url)

  var search = 1 + req.url.indexOf('?')
  var pathlength = search ? search - 1 : req.url.length
  var fqdn = req.url[0] !== '/' && 1 + req.url.substr(0, pathlength).indexOf('://')
  var protohost = fqdn ? req.url.substr(0, req.url.indexOf('/', 2 + fqdn)) : ''
  var idx = 0
  var removed = ''
  var self = this
  var slashAdded = false
  var paramcalled = {}

  // store options for OPTIONS request
  // only used if OPTIONS request
  var options = []

  // middleware and routes
  var stack = this.stack

  // manage inter-router variables
  var parentParams = req.params
  var parentUrl = req.baseUrl || ''
  var done = restore(callback, req, 'baseUrl', 'next', 'params')

  // setup next layer
  req.next = next

  // for options requests, respond with a default if nothing else responds
  if (req.method === 'OPTIONS') {
    done = wrap(done, function onDone(old, err) {
      if (err || options.length === 0) {
        return old(err)
      }

      var methods = options.sort().join(', ')

      res.setHeader('Allow', methods)
      res.setHeader('Content-Length', Buffer.byteLength(methods))
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(methods)
    })
  }

  // setup basic req values
  req.baseUrl = parentUrl
  req.originalUrl = req.originalUrl || req.url

  next()

  function next(err) {
    var layerError = err === 'route'
      ? null
      : err

    var layer = stack[idx++]

    if (slashAdded) {
      req.url = req.url.substr(1)
      slashAdded = false
    }

    if (removed.length !== 0) {
      req.baseUrl = parentUrl
      req.url = protohost + removed + req.url.substr(protohost.length)
      removed = ''
    }

    if (!layer) {
      defer(done, layerError)
      return
    }

    self.match_layer(layer, req, res, function (err, path) {
      if (err || path === undefined) {
        next(layerError || err)
        return
      }

      // route object and not middleware
      var route = layer.route

      // if final route, then we support options
      if (route) {
        // we don't run any routes with error first
        if (layerError) {
          next(layerError)
          return
        }

        var method = req.method
        var has_method = route._handles_method(method)

        // build up automatic options response
        if (!has_method && method === 'OPTIONS') {
          options.push.apply(options, route._options())
        }

        // don't even bother
        if (!has_method && method !== 'HEAD') {
          next()
          return
        }

        // we can now dispatch to the route
        req.route = route
      }

      // Capture one-time layer values
      req.params = self.mergeParams
        ? mergeParams(layer.params, parentParams)
        : layer.params
      var layerPath = layer.path

      // this should be done for the layer
      self.process_params(layer, paramcalled, req, res, function (err) {
        if (err) {
          next(layerError || err)
          return
        }

        if (route) {
          return layer.handle_request(req, res, next)
        }

        trim_prefix(layer, layerError, layerPath, path)
      })
    })
  }

  function trim_prefix(layer, layerError, layerPath, path) {
    var c = path[layerPath.length]

    if (c && '/' !== c && '.' !== c) {
      next(layerError)
      return
    }

     // Trim off the part of the url that matches the route
     // middleware (.use stuff) needs to have the path stripped
    if (layerPath.length !== 0) {
      debug('trim prefix (%s) from url %s', layerPath, req.url)
      removed = layerPath
      req.url = protohost + req.url.substr(protohost.length + removed.length)

      // Ensure leading slash
      if (!fqdn && req.url[0] !== '/') {
        req.url = '/' + req.url
        slashAdded = true
      }

      // Setup base URL (no trailing slash)
      req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
        ? removed.substring(0, removed.length - 1)
        : removed)
    }

    debug('%s %s : %s', layer.name, layerPath, req.originalUrl)

    if (layerError) {
      layer.handle_error(layerError, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }
}

/**
 * Match request to a layer.
 *
 * @private
 */

Router.prototype.match_layer = function match_layer(layer, req, res, done) {
  var error = null
  var path

  try {
    path = parseUrl(req).pathname

    if (!layer.match(path)) {
      path = undefined
    }
  } catch (err) {
    error = err
  }

  done(error, path)
}

/**
 * Process any parameters for the layer.
 *
 * @private
 */

Router.prototype.process_params = function process_params(layer, called, req, res, done) {
  var params = this.params

  // captured parameters from the layer, keys and values
  var keys = layer.keys

  // fast track
  if (!keys || keys.length === 0) {
    return done()
  }

  var i = 0
  var name
  var paramIndex = 0
  var key
  var paramVal
  var paramCallbacks
  var paramCalled

  // process params in order
  // param callbacks can be async
  function param(err) {
    if (err) {
      return done(err)
    }

    if (i >= keys.length ) {
      return done()
    }

    paramIndex = 0
    key = keys[i++]

    if (!key) {
      return done()
    }

    name = key.name
    paramVal = req.params[name]
    paramCallbacks = params[name]
    paramCalled = called[name]

    if (paramVal === undefined || !paramCallbacks) {
      return param()
    }

    // param previously called with same value or error occurred
    if (paramCalled && (paramCalled.error || paramCalled.match === paramVal)) {
      // restore value
      req.params[name] = paramCalled.value

      // next param
      return param(paramCalled.error)
    }

    called[name] = paramCalled = {
      error: null,
      match: paramVal,
      value: paramVal
    }

    paramCallback()
  }

  // single param callbacks
  function paramCallback(err) {
    var fn = paramCallbacks[paramIndex++]

    // store updated value
    paramCalled.value = req.params[key.name]

    if (err) {
      // store error
      paramCalled.error = err
      param(err)
      return
    }

    if (!fn) return param()

    try {
      fn(req, res, paramCallback, paramVal, key.name)
    } catch (e) {
      paramCallback(e)
    }
  }

  param()
}

/**
 * Use the given middleware function, with optional path, defaulting to "/".
 *
 * Use (like `.all`) will run for any http METHOD, but it will not add
 * handlers for those methods so OPTIONS requests will not consider `.use`
 * functions even if they could respond.
 *
 * The other difference is that _route_ path is stripped and not visible
 * to the handler function. The main effect of this feature is that mounted
 * handlers can operate without any code changes regardless of the "prefix"
 * pathname.
 *
 * @public
 */

Router.prototype.use = function use(handler) {
  var offset = 0
  var path = '/'

  // default path to '/'
  // disambiguate router.use([handler])
  if (typeof handler !== 'function') {
    var arg = handler

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0]
    }

    // first arg is the path
    if (typeof arg !== 'function') {
      offset = 1
      path = handler
    }
  }

  var callbacks = utils.flatten(slice.call(arguments, offset))

  if (callbacks.length === 0) {
    throw new TypeError('argument handler is required')
  }

  callbacks.forEach(function (fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('argument handler must be a function')
    }

    // add the middleware
    debug('use %s %s', path, fn.name || '<anonymous>')

    var layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: false,
      end: false
    }, fn)

    layer.route = undefined

    this.stack.push(layer)
  }, this)

  return this
}

/**
 * Create a new Route for the given path.
 *
 * Each route contains a separate middleware stack and VERB handlers.
 *
 * See the Route api documentation for details on adding handlers
 * and middleware to routes.
 *
 * @param {string} path
 * @return {Route}
 * @public
 */

Router.prototype.route = function route(path) {
  var route = new Route(path)

  var layer = new Layer(path, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true
  }, handle)

  function handle(req, res, next) {
    route.dispatch(req, res, next)
  }

  layer.route = route

  this.stack.push(layer)
  return route
}

// create Router#VERB functions
methods.concat('all').forEach(function(method){
  Router.prototype[method] = function (path) {
    var route = this.route(path)
    route[method].apply(route, slice.call(arguments, 1))
    return this
  }
})

/**
 * Merge params with parent params
 *
 * @private
 */

function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params
  }

  // make copy of parent for base
  var obj = mixin({}, parent)

  // simple non-numeric merging
  if (!(0 in params) || !(0 in parent)) {
    return mixin(obj, params)
  }

  var i = 0
  var o = 0

  // determine numeric gaps
  while (i === o || o in parent) {
    if (i in params) i++
    if (o in parent) o++
  }

  // offset numeric indices in params before merge
  for (i--; i >= 0; i--) {
    params[i + o] = params[i]

    // create holes for the merge when necessary
    if (i < o) {
      delete params[i]
    }
  }

  return mixin(parent, params)
}

/**
 * Restore obj props after function
 *
 * @private
 */

function restore(fn, obj) {
  var props = new Array(arguments.length - 2)
  var vals = new Array(arguments.length - 2)

  for (var i = 0; i < props.length; i++) {
    props[i] = arguments[i + 2]
    vals[i] = obj[props[i]]
  }

  return function(err){
    // restore vals
    for (var i = 0; i < props.length; i++) {
      obj[props[i]] = vals[i]
    }

    return fn.apply(this, arguments)
  }
}

/**
 * Wrap a function
 *
 * @private
 */

function wrap(old, fn) {
  return function proxy() {
    var args = new Array(arguments.length + 1)

    args[0] = old
    for (var i = 0, len = arguments.length; i < len; i++) {
      args[i + 1] = arguments[i]
    }

    fn.apply(this, args)
  }
}
