"use strict";

var config = require('./config');
var _ = require('underscore');

var geo = require('geoip-lite');
var app = require('express')();
var http = require('http').Server(app);
var client = require('./client');
var io = require('socket.io')(http);
var uuid = require('uuid');

http.listen(config.supervisor.port, function() {
  console.log('Client started on port', config.supervisor.port);
});

client(config, app);

var coordinator = null;
var nodes = {};
var clients = {};

var coordinatorId = config.coordinator.id;
var nodesConfig = config.nodes;

config.coordinator.geo = geo.lookup(config.coordinator.host);
_.each(config.nodes, function(node) {
  node.geo = geo.lookup(node.host) || node.geo || {};
});

io.sockets.on("connection", function (socket) {
  socket.on('query', function(queries) {
    var msg = {
      type: 'transaction',
      to: 'coordinator',
      from: 'client',
      body: {
        queries: queries,
        id: uuid.v4(),
        client: 'client'
      },
      msgid: uuid.v4(),
      devlivered: false
    };

    io.sockets.in('clients').emit(msg.type, msg);

    setTimeout(function() {
      coordinator.emit('transaction', msg);
      msg.delivered = true;
      io.sockets.in('clients').emit(msg.type, msg);
    }, config.commDelay);
  });

  socket.on('updatedelay', function(newdelay) {
    config.commDelay = parseInt(newdelay, 10);
    io.sockets.in('clients').emit('configupdate', config);
  });

  socket.on('send', function(msg) {
    if (socket.id in nodes) {
      msg.from = nodes[socket.id].name;
    }
    else if (socket.id === coordinator.id) {
      msg.from = 'coordinator';
    }
    else {
      msg.from = 'unknown';
    }

    msg.msgid = uuid.v4();
    msg.delivered = false;

    io.sockets.in('clients').emit(msg.type, msg);

    setTimeout(function() {
      msg.delivered = true;
      var room = msg.from === coordinatorId ? msg.to : msg.from;

      socket.broadcast.to(room).emit(msg.type, msg);
      io.sockets.in('clients').emit(msg.type, msg);
    }, config.commDelay);
  });

  socket.on('getnodes', function() {
    socket.emit('nodes', _.values(_.pluck(nodes, 'name')));
  });

  socket.on('identify', function(name) {
    if (name in nodesConfig) {
      socket.name = name;
      socket.type = 'node';
      nodes[socket.id] = socket;

      socket.join(name);

      _.mapObject(clients, function(client) {
        client.join(name);
      });

      console.log("Node", socket.name, "joined.");

      if (coordinator !== null) {
        coordinator.join(name);
      }
    }
    else if (name === coordinatorId) {
      coordinator = socket;
      console.log("Coordinator joined.");

      _.mapObject(nodes, function(node) {
        coordinator.join(node.name);
      });
    }
    else if (name === 'client') {
      console.log("Client socket identified as " + name + ".");
      clients[socket.id] = socket;

      socket.join('clients');
    }
    else {
      console.log("Unknown socket identified as " + name + ".");
    }
  });

  socket.on('disconnect', function() {
    if (coordinator !== null && socket.id === coordinator.id) {
      console.log("Coordinator disconnected.");
      coordinator = null;
    }
    else if (socket.id in nodes) {
      console.log("Node disconnected.");
      delete nodes[socket.id];
    }
    else if (socket.id in clients) {
      console.log("Client disconnected.");
      delete clients[socket.id];
    }
    else {
      console.log("Unknown socket disconnected.");
    }
  });
});