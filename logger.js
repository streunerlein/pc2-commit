"use strict";

var fs = require('fs');
var _ = require('underscore');
var fsx = require('fs-extra');

var Logger = function(identity, coordinatorIdentity, logfilepath) {

  var logfile = (logfilepath || './') + 'cp-' + identity + '.log';

  fsx.ensureFileSync(logfile);
  var fd = fs.openSync(logfile, 'a');
  var fieldSeparator = "|";

  this.getFilePath = function() {
    return logfile;
  };

  this.log = function(type, transaction, data, options) {
    var opts = _.extend({
      callback: _.noop,
      force: false
    }, options || {});

    var line = [type, identity, transaction, coordinatorIdentity, data ? JSON.stringify(data) : ''].join(fieldSeparator) + "\n";
    
    fs.writeSync(fd, line);

    if (opts.force === true) {
      fs.fsyncSync(fd);
    }

    opts.callback();
  };

  this.commit = function(transactionId, nodes, opts) {
    this.log('commit', transactionId, nodes, opts);
  };

  this.abort = function(transactionId, nodes, opts) {
    this.log('abort', transactionId, nodes, opts);
  };

  this.end = function(transactionId, opts) {
    this.log('end', transactionId, null, opts);
  };

  this.prepare = function(transactionId, queries, opts) {
    this.log('prepare', transactionId, queries, opts);
  };

  this.getLogsSync = function(tail) {
    var lines = _.reject(fs.readFileSync(logfile, 'utf8').split("\n"), function(l) { return l === ''; });

    if (tail && tail > 0) {
      lines = _.last(lines, tail);
    }

    var entries = _.map(lines, function(line) {
      var parts = line.split(fieldSeparator);

      return {
        type:        parts[0],
        process:     parts[1],
        transaction: parts[2],
        coordinator: parts[3],
        data:        parts[4] !== '' ? JSON.parse(parts[4]) : null
      };
    });

    return entries;
  };
};

module.exports = Logger;