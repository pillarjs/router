
// var after = require('after')
// var Buffer = require('safe-buffer').Buffer
// var methods = require('methods')
// var Router = require('..')
// var utils = require('./support/utils')

// var assert = utils.assert
// var createHitHandle = utils.createHitHandle
// var createServer = utils.createServer
// var rawrequest = utils.rawrequest
// var request = utils.request
// var shouldHaveBody = utils.shouldHaveBody
// var shouldHitHandle = utils.shouldHitHandle
// var shouldNotHaveBody = utils.shouldNotHaveBody
// var shouldNotHitHandle = utils.shouldNotHitHandle

// describe('Router', function () {
//   describe('final handler', function () {
//     it('return 200 when right method, and 405 when wrong method called', function (done) {
//       var cb = after(3, done)

//       var router = new Router({automatic405:true})
//       var server = createServer(router)


//       var handle405 = (req, res) => {
//         res.statusCode = 405
//         res.setHeader('Content-Type', 'text/plain')
//         res.end()
//       }

//       var handle200 = (req, res) => {
//         res.statusCode = 200
//         res.setHeader('Content-Type', 'text/plain')
//         res.end()
//       }

//       router
//         .post('/foo/bar', handle200)
//         // .all('/foo/bar', handle405)

//       request(server)
//         .post('/foo/bar')
//         .expect(200, cb)

//       request(server)
//         .get('/foo/bar')
//         .expect(405, cb)
      
//       console.log( request(server)
//       .get('/foo/bar'))

//       request(server)
//         .get('/doesntexist')
//         .expect(404, cb)

//     })

//   })
// })

// function helloWorld(req, res) {
//   res.statusCode = 200
//   res.setHeader('Content-Type', 'text/plain')
//   res.end('hello, world')
// }

// function setsaw(num) {
//   var name = 'x-saw-' + String(num)
//   return function saw(req, res, next) {
//     res.setHeader(name, req.method + ' ' + req.url)
//     next()
//   }
// }

// function setsawBase(num) {
//   var name = 'x-saw-base-' + String(num)
//   return function sawBase(req, res, next) {
//     res.setHeader(name, String(req.baseUrl))
//     next()
//   }
// }

// function saw(req, res) {
//   var msg = 'saw ' + req.method + ' ' + req.url
//   res.statusCode = 200
//   res.setHeader('Content-Type', 'text/plain')
//   res.end(msg)
// }

// function sawError(err, req, res, next) {
//   var msg = 'saw ' + err.name + ': ' + err.message
//   res.statusCode = 200
//   res.setHeader('Content-Type', 'text/plain')
//   res.end(msg)
// }

// function sawBase(req, res) {
//   var msg = 'saw ' + req.baseUrl
//   res.statusCode = 200
//   res.setHeader('Content-Type', 'text/plain')
//   res.end(msg)
// }
