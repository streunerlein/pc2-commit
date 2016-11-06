"use strict";

var express = require('express');
var geo = require('geoip-lite');

module.exports = function(config, app) {
  app.set('view engine', 'pug');
  app.use(express.static(__dirname + '/public'));

  app.get('/', function(req, res){
    var host = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var cgeo = geo.lookup(host) || {};
    res.render(__dirname + '/index', {
      config: config,
      client: {
        geo: cgeo,
        host: host
      }
    });
  });
};