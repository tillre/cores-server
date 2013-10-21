/*global before after beforeEach afterEach describe it*/
var assert = require('assert');
var Util = require('util');
var Q = require('kew');
var Nano = require('nano');

var ApiMiddleware = require('../lib/api-middleware.js');
var cs = require('../index.js');


describe('cores-server', function() {

  describe('ApiMiddleware', function() {

    it('should pass on payload', function(done) {
      var md = new ApiMiddleware();
      md.handleAction('load', {}, { name: 'Foo' }, { data: 123 }).then(function(payload) {
        assert(payload.data === 123);
        done();
      }, done);
    });


    it('should call handler', function(done) {
      var md = new ApiMiddleware();

      md.setHandler('load', 'Foo', function(payload) {
        return { called: true };
      });

      md.handleAction('load', {}, { name: 'Foo' }, {}).then(function(payload) {
        assert(payload.called);
        done();
      }, done);
    });

    it('should call pre handler', function(done) {
      var md = new ApiMiddleware();

      md.setPreHandler('load', function(payload) {
        return { called: true };
      });
      md.handleAction('load', {}, { name: 'Foo' }, {}).then(function(payload) {
        assert(payload.called);
        done();
      }, done);
    });

    it('should call post handler', function(done) {
      var md = new ApiMiddleware();

      md.setPostHandler('load', function(payload) {
        return { called: true };
      });
      md.handleAction('load', {}, { name: 'Foo' }, {}).then(function(payload) {
        assert(payload.called);
        done();
      }, done);
    });

    it('should call handlers in order', function(done) {
      var md = new ApiMiddleware();

      md.setPreHandler('load', function(payload) {
        assert(payload.count === 0);
        return { count: payload.count + 1 };
      });
      md.setHandler('load', 'Foo', function(payload) {
        assert(payload.count === 1);
        return { count: payload.count + 1 };
      });
      md.setPostHandler('load', function(payload) {
        assert(payload.count === 2);
        return { count: payload.count + 1 };
      });

      md.handleAction('load', {}, { name: 'Foo' }, { count: 0 }).then(function(payload) {
        assert(payload.count === 3);
        done();
      }, done);
    });


    it('should propagate error', function(done) {
      var md = new ApiMiddleware();

      md.setHandler('load', 'Foo', function(payload) {
        throw new Error('foo');
      });

      md.handleAction('load', {}, { name: 'Foo' }, {}).then(function(payload) {
        assert(false);
      }, function(err) {
        assert(Util.isError(err));
        done();
      });
    });


    it('should include request in context of promise', function(done) {
      var md = new ApiMiddleware();

      md.setHandler('load', 'Foo', function(payload) {
        var c = this.getContext();
        assert(c);
        assert(c.request);
        assert(c.request.iAmARequest);
        assert(c.action === 'load');
        assert(c.resource);
        assert(c.resource.name === 'Foo');
        return payload;
      });

      md.handleAction('load', {iAmARequest: true}, { name: 'Foo' }, { data: 123 }).then(function(payload) {
        assert(this.getContext());
        assert(this.getContext().request);
        assert(this.getContext().request.iAmARequest);
        done();
      }, done);
    });

  });


  describe('createServer', function() {

    // create db before tests and destroy afterwards
    var nano = Nano('http://127.0.0.1:5984');
    var dbName = 'test-cores-server';
    var db = nano.use(dbName);

    before(function(done) {
      // setup test db
      nano.db.get(dbName, function(err, body) {
        if (!err) {
          // db exists, recreate
          nano.db.destroy(dbName, function(err) {
            if (err) done(err);
            nano.db.create(dbName, done);
          });
        }
        else if (err.reason === 'no_db_file'){
          // create the db
          nano.db.create(dbName, done);
        }
        else done(err);
      });
    });

    after(function(done) {
      nano.db.destroy(dbName, done);
    });


    it('should create the server', function(done) {
      cs.createServer().then(function(server) {
        assert(server);
        done();
      }, done);
    });


    var server;
    var document;

    it('should create the server and load models', function(done) {
      cs.createServer(
        { resourcesDir: __dirname + '/resources', db: { name: dbName }}

      ).then(function(server) {
        return cs.createApi(server, { path: '/api' });

      }).then(function(s) {
        assert(s);
        assert(s.app.resources.Foo);
        server = s;
        done();
      }, done);
    });


    it('should not create the server when resources not exists', function(done) {
      cs.createServer(
        { resourcesDir: __dirname + '/foooo', db: { name: dbName }}
      ).then(function(s) {
        assert(false);
      }, function(err) {
        assert(Util.isError(err));
        done();
      });
    });


    it('should should start', function(done) {
      server.start(done);
    });


    it('should have the api loaded', function(done) {
      server.inject({ url: 'http://127.0.0.1:8080/api/_index' }, function(response) {
        assert(response.statusCode === 200);
        assert(response.result.Foo);
        done();
      });
    });


    it('should call create handler', function(done) {

      server.app.api.setHandler('create', 'Foo', function(payload) {
        payload.create = true;
        return Q.resolve(payload);
      });

      server.inject({
        method: 'POST',
        url: 'http://127.0.0.1:8080/api/foos',
        payload: JSON.stringify({ hello: 'world' })

      }, function(response) {
        assert(response.statusCode === 200);
        document = response.result;
        assert(document.create);
        done();
      });
    });


    it('should call update handler', function(done) {

      server.app.api.setHandler('update', 'Foo', function(payload) {
        payload.update = true;
        return Q.resolve(payload);
      });

      server.inject({
        method: 'PUT',
        url: 'http://127.0.0.1:8080/api/foos/' + document._id + '/' + document._rev,
        payload: document

      }, function(response) {
        assert(response.statusCode === 200);
        document = response.result;
        assert(document.update);
        done();
      });
    });


    it('should call load handler', function(done) {

      server.app.api.setHandler('load', 'Foo', function(payload) {
        payload.load = true;
        return Q.resolve(payload);
      });

      server.inject({
        url: 'http://127.0.0.1:8080/api/foos/' + document._id

      }, function(response) {
        assert(response.statusCode === 200);
        document = response.result;
        assert(document.load);
        done();
      });
    });


    it('should call views handler', function(done) {

      server.app.api.setHandler('views', 'Foo', function(payload) {
        payload.views = true;
        return Q.resolve(payload);
      });

      server.inject({
        url: 'http://127.0.0.1:8080/api/foos/_views/all'

      }, function(response) {
        assert(response.statusCode === 200);
        assert(response.result.views);
        done();
      });
    });


    it('should stop', function(done) {
      server.stop(done);
    });
  });
});
