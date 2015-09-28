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

const debug = require('debug')('router')
const flatten = require('array-flatten')
const Layer = require('./lib/layer')
const methods = require('methods')
const mixin = require('utils-merge')
const parseUrl = require('parseurl')
const Route = require('./lib/route')
const setPrototypeOf = require('setprototypeof')

/**
 * Module variables.
 * @private
 */

const slice = Array.prototype.slice

/* istanbul ignore next */
const defer = typeof setImmediate === 'function' 
  ? setImmediate
  : function(fn, ...args) { process.nextTick(()=> fn(fn, ...args)) }


/**
 * Router prototype inherits from a Function.
 */

/* istanbul ignore next */
function R() {}
R.prototype = function () {}

/**
 * Router class
 * @public
 */

class Router extends R {

  /**
   * Initialize a new `Router` with the given `options`.
   *
   * @param {object} options
   * @return {Router} which is an callable function
   * @public
   */

  constructor(options) {
    super()
    function router(...args) {
      router.handle(...args)
    }

    let opts = options || {}

    // inherit from the correct prototype
    setPrototypeOf(router, this)

    router.caseSensitive = opts.caseSensitive
    router.mergeParams = opts.mergeParams
    router.params = {}
    router.strict = opts.strict
    router.stack = []

    return router
  }

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

