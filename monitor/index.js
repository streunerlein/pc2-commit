"use strict";

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('underscore');
var Tail = require('always-tail');
var watch = require('node-watch');
var fs = require('fs');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

module.exports = function(fsm, config, files, db) {
  var port = config.port;
  files = files || {};

  http.listen(port, function() {
    console.log('Debug monitor started on port', port);
  });

  io.on('connection', function(socket) {
    socket.emit('state', {
      state: fsm.state
    });

    if ('db' in files) {
      fs.readFile(files['db'], {encoding: 'utf8'}, function(err, content) {
        io.sockets.emit('dbupdate', content);
        io.sockets.emit('lockstate', db.islocked(config.id));
      });

      socket.on('lock', function() {
        db.lock(config.id);
        socket.emit('lockstate', db.islocked(config.id));
      });

      socket.on('unlock', function() {
        db.unlock(config.id);
        socket.emit('lockstate', db.islocked(config.id));
      });
    }
  });

  fsm.on('transition', function(handle) {
    io.sockets.emit('transition', _.extend(handle, {state: fsm.state}));
  });

  _.each(files, function(filepath, id) {
    if (id === 'db') {
      watch(filepath, function() {
        fs.readFile(filepath, {encoding: 'utf8'}, function(err, content) {
          io.sockets.emit('dbupdate', content);
        });
      });
      return;
    }
    var tail = new Tail(filepath, '\n', {interval: 500});
     
    tail.on('line', function(line) {
      io.sockets.emit('fileupdate', _.extend({
        id: id,
        line: line
      }));
    });

    tail.watch();
  });
};