
var Router = require('../')
  , assert = require('assert');

var dc = require('diagnostics_channel');
var onHandleRequest = dc.channel('router.layer.handle_request');
var onHandleError = dc.channel('router.layer.handle_error');

function mapProp(prop) {
  return function mapped(obj) {
    return obj[prop];
  };
}

function mapAndJoin(prop) {
  return function (list) {
    return list.map(mapProp(prop)).join('');
  }
}

function noop() { }

describe('diagnostics_channel', function () {
  var joinLayerStack = mapAndJoin('routingPath');
  var handleRequest;
  var handleError;

  onHandleRequest.subscribe(function (message) {
    handleRequest = message;
  });

  onHandleError.subscribe(function (message) {
    handleError = message;
  });

  it('use has no layers with a path', function (done) {
    var router = new Router();

    router.use(function (req, res) {
      res.end();
    });

    function end() {
      assert.strictEqual(joinLayerStack(handleRequest.request.layerStack), '/');
      done();
    }

    router.handle({ url: '/', method: 'GET' }, { end }, noop);
  });

  it('regular routes have a layer with a path', function (done) {
    var router = new Router();

    router.get('/hello/:name', function (req, res) {
      res.end();
    });

    function end() {
      assert.strictEqual(joinLayerStack(handleRequest.request.layerStack), '/hello/:name/');
      done();
    }

    router.handle({ url: '/hello/world', method: 'GET' }, { end }, noop);
  });

  it('nested routes have multiple layers with paths', function (done) {
    var outer = new Router();
    var inner = new Router();

    inner.get('/:name', function (req, res) {
      res.end();
    });

    outer.use('/hello', (req, res, next) => {
      next();
    }, inner);

    function end() {
      assert.strictEqual(joinLayerStack(handleRequest.request.layerStack), '/hello/:name/');
      done();
    }

    outer.handle({ url: '/hello/world', method: 'GET' }, { end }, noop);
  });

  it('errors send through a different channel', function (done) {
    var router = new Router();
    var error = new Error('fail');

    router.get('/hello/:name', function (req, res) {
      throw error;
    });

    router.use(function (err, req, res, next) {
      res.end();
    });

    function end() {
      assert.strictEqual(joinLayerStack(handleRequest.request.layerStack), '/hello/:name/');
      assert.strictEqual(handleError.error, error);
      done();
    }

    router.handle({ url: '/hello/world', method: 'GET' }, { end }, noop);
  });
});
