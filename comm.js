
var config = require('./config');
var supervisorUrl = 'http://' + config.supervisor.host + ':' + config.supervisor.port;
var io = require('socket.io-client');
var _ = require('underscore');

module.exports = function(name) {
  "use strict";
  var socket = io.connect(supervisorUrl);

  socket.on('connect', function () {
    socket.emit("identify", name);
  });
  
  var handlers = {};

  function getComm(partner) {
    if (!(partner in handlers)) {
      handlers[partner] = {};
    }

    return {
      name: partner,
      send: function(type, message) {
        socket.emit('send', {type: type, to: partner, body: message});
      },
      on: function(e, fn) {
        var handler = function(data) {
          if (data.from === partner) {
            fn(data.body);
          }
        };
        if (!(e in handlers[partner])) {
          handlers[partner][e] = [];
        }

        handlers[partner][e].push(handler);
        socket.on(e, handler);
      },
      off: function(e, fn) {
        if (!fn) {
          _.each(handlers[partner][e] || [], function(fn) {
            socket.removeListener(e, fn);
          });
          handlers[partner][e] = [];
        }
        else {
          socket.removeListener(e, fn);
        }
      }
    };
  }

  return {
    get: getComm
  };
};