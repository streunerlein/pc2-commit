"use strict";

var express = require('express');

module.exports = function(config, app) {
  app.set('view engine', 'pug');
  app.use(express.static(__dirname + '/public'));

  app.get('/', function(req, res){
    res.render(__dirname + '/index', {
      config: config
    });
  });
};