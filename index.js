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

var engine = require('./engine')
var pathToRegexp = require('./lib/path-to-regexp')
var Route = require('./lib/route')

/**
 * Expose `Router`.
 */

module.exports = engine(pathToRegexp)

/**
 * Expose `engine`.
 */

module.exports.engine = engine

/**
 * Expose `Route`.
 */

module.exports.Route = Route
