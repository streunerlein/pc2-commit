"use strict";

var _ = require('underscore');
var machina = require('machina');

var DEFAULT_VOTE_TIMEOUT = 30000;
var DEFAULT_ACK_TIMEOUT = 30000;

var coordinator = machina.Fsm.extend({
  initialState: 'STATE_INIT',

  opts: {
    voteTimeout: DEFAULT_VOTE_TIMEOUT,
    ackTimeout: DEFAULT_ACK_TIMEOUT,
  },

  initialize: function(comm, logger, opts) {
    this.comm = comm;
    this.logger = logger;

    if (opts) {
      this.opts = _.extend(this.opts, opts);
    }
  },

  states: {
    STATE_INIT: {
      ready: function() {
        // read log file
        var lastEntry = this.logger.getLogsSync(1)[0] || null;

        if (lastEntry && lastEntry.type !== 'end') {
          this.transaction = {
            id: lastEntry.transaction,
            nodes: lastEntry.data,
            lastState: lastEntry.type
          };

          this.transition('STATE_RECOVERY');
        }
        else {
          this.transition('STATE_READY');
        }
      }
    },
    STATE_RECOVERY: {
      _onEnter: function() {
        this.ackingNodes = this.transaction.nodes;
        this.handle("sendMessage");
      },
      sendMessage: function() {
        var comm = this.comm;
        var coordinator = this;
        var transaction = this.transaction;
        var recoveryMessage = '';

        switch (transaction.lastState) {
          case 'commit':
            recoveryMessage = 'COMMIT';
            break;
          case 'abort':
            recoveryMessage = 'ABORT';
            break;
        }

        this.timeoutId = setTimeout(function() { this.handle('ackTimeout'); }.bind(this), this.opts.ackTimeout);

        _.each(this.ackingNodes, function(nodeName) {
          comm.get(nodeName).send(recoveryMessage, {});

          comm.get(nodeName).off('ACK');
          comm.get(nodeName).on('ACK', function() { coordinator.handle('ack', nodeName); });
        });
      },
      ack: function(node) {
        if (_.indexOf(this.ackingNodes, node) !== -1) {
          this.comm.get(node).off('ACK');

          this.ackingNodes = _.difference(this.ackingNodes, [node]);

          if (!this.ackingNodes.length) {
            this.handle('allAck');
          }
        }
      },
      allAck: function() {
        // force write end record
        this.logger.end(this.transaction.id);

        delete this.transaction;

        this.transition('STATE_READY');
      },
      ackTimeout: function() {
        // re-send after a timeout
        this.handle('sendMessage');
      },
      _onExit: function() {
        clearTimeout(this.timeoutId);

        delete this.ackingNodes;
        delete this.timeoutId;
      }
    },
    STATE_READY: {
      transaction: function(transaction) {
        var comm = this.comm;
        this.transaction = transaction;
        this.queriesByNode = _.groupBy(this.transaction.queries, function(query) { return query[0]; });

        _.each(this.queriesByNode, function(queries, nodeName) {
          comm.get(nodeName).send('PREPARE', {
            id: transaction.id,
            queries: queries
          });
        });

        this.handle('wait');
      },
      wait: function() {
        this.transition('STATE_WAIT');
      }
    },
    STATE_WAIT: {
      _onEnter: function() {
        var comm = this.comm;
        var coordinator = this;

        this.yesvotes = [];
        this.novotes = [];
        this.timeoutId = setTimeout(function() { this.handle('voteTimeout'); }.bind(this), this.opts.voteTimeout);

        _.each(this.queriesByNode, function(queries, nodeName) {
          comm.get(nodeName).on('YES VOTE', function() { coordinator.handle('yesvote', nodeName); });
          comm.get(nodeName).on('NO VOTE',  function() { coordinator.handle('novote', nodeName); });
        });
      },
      yesvote: function(node) {
        this.yesvotes.push(node);

        this.handle('voteReceived');
      },
      novote: function(node) {
        this.novotes.push(node);

        this.handle('voteReceived');
      },
      voteReceived: function() {
        var nodesTotal = _.keys(this.queriesByNode).length;

        if (nodesTotal === this.yesvotes.length) {
          this.handle('allVotesYes');
        }
        else if (nodesTotal === this.yesvotes.length + this.novotes.length) {
          this.handle('someVotesNo');
        }
      },
      allVotesYes: function() {
        this.transition('STATE_COMMITTING');
      },
      someVotesNo: function() {
        this.transition('STATE_ABORTING');
      },
      voteTimeout: function() {
        this.transition('STATE_ABORTING');
      },
      _onExit: function() {
        clearTimeout(this.timeoutId);

        var comm = this.comm;

        _.each(this.queriesByNode, function(queries, nodeName) {
          comm.get(nodeName).off('YES VOTE');
          comm.get(nodeName).off('NO VOTE');
        });
      },
    },
    STATE_COMMITTING: {
      _onEnter: function() {
        var comm = this.comm;
        var nodesToSendCommit = _.keys(this.queriesByNode);

        // force write commit record
        this.logger.commit(this.transaction.id, nodesToSendCommit, {force: true});

        _.each(nodesToSendCommit, function(nodeName) {
          comm.get(nodeName).send('COMMIT', {});
        });

        // send client OK
        comm.get(this.transaction.client).send('OK');

        this.ackingNodes = nodesToSendCommit;

        this.handle('waitForAck');
      },
      waitForAck: function() {
        this.transition('STATE_ACK');
      }
    },
    STATE_ABORTING: {
      _onEnter: function() {
        var comm = this.comm;
        var nodesToSendAbort = _.difference(_.keys(this.queriesByNode), this.novotes);

        // force write abort record
        this.logger.abort(this.transaction.id, nodesToSendAbort, {force: true});

        _.each(nodesToSendAbort, function(nodeName) {
          comm.get(nodeName).send('ABORT', {});
        });

        comm.get(this.transaction.client).send('ERROR');

        this.ackingNodes = nodesToSendAbort;
        this.handle('waitForAck');
      },
      waitForAck: function() {
        this.transition('STATE_ACK');
      }
    },
    STATE_ACK: {
      _onEnter: function() {
        var coordinator = this;
        var comm = this.comm;

        this.timeoutId = setTimeout(function() { this.handle('ackTimeout'); }.bind(this), this.opts.ackTimeout);

        _.each(this.ackingNodes, function(nodeName) {
          comm.get(nodeName).on('ACK', function() { console.log('Ack from', nodeName); coordinator.handle('ack', nodeName); });
        });
      },
      ack: function(node) {
        console.log('Ack', node);
        if (_.indexOf(this.ackingNodes, node) !== -1) {
          this.comm.get(node).off('ACK');
          this.ackingNodes = _.difference(this.ackingNodes, [node]);

          console.log('Now waiting for', this.ackingNodes);

          if (!this.ackingNodes.length) {
            this.handle('allAck');
          }
        }
      },
      allAck: function() {
        // force write end record
        this.logger.end(this.transaction.id);

        this.transition('STATE_END');
      },
      ackTimeout: function() {
        // construct recovery information from log
        var lastEntry = this.logger.getLogsSync(1)[0];

        this.transaction = {
          id: lastEntry.transaction,
          nodes: this.ackingNodes,
          lastState: lastEntry.type
        };

        this.transition('STATE_RECOVERY');
      },
      _onExit: function() {
        var comm = this.comm;

        clearTimeout(this.timeoutId);

        _.each(this.ackingNodes, function(nodeName) {
          comm.get(nodeName).off('ACK');
        });

        delete this.timeoutId;
      }
    },
    STATE_END: {
      _onEnter: function() {
        clearTimeout(this.timeoutId);

        // forget
        delete this.timeoutId;
        delete this.yesvotes;
        delete this.acks;
        delete this.queriesByNode;
        delete this.transaction;
        delete this.acksExpected;
        delete this.acksReceived;

        this.handle('ready');
      },
      ready: function() {
        this.transition('STATE_READY');
      }
    }
  },

  executeTransaction: function(transaction) {
    this.handle('transaction', transaction);
  },

  ready: function() {
    this.handle('ready');
  }
});

module.exports = coordinator;
