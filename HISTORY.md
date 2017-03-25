1.3.0 / 2017-02-25
==================

  * Add `next("router")` to exit from router
  * Fix case where `router.use` skipped requests routes did not
  * Use `%o` in path debug to tell types apart
  * deps: setprototypeof@1.0.3
  * perf: add fast match path for `*` route

1.2.0 / 2017-02-17
==================

  * Skip routing when `req.url` is not set
  * deps: debug@2.6.1
    - Allow colors in workers
    - Deprecated `DEBUG_FD` environment variable set to `3` or higher
    - Fix error when running under React Native
    - Use same color for same namespace
    - deps: ms@0.7.2

1.1.5 / 2017-01-28
==================

  * deps: array-flatten@2.1.1
  * deps: setprototypeof@1.0.2
    - Fix using fallback even when native method exists

1.1.4 / 2016-01-21
==================

  * deps: array-flatten@2.0.0
  * deps: methods@~1.1.2
    - perf: enable strict mode
  * deps: parseurl@~1.3.1
    - perf: enable strict mode

1.1.3 / 2015-08-02
==================

  * Fix infinite loop condition using `mergeParams: true`
  * Fix inner numeric indices incorrectly altering parent `req.params`
  * deps: array-flatten@1.1.1
    - perf: enable strict mode
  * deps: path-to-regexp@0.1.7
    - Fix regression with escaped round brackets and matching groups

1.1.2 / 2015-07-06
==================

  * Fix hiding platform issues with `decodeURIComponent`
    - Only `URIError`s are a 400
  * Fix using `*` before params in routes
  * Fix using capture groups before params in routes
  * deps: path-to-regexp@0.1.6
  * perf: enable strict mode
  * perf: remove argument reassignments in routing
  * perf: skip attempting to decode zero length string
  * perf: use plain for loops

1.1.1 / 2015-05-25
==================

  * Fix issue where `next('route')` in `router.param` would incorrectly skip values
  * deps: array-flatten@1.1.0
  * deps: debug@~2.2.0
    - deps: ms@0.7.1

1.1.0 / 2015-04-22
==================

  * Use `setprototypeof` instead of `__proto__`
  * deps: debug@~2.1.3
    - Fix high intensity foreground color for bold
    - deps: ms@0.7.0

1.0.0 / 2015-01-13
==================

  * Fix crash from error within `OPTIONS` response handler
  * deps: array-flatten@1.0.2
    - Remove redundant code path

1.0.0-beta.3 / 2015-01-11
=========================

  * Fix duplicate methods appearing in OPTIONS responses
  * Fix OPTIONS responses to include the HEAD method properly
  * Remove support for leading colon in `router.param(name, fn)`
  * Use `array-flatten` for flattening arrays
  * deps: debug@~2.1.1
  * deps: methods@~1.1.1

1.0.0-beta.2 / 2014-11-19
=========================

  * Match routes iteratively to prevent stack overflows

1.0.0-beta.1 / 2014-11-16
=========================

  * Initial release ported from Express 4.x
    - Altered to work without Express
