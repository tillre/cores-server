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
    resourcesDir: '',
    debug: false
  };
  options = Hapi.utils.applyToDefaults(defaults, options || {});

  // create the server
  var server = new Hapi.Server(
    options.server.host,
    options.server.port,
    options.server.options
  );

  // create the db and resource layer
  var db = Nano(options.db.url).use(options.db.name);
  var cores = Cores(db);
  server.app.cores = cores;

  if (!options.resourcesDir) {
    Q.resolve(server);
  }

  return loadResources(cores, options.resourcesDir).then(function(resources) {
    server.app.resources = resources;
    return server;
  });
}


function createApi(server, options) {

  var defaults = {
    path: '',
    auth: false
  };
  options = Hapi.utils.applyToDefaults(defaults, options || {});

  var api = server.app.api = new ApiMiddleware();

  return Q.bindPromise(server.pack.require, server.pack)('cores-hapi', {
    cores: server.app.cores,
    resources: server.app.resources,
    handlers: api.baseHandlers,
    basePath: options.path,
    auth: options.auth

  }).then(function() {
    return server;
  });
}


// module.exports = createServer;
module.exports = {
  createServer: createServer,
  createApi: createApi
};