var path = require('path');
var jski = require('jski');
var walk = require('walk-fs');
var Q = require('kew');


function camelize(str) {
  return str.replace(/(^\w)|(\-\w)/g, function(m) {
    return m.slice(-1).toUpperCase();
  });
};


function extend(a, b) {
  for (var x in b) a[x] = b[x];
  return a;
};


module.exports = function loadResources(cores, dir) {

  var defer = Q.defer();
  if (!dir) {
    defer.resolve({});
    return defer.promise;
  }

  dir = path.resolve(dir);

  var configs = {};
  var resources = {};
  var re = /([\w\-]+)-(schema|design)\.js$/i;

  walk(dir, { recursive: true }, function(path, stats) {

    if (stats.isFile()) {
      var m = path.match(re);
      if (m) {
        var name = m[1].toLowerCase();
        var type = m[2].toLowerCase();
        var cname = camelize(name);

        if (!configs[name]) {
          configs[name] = { name: cname };
        }
        var obj = require(path);
        // convert pure json schemas to jski schemas
        if (type === 'schema' && !obj.__jski__) {
          obj = jski.schema(obj);
        }
        configs[name][type] = obj;
      }
    }
  }, function(err) {

    if (err) return defer.reject(err);

    var keys = Object.keys(configs);
    var numRes = keys.length;

    // create the resources
    keys.forEach(function(name) {

      var config = configs[name];
      config.validateRefs = false;

      cores.create(config, function(err, res) {

        if (err) return defer.reject(err);
        resources[config.name] = res;
        if (--numRes === 0) {
          defer.resolve(resources);
        }
      });
    });
  });

  return defer.promise;
};
