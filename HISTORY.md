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
