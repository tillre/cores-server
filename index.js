var Hapi = require('hapi');
var Cores = require('cores');
var Q = require('kew');


function createServer(options) {

  var defaults = {
    server: {
      host: '127.0.0.1',
      port: 8080
    },
    db: 'http://127.0.0.1:5984/cores',
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

  // create the resource layer
  var cores = Cores(options.db);
  server.app.cores = cores;

  if (!options.resourcesDir) {
    Q.resolve(server);
  }
  return cores.load(options.resourcesDir).then(function(resources) {
    return server;
  });
}


function createApi(server, options) {
  var defaults = {
    path: '',
    auth: false
  };
  options = Hapi.utils.applyToDefaults(defaults, options || {});

  return Q.bindPromise(server.pack.require, server.pack)('cores-hapi', {
    cores: server.app.cores,
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