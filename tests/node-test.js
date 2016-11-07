"use strict";

var chai = require('chai');
var expect = chai.expect;

var testlogPath = './';

var nodeFsm = require('./../node');
var _ = require('underscore');
var logger = new require('../logger');
var fs = require('fs');
var db = require('./../db');

var nodename = 'node-test';
var testRetryTimeout = 30;

var comm = require('./mocks/comm-mock')(nodename);

describe('Node', function() {
  var node = null;
  var tempLogFilePath = '';
  var tempDbFile = '';

  var transaction = {
    id: parseInt(Math.random() * 1000, 10),
    queries: [
      [nodename, 'ADD', 100]
    ]
  };

  beforeEach(function() {
    var testLogger = new logger(nodename, 'coordinator-test', testlogPath);
    tempLogFilePath = testLogger.getFilePath();

    node = new nodeFsm(
      comm,
      testLogger,
      nodename,
      new db(),
      {
        retryTimeout: testRetryTimeout
      }
    );

    node.ready();
  });

  afterEach(function() {
    fs.unlinkSync(tempLogFilePath);
  });
  
  after(function() {
    fs.unlinkSync(node.db.getFilePath(nodename));
  });

  it('should be in init state when created', function() {
    var freshLogger = new logger('node-test-init', 'node-test-init');
    
    expect(new nodeFsm(comm, freshLogger).state).to.equal('STATE_INIT');

    fs.unlink(freshLogger.getFilePath());
  });

  it('should be in ready state when ready called', function() {
    expect(node.state).to.equal('STATE_READY');
  });

  describe('on receiving a prepare message', function() {
    beforeEach(function() {
      comm.get('coordinator').simulateMessage('PREPARE', transaction);
    });

    it('should force write a prepare record', function() {
      var logLine = node.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('prepare');
    });

    it('should be in prepared state after sending a yes vote', function() {
      expect(node.state).to.equal('STATE_PREPARED');
    });

    it('should send a yes vote', function() {
      expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('YES VOTE');
    });
  });

  describe('on receiving a prepare message', function() {
    var dbBefore = null;

    beforeEach(function() {
      dbBefore = node.db.executeQuery([nodename, 'GET']);

      comm.get('coordinator').simulateMessage('PREPARE', transaction);
    });

    it('db contents changed', function() {
      var dbAfter = node.db.executeQuery([nodename, 'GET']);

      expect(dbAfter).to.equal(dbBefore + 100);
    });

    it('should force write a prepare log record', function() {
      var logLine = node.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('prepare');
    });
  });

  describe('on database failure', function() {
    var dbBefore = null;

    beforeEach(function() {
      dbBefore = node.db.executeQuery([nodename, 'GET']);

      node.db.lock(nodename);

      comm.get('coordinator').simulateMessage('PREPARE', transaction);
    });

    it('should answer with a no vote', function() {
      expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('NO VOTE');
    });

    it('should not change database', function() {
      node.db.unlock(nodename);
      var dbAfter = node.db.executeQuery([nodename, 'GET']);

      expect(dbAfter).to.equal(dbBefore);
    });

    it('should be in state ready', function() {
      expect(node.state).to.equal('STATE_READY');
    });

    afterEach(function() {
      node.db.unlock(nodename);
    });
  });

  describe('on receiving a commit message', function() {
    var dbBefore = null;

    beforeEach(function() {
      dbBefore = node.db.executeQuery([nodename, 'GET']);

      comm.get('coordinator').simulateMessage('PREPARE', transaction);
      comm.get('coordinator').simulateMessage('COMMIT');
    });

    it('should force write a commit record', function() {
      var logLine = node.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('commit');
    });

    it('should send an ACK to the coordinator', function() {
      expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('ACK');
    });

    it('should be in state ready after committing', function() {
      expect(node.state).to.equal('STATE_READY');
    });

    it('db contents changed', function() {
      var dbAfter = node.db.executeQuery([nodename, 'GET']);

      expect(dbAfter).to.equal(dbBefore + 100);
    });
  });

  describe('on receiving an abort message', function() {
    var dbBefore = null;

    beforeEach(function() {
      dbBefore = node.db.executeQuery([nodename, 'GET']);

      comm.get('coordinator').simulateMessage('PREPARE', transaction);
      comm.get('coordinator').simulateMessage('ABORT');
    });

    it('should force write a abort record', function() {
      var logLine = node.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('abort');
    });

    it('should send an ACK to the coordinator', function() {
      expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('ACK');
    });

    it('should be in state ready after committing', function() {
      expect(node.state).to.equal('STATE_READY');
    });

    it('db contents unchanged', function() {
      var dbAfter = node.db.executeQuery([nodename, 'GET']);

      expect(dbAfter).to.equal(dbBefore);
    });
  });

  describe('on recovering from a prepared state', function() {
    var dbBefore = null;

    beforeEach(function() {
      dbBefore = node.db.executeQuery([nodename, 'GET']);
      comm.get('coordinator').simulateMessage('PREPARE', transaction);

      // restart node fsm
      node.transition('STATE_INIT');
      node.ready();
    });

    it('should keep sending a yes vote to coordinator', function(done) {
      expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('YES VOTE');

      setTimeout(function() {
        var lastTwoMessages = _.last(comm.getMessagesSent('coordinator'), 2);
        expect(lastTwoMessages[0][0]).to.equal('YES VOTE');
        expect(lastTwoMessages[1][0]).to.equal('YES VOTE');
        done();
      }, testRetryTimeout + 16);
    });

    describe('when receiving a commit decision', function(done) {
      beforeEach(function() {
        comm.get('coordinator').simulateMessage('COMMIT', transaction);
      });

      it('should force write a commit record', function() {
        var logLine = node.logger.getLogsSync(1)[0];
        expect(logLine.type).to.equal('commit');
      });

      it('should send an ACK to the coordinator', function() {
        expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('ACK');
      });

      it('should be in state ready after committing', function() {
        expect(node.state).to.equal('STATE_READY');
      });

      it('db contents changed', function() {
        var dbAfter = node.db.executeQuery([nodename, 'GET']);

        expect(dbAfter).to.equal(dbBefore + 100);
      });
    });

    describe('when receiving an abort decision', function(done) {
      beforeEach(function() {
        comm.get('coordinator').simulateMessage('ABORT');
      });

      it('should force write a abort record', function() {
        var logLine = node.logger.getLogsSync(1)[0];
        expect(logLine.type).to.equal('abort');
      });

      it('should send an ACK to the coordinator', function() {
        expect(_.last(comm.getMessagesSent('coordinator'))[0]).to.equal('ACK');
      });

      it('should be in state ready after committing', function() {
        expect(node.state).to.equal('STATE_READY');
      });

      it('db contents unchanged', function() {
        var dbAfter = node.db.executeQuery([nodename, 'GET']);

        expect(dbAfter).to.equal(dbBefore);
      });
    });
  });
});