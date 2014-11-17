/*!
 * router
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Flatten the given `arr`.
 *
 * @param {array} arr
 * @return {array}
 * @private
 */

exports.flatten = function flatten(arr, ret) {
  ret = ret || []

  for (var i = 0, len = arr.length; i < len; i++) {
    if (Array.isArray(arr[i])) {
      exports.flatten(arr[i], ret)
    } else {
      ret.push(arr[i])
    }
  }

  return ret
}
