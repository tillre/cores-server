var Hapi = require('hapi');
var Nano = require('nano');
var Cores = require('cores');
var Q = require('kew');

var ApiMiddleware = require('./lib/api-middleware.js');
var loadResources = require('./lib/load-resources.js');


function createServer(options) {

  var defaults = {
    server: {
      host: '127.0.0.1',
      port: 8080
    },
    db: {
      url: 'http://127.0.0.1:5984',
      name: 'cores'
    },
    api: {
      basePath: '/api'
    },
    auth: false
  };
  options = Hapi.utils.applyToDefaults(defaults, options || {});

  // create the server
  var server = new Hapi.Server(
    options.server.host,
    options.server.port,
    options.server.options
  );
  server.app.api = new ApiMiddleware();

  // create the db and resource layer
  var db = Nano(options.db.url).use(options.db.name);
  var cores = Cores(db);

  return loadResources(cores, options.resourceDir).then(function(resources) {

    server.app.resources = resources;

    return Q.bindPromise(server.pack.require, server.pack)('cores-hapi', {
      cores: cores,
      resources: resources,
      handlers: server.app.api.baseHandlers,
      basePath: options.api.basePath,
      auth: options.auth
    });

  }).then(function() {

    return server;
  });
}


module.exports = createServer;