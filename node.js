"use strict";

var _ = require('underscore');
var machina = require('machina');

var DEFAULT_RETRY_TIMEOUT = 30000;

var node = machina.Fsm.extend({
  initialState: 'STATE_INIT',

  opts: {
    retryTimeout: DEFAULT_RETRY_TIMEOUT
  },

  initialize: function(comm, logger, name, db, opts) {
    this.comm = comm;
    this.logger = logger;
    this.name = name;
    this.db = db;

    if (opts) {
      this.opts = _.extend(this.opts, opts);
    }
  },

  states: {
    STATE_INIT: {
      ready: function() {
        // read log file
        var lastEntry = this.logger.getLogsSync(1)[0] || null;

        if (lastEntry && lastEntry.type === 'prepare') {
          this.transaction = {
            id: lastEntry.transaction,
            queries: lastEntry.data,
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
        this.comm.get('coordinator').on('COMMIT', function() { this.handle('commit'); }.bind(this));
        this.comm.get('coordinator').on('ABORT', function() { this.handle('abort'); }.bind(this));

        this.handle('sendVote');
      },
      sendVote: function() {
        this.timeoutId = setTimeout(function() { this.handle('timeout'); }.bind(this), this.opts.retryTimeout);
        this.comm.get('coordinator').send('YES VOTE');
      },
      timeout: function() {
        this.handle('sendVote');
      },
      commit: function() {
        this.transition('STATE_COMMITTING');
      },
      abort: function() {
        this.transition('STATE_ABORTING');
      },
      _onExit: function() {
        this.comm.get('coordinator').off('COMMIT');
        this.comm.get('coordinator').off('ABORT');

        clearTimeout(this.timeoutId);

        delete this.timeoutId;
      }
    },
    STATE_READY: {
      _onEnter: function() {
        this.comm.get('coordinator').on('PREPARE', function(transaction) {
          this.handle('prepareReceived', transaction);
        }.bind(this));
      },
      prepareReceived: function(transaction) {
        this.transaction = transaction;

        this.logger.prepare(transaction.id, transaction.queries, {force: true});

        this.comm.get('coordinator').send('YES VOTE');

        this.transition('STATE_PREPARED');
      },
      _onExit: function() {
        this.comm.get('coordinator').off('PREPARE');
      }
    },
    STATE_PREPARED: {
      _onEnter: function() {
        this.comm.get('coordinator').on('COMMIT', function() { this.handle('commit'); }.bind(this));
        this.comm.get('coordinator').on('ABORT', function() { this.handle('abort'); }.bind(this));
      },
      commit: function() {
        this.transition('STATE_COMMITTING');
      },
      abort: function() {
        this.transition('STATE_ABORTING');
      },
      _onExit: function() {
        this.comm.get('coordinator').off('COMMIT');
        this.comm.get('coordinator').off('ABORT');
      }
    },
    STATE_COMMITTING: {
      _onEnter: function() {
        this.logger.commit(this.transaction.id, this.name, {force: true});
        this.comm.get('coordinator').send('ACK');

        _.each(this.transaction.queries, this.db.executeQuery.bind(this.db));

        this.handle('ready');
      },
      ready: function() {
        this.transition('STATE_READY');
      },
      _onExit: function() {
        delete this.transaction;
      }
    },
    STATE_ABORTING: {
      _onEnter: function() {
        this.logger.abort(this.transaction.id, this.name, {force: true});
        this.comm.get('coordinator').send('ACK');

        this.handle('ready');
      },
      ready: function() {
        this.transition('STATE_READY');
      },
      _onExit: function() {
        delete this.transaction;
      }
    }
  },

  ready: function() {
    this.handle('ready');
  }
});

module.exports = node;
