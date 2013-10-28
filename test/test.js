/*global before after beforeEach afterEach describe it*/
var assert = require('assert');
var util = require('util');
var Q = require('kew');
var nano = require('nano')('http://127.0.0.1:5984');

var cs = require('../index.js');


describe('cores-server', function() {

  describe('createServer', function() {

    // create db before tests and destroy afterwards

    var dbName = 'test-cores-server';

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
    var dbConfig = 'http://localhost:5984/' + dbName;

    it('should create the server and load resources', function(done) {
      cs.createServer(
        { resourcesDir: __dirname + '/resources', db: dbConfig }

      ).then(function(server) {
        return cs.createApi(server, { path: '/api' });

      }).then(function(s) {
        assert(s);
        assert(s.app.cores.resources.Foo);
        server = s;
        done();
      }, done);
    });


    it('should not create the server when resources not exists', function(done) {
      cs.createServer(
        { resourcesDir: __dirname + '/foooo', db: dbConfig }
      ).then(function(s) {
        assert(false);
      }, function(err) {
        assert(util.isError(err));
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

      server.plugins['cores-hapi'].setHandler('create', 'Foo', function(payload) {
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

      server.plugins['cores-hapi'].setHandler('update', 'Foo', function(payload) {
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

      server.plugins['cores-hapi'].setHandler('load', 'Foo', function(payload) {
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

      server.plugins['cores-hapi'].setHandler('views', 'Foo', function(payload) {
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
