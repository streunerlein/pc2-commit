"use strict";

var _ = require('underscore');

module.exports = function(type) {
  var messagesSent = {};
  var messageHandlers = {};

  function getComm(to) {
    if (!(to in messagesSent)) {
      messagesSent[to] = [];
    }
    if (!(to in messageHandlers)) {
      messageHandlers[to] = {};
    }

    return {
      name: to,
      send: function(type, message) {
        messagesSent[to].push([type, message]);
      },
      on: function(e, fn) {
        if (!(e in messageHandlers)) {
          messageHandlers[to][e] = [];
        }

        messageHandlers[to][e].push(function(data) {
          if (data.from === to) {
            fn(data.body);
          }
        });
      },
      off: function(e, fn) {
        if (!fn) {
          delete messageHandlers[to][e];
        }
        else {
          if (e in messageHandlers[to]) {
            var ix = messageHandlers[to][e].indexOf(fn);

            if (ix !== -1) {
              messageHandlers[to][e].splice(ix, 1);
            }
          }
        }
      },
      simulateMessage: function(e, body) {
        _.invoke(messageHandlers[to][e], 'call', null, {
          from: to,
          body: body
        });
      }
    };
  }

  return {
    get: getComm,
    getMessagesSent: function(to) {
      return messagesSent[to] || [];
    },
    clearMessagesSent: function() {
      messagesSent = {};
    }
  };
};