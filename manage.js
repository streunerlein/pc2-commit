"use strict";

var port = 8080;
var app = require('express')();
var http = require('http').Server(app);
var pm2 = require('pm2');
var config = require('./config');

var cb = function(route, res) {
  return function(err) {
      if (err) {
        console.log(route, "failed:", err);
        res.send(500);
      }
      else {
        console.log(route, "successful.");
        res.send(200);
      }
  };
};

http.listen(port, function() {
  console.log("Manager listening on port", port);

  pm2.connect(function(err) {
    console.log("PM2 connected.");

    if (err) {
      console.error(err);
      process.exit(2);
    }

    app.get('/start-node/:nodename', function(req, res) {
      if (req.params.nodename in config.nodes) {
        pm2.restart('pc-' + req.params.nodename, cb(req.path, res));
      }
    });

    app.get('/start-coordinator', function(req, res){
      pm2.restart('pc-coordinator', cb(req.path, res));
    });

    app.get('/stop-node/:nodename', function(req, res){
      if (req.params.nodename in config.nodes) {
        pm2.stop('pc-' + req.params.nodename, cb(req.path, res));
      }
    });

    app.get('/stop-coordinator', function(req, res){
      pm2.stop('pc-coordinator', cb(req.path, res));
    });
  });
});