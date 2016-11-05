"use strict";

var config = require('./config');
var _ = require('underscore');

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

var delay = 1000;

var coordinatorId = config.coordinator.id;
var nodesConfig = config.nodes;

io.sockets.on("connection", function (socket) {

  socket.on('query', function(queries) {
    coordinator.emit('transaction', {
      from: 'client',
      body: {
        queries: queries,
        id: uuid.v4()
      }
    });
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

    setTimeout(function() {
      var room = msg.from === coordinatorId ? msg.to : msg.from;
      console.log("Sending to room", room, msg.type, JSON.stringify(msg));
      socket.broadcast.to(room).emit(msg.type, msg);
    }, delay);
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

      _.mapObject(nodes, function(node) {
        socket.join(node.name);
      });
      socket.join(coordinatorId);
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