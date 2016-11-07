"use strict";

var fs = require('fs');
var _ = require('underscore');

var DB = function(opts) {
  opts = _.extend({
    path: './',
  }, opts || {});

  var dblocks = [];

  this.lock = function(dbname) {
    dblocks.push(dbname);
  };

  this.unlock = function(dbname) {
    var pos = dblocks.indexOf(dbname);
    if (pos !== -1) {
      dblocks.splice(pos, 1);
    }
  };

  this.islocked = function(dbname) {
    return dblocks.indexOf(dbname) !== -1;
  };

  this.getDbFileName = function(dbname) {
    return dbname + '.pcdb';
  };

  this.getFilePath = function(dbname) {
    return opts.path + this.getDbFileName(dbname);
  };

  this.executeQuery = function(query) {
    var db = query[0];
    var action = query[1].toUpperCase();
    var delta = query[2] || 0;

    if (this.islocked(db)) {
      throw 'locked';
    }

    var currentValue = this.readDb(db);

    switch (action) {
      case 'ADD':
        currentValue = currentValue + parseInt(delta, 10);
        break;
      case 'SUBTRACT':
        currentValue = currentValue - parseInt(delta, 10);
        break;
      case 'GET':
        break;
      case 'SET':
        currentValue = parseInt(delta, 10);
        break;
    }

    this.writeDb(db, currentValue);

    return currentValue;
  };

  this.ensureDb = function(dbname) {
    var dbFile = this.getFilePath(dbname);

    if (!fs.existsSync(dbFile)) {
      fs.writeFileSync(dbFile, '0');
    }
  };

  this.readDb = function(dbname) {
    this.ensureDb(dbname);
    return parseInt(fs.readFileSync(this.getFilePath(dbname), {encoding: 'utf8'}), 10);
  };

  this.writeDb = function(dbname, newval) {
    this.ensureDb(dbname);
    return fs.writeFileSync(this.getFilePath(dbname), newval, {encoding: 'utf8'});
  };
};

module.exports = DB;