  param(name, fn) {
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

    let params = this.params[name]

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

  handle(req, res, callback) {
    if (!callback) {
      throw new TypeError('argument callback is required')
    }

    debug('dispatching %s %s', req.method, req.url)

    let idx = 0
    let methods
    let protohost = getProtohost(req.url) || ''
    let removed = ''
    let slashAdded = false
    let paramcalled = {}

    // middleware and routes
    let stack = this.stack

    // manage inter-router variables
    let parentParams = req.params
    let parentUrl = req.baseUrl || ''
    let done = restore(callback, req, 'baseUrl', 'next', 'params')

    let trim_prefix = (layer, layerError, layerPath, path) => {
      let c = path[layerPath.length]

      if (c && c !== '/') {
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
        if (!protohost && req.url[0] !== '/') {
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

    let next = (err) => {
      let layerError = err === 'route'
        ? null
        : err

      // remove added slash
      if (slashAdded) {
        req.url = req.url.substr(1)
        slashAdded = false
      }

      // restore altered req.url
      if (removed.length !== 0) {
        req.baseUrl = parentUrl
        req.url = protohost + removed + req.url.substr(protohost.length)
        removed = ''
      }

      // no more matching layers
      if (idx >= stack.length) {
        defer(done, layerError)
        return
      }

      // get pathname of request
      let path = getPathname(req)

      if (path == null) {
        return done(layerError)
      }

      // find next matching layer
      let layer
      let match
      let route

      while (match !== true && idx < stack.length) {
        layer = stack[idx++]
        match = matchLayer(layer, path)
        route = layer.route

        if (typeof match !== 'boolean') {
          // hold on to layerError
          layerError = layerError || match
        }

        if (match !== true) {
          continue
        }

        if (!route) {
          // process non-route handlers normally
          continue
        }

        if (layerError) {
          // routes do not match with a pending error
          match = false
          continue
        }

        let method = req.method;
        let has_method = route._handles_method(method)

        // build up automatic options response
        if (!has_method && method === 'OPTIONS' && methods) {
          methods.push.apply(methods, route._methods())
        }

        // don't even bother matching route
        if (!has_method && method !== 'HEAD') {
          match = false
          continue
        }
      }

      // no match
      if (match !== true) {
        return done(layerError)
      }

      // store route for dispatch on change
      if (route) {
        req.route = route
      }

      // Capture one-time layer values
      req.params = this.mergeParams
        ? mergeParams(layer.params, parentParams)
        : layer.params
      let layerPath = layer.path

      // this should be done for the layer
      this.process_params(layer, paramcalled, req, res, (err) => {
        if (err) {
          return next(layerError || err)
        }

        if (route) {
          return layer.handle_request(req, res, next)
        }

        trim_prefix(layer, layerError, layerPath, path)
      })
    }

    // setup next layer
    req.next = next

    // for options requests, respond with a default if nothing else responds
    if (req.method === 'OPTIONS') {
      methods = []
      done = wrap(done, generateOptionsResponder(res, methods))
    }

    // setup basic req values
    req.baseUrl = parentUrl
    req.originalUrl = req.originalUrl || req.url

    next()
  }

  /**
   * Process any parameters for the layer.
   *
   * @private
   */

  process_params(layer, called, req, res, done) {
    let params = this.params

    // captured parameters from the layer, keys and values
    let keys = layer.keys

    // fast track
    if (!keys || keys.length === 0) {
      return done()
    }

    let i = 0
    let name
    let paramIndex = 0
    let key
    let paramVal
    let paramCallbacks
    let paramCalled

    // process params in order
    // param callbacks can be async
    let param = (err) => {
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
      if (paramCalled && (paramCalled.match === paramVal
        || (paramCalled.error && paramCalled.error !== 'route'))) {
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
    let paramCallback = (err) => {
      let fn = paramCallbacks[paramIndex++]

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

  use(...args) {
    let offset = 0
    let path = '/'
    let handler = args[0]

    // default path to '/'
    // disambiguate router.use([handler])
    if (typeof handler !== 'function') {
      let arg = handler

      while (Array.isArray(arg) && arg.length !== 0) {
        arg = arg[0]
      }

      // first arg is the path
      if (typeof arg !== 'function') {
        offset = 1
        path = handler
      }
    }

    let callbacks = flatten(slice.call(args, offset))

    if (callbacks.length === 0) {
      throw new TypeError('argument handler is required')
    }

    for (let i = 0; i < callbacks.length; i++) {
      let fn = callbacks[i]

      if (typeof fn !== 'function') {
        throw new TypeError('argument handler must be a function')
      }

      // add the middleware
      debug('use %s %s', path, fn.name || '<anonymous>')

      let layer = new Layer(path, {
        sensitive: this.caseSensitive,
        strict: false,
        end: false
      }, fn)

      layer.route = undefined

      this.stack.push(layer)
    }

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

  route(path) {
    let route = new Route(path)
    let handle = (req, res, next) => {
      route.dispatch(req, res, next)
    }

    let layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: this.strict,
      end: true
    }, handle)

    layer.route = route

    this.stack.push(layer)
    return route
  }
}

// create Router#VERB functions
methods.concat('all').forEach(function(method){
  Router.prototype[method] = function (path, ...args) {
    let route = this.route(path)
    route[method].apply(route, args)
    return this
  }
})

/**
 * Expose `Router`.
 */

module.exports = Router

/**
 * Expose `Route`.
 */

module.exports.Route = Route

/**
 * Generate a callback that will make an OPTIONS response.
 *
 * @param {OutgoingMessage} res
 * @param {array} methods
 * @private
 */

let generateOptionsResponder = (res, methods) => {
  return (fn, err) => {
    if (err || methods.length === 0) {
      return fn(err)
    }

    trySendOptionsResponse(res, methods, fn)
  }
}

/**
 * Get pathname of request.
 *
 * @param {IncomingMessage} req
 * @private
 */

let getPathname = (req) => {
  try {
    return parseUrl(req).pathname;
  } catch (err) {
    return undefined;
  }
}

/**
 * Get get protocol + host for a URL.
 *
 * @param {string} url
 * @private
 */

let getProtohost = (url) => {
  if (url.length === 0 || url[0] === '/') {
    return undefined
  }

  let searchIndex = url.indexOf('?')
  let pathLength = searchIndex !== -1
    ? searchIndex
    : url.length
  let fqdnIndex = url.substr(0, pathLength).indexOf('://')

  return fqdnIndex !== -1
    ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined
}

/**
 * Match path to a layer.
 *
 * @param {Layer} layer
 * @param {string} path
 * @private
 */

let matchLayer = (layer, path) => {
  try {
    return layer.match(path);
  } catch (err) {
    return err;
  }
}

/**
 * Merge params with parent params
 *
 * @private
 */

let mergeParams = (params, parent) => {
  if (typeof parent !== 'object' || !parent) {
    return params
  }

  // make copy of parent for base
  let obj = mixin({}, parent)

  // simple non-numeric merging
  if (!(0 in params) || !(0 in parent)) {
    return mixin(obj, params)
  }

  let i = 0
  let o = 0

  // determine numeric gap in params
  while (i in params) {
    i++
  }

  // determine numeric gap in parent
  while (o in parent) {
    o++
  }

  // offset numeric indices in params before merge
  for (i--; i >= 0; i--) {
    params[i + o] = params[i]

    // create holes for the merge when necessary
    if (i < o) {
      delete params[i]
    }
  }

  return mixin(obj, params)
}

/**
 * Restore obj props after function
 *
 * @private
 */

let restore = (fn, obj, ...args) => {
  let props = new Array(args.length)
  let vals = new Array(args.length)

  for (let i = 0; i < props.length; i++) {
    props[i] = args[i]
    vals[i] = obj[props[i]]
  }

  return (...args) => {
    // restore vals
    for (let i = 0; i < props.length; i++) {
      obj[props[i]] = vals[i]
    }

    return fn(...args)
  }
}

/**
 * Send an OPTIONS response.
 *
 * @private
 */

let sendOptionsResponse = (res, methods) => {

  let options = new Set(methods)

  // construct the allow list
  let allow = [...options].sort().join(', ')

  // send response
  res.setHeader('Allow', allow)
  res.setHeader('Content-Length', Buffer.byteLength(allow))
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(allow)
}

/**
 * Try to send an OPTIONS response.
 *
 * @private
 */

let trySendOptionsResponse = (res, methods, next) => {
  try {
    sendOptionsResponse(res, methods)
  } catch (err) {
    next(err)
  }
}

/**
 * Wrap a function
 *
 * @private
 */

let wrap = (old, fn) => {
  return (...args) => {
    fn(old, ...args)
  }
}
