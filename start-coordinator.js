"use strict";

var config = require('./config').coordinator;
var comm = require('./comm')(config.id);
var coordinatorFsm = require('./coordinator');
var Logger = require('./logger');
var monitor = require('./monitor');

var log = new Logger(config.id, config.id);
var coordinator = new coordinatorFsm(comm, log);

comm.get('client').on('transaction', function(transaction) {
  coordinator.executeTransaction(transaction);
});

monitor(coordinator, config.debug, {log: log.getFilePath()});

coordinator.ready();