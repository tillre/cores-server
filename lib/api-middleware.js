var Q = require('kew');


function ApiMiddleware() {

  this.handlers = {};
  // handlers called by cores-hapi
  this.baseHandlers = {
    load: this.handleAction.bind(this, 'load'),
    create: this.handleAction.bind(this, 'create'),
    update: this.handleAction.bind(this, 'update'),
    destroy: this.handleAction.bind(this, 'destroy'),
    views: this.handleAction.bind(this, 'views')
  };
}


ApiMiddleware.prototype.addHandler = function(action, resourceName, handler) {

  this.handlers[resourceName] = this.handlers[resourceName] || {};
  this.handlers[resourceName][action] = this.handlers[resourceName][action] || [];
  this.handlers[resourceName][action].push(handler);
};


ApiMiddleware.prototype.handleAction = function(action, request, resource, payload) {

  var handlers = [];
  if (this.handlers[resource.name] && this.handlers[resource.name][action]) {
    handlers = this.handlers[resource.name][action];
  }

  var promise = Q.resolve(payload);
  handlers.forEach(function(handler) {
    promise = promise.then(handler);
  });
  return promise;
};


module.exports = ApiMiddleware;
