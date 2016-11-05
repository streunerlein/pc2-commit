"use strict";

if (!process.env.CP_NODE) {
  console.log('Please specify a cp node name for this instance (e.g. CP_NODE=node0).');
  process.exit(1);
}

var nodeFsm = require('./node');
var Logger = require('./logger');
var config = require('./config');
var nodeconfig = config.nodes[process.env.CP_NODE];
var comm = require('./comm')(nodeconfig.id);
var db = require('./db');
var monitor = require('./monitor');

var log = new Logger(nodeconfig.id, config.coordinator.id);
var nodeDb = new db();
var node = new nodeFsm(comm, log, nodeconfig.id, nodeDb);

monitor(node, nodeconfig.debug, {
  log: log.getFilePath(),
  db: nodeDb.getFilePath(nodeconfig.id)
});

node.ready();