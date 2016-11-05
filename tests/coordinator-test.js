"use strict";

var chai = require('chai');
var expect = chai.expect;

var testlogPath = './';

var coordinatorFsm = require('./../coordinator');
var comm = require('./mocks/comm-mock')('coordinator');
var _ = require('underscore');
var logger = new require('../logger');
var fs = require('fs');

var testVoteTimeout = 30;
var testAckTimeout = 30;

describe('Coordinator', function() {
  var coordinator = null;
  var tempLogFilePath = '';
  var testtransaction = {
    id: parseInt(Math.random() * 1000),
    queries: [
      ['node0', 'ADD', 100],
      ['node1', 'SUBTRACT', 100]
    ],
    client: 'test-client'
  };

  beforeEach(function(done) {
    var testLogger = new logger('coordinator-test', 'coordinator-test', testlogPath);

    coordinator = new coordinatorFsm(
      comm,
      testLogger,
      {
        voteTimeout: testVoteTimeout,
        ackTimeout: testAckTimeout
      }
    );

    coordinator.on('transition', function(obj) {
      if (obj.fromState === 'STATE_INIT' && obj.toState === 'STATE_READY') {
        done();
      }
    });

    tempLogFilePath = testLogger.getFilePath();
    coordinator.ready();
  });

  afterEach(function() {
    coordinator.transition('STATE_END');
    fs.unlinkSync(tempLogFilePath);
  });

  it('should be in init state when created', function() {
    var freshLogger = new logger('coordinator-test-init', 'coordinator-test-init');
    
    expect(new coordinatorFsm(comm, freshLogger).state).to.equal('STATE_INIT');

    fs.unlink(freshLogger.getFilePath());
  });

  it('should be in ready state when ready called', function() {
    expect(coordinator.state).to.equal('STATE_READY');
  });

  it('should send prepare messages to nodes on a new transaction and go to STATE_WAIT', function() {
    coordinator.executeTransaction(testtransaction);

    expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('PREPARE');
    expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('PREPARE');

    expect(coordinator.state).to.equal('STATE_WAIT');
  });

  it('should send transaction id and only relevant queries to a node as part of the prepare message', function() {
    coordinator.executeTransaction(testtransaction);

    expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('PREPARE');
    expect(_.last(comm.getMessagesSent('node0'))[1].queries).to.deep.equal([['node0', 'ADD', 100]]);
    expect(_.last(comm.getMessagesSent('node0'))[1].id).to.equal(testtransaction.id);

    expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('PREPARE');
    expect(_.last(comm.getMessagesSent('node1'))[1].queries).to.deep.equal([['node1', 'SUBTRACT', 100]]);
    expect(_.last(comm.getMessagesSent('node1'))[1].id).to.equal(testtransaction.id);

    expect(coordinator.state).to.equal('STATE_WAIT');
  });

  describe('in case of successful transaction', function() {
    it('should send commit messages if all votes are yes', function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');
      comm.get('node1').simulateMessage('YES VOTE', 'node1');

      expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('COMMIT');
      expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('COMMIT');
    });

    it('should wait for all votes before committing', function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');

      expect(_.last(comm.getMessagesSent('node0'))[0]).not.to.equal('COMMIT');
    });

    it('should write a commit record when moving to committing phase', function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');
      comm.get('node1').simulateMessage('YES VOTE', 'node1');

      var logLine = coordinator.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('commit');
    });

    it('should wait for all acks after COMMIT before moving to STATE_READY', function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');
      comm.get('node1').simulateMessage('YES VOTE', 'node1');

      expect(coordinator.state).to.equal('STATE_ACK');

      comm.get('node0').simulateMessage('ACK', 'node0');
      
      expect(coordinator.state).to.equal('STATE_ACK');

      comm.get('node1').simulateMessage('ACK', 'node1');
      
      expect(coordinator.state).to.equal('STATE_READY');
    });

    it('should write an end record after receiving acks after a commit', function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');
      comm.get('node1').simulateMessage('NO VOTE', 'node1');
      comm.get('node0').simulateMessage('ACK', 'node0');

      var logLine = coordinator.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('end');
    });

    it('should should not miss acks due to fast responding nodes', function() {
      // we can't test this with one single machine :(
    });
  });

  describe('in case of a no vote', function() {
    beforeEach(function() {
      coordinator.executeTransaction(testtransaction);

      comm.get('node0').simulateMessage('YES VOTE', 'node0');
      comm.get('node1').simulateMessage('NO VOTE', 'node1');
    });

    it('should send abort messages if one vote is no', function() {
      expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('ABORT');
      expect(_.last(comm.getMessagesSent('node1'))[0]).to.not.equal('COMMIT');
      expect(_.last(comm.getMessagesSent('node1'))[0]).to.not.equal('ABORT');
    });

    it('should write an abort record when moving to aborting phase', function() {
      var logLine = coordinator.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('abort');
    });

    it('should wait for specific acks after ABORT, move to STATE_READY and write an end record', function() {
      // requires an ack from node0 for the abort message
      expect(coordinator.state).to.equal('STATE_ACK');

      // sending an ack from novote node1 should have no effect
      comm.get('node1').simulateMessage('ACK', 'node1');
      expect(coordinator.state).to.equal('STATE_ACK');

      // though sending an ack from yesvote node0 should transition to STATE_READY
      comm.get('node0').simulateMessage('ACK', 'node0');
      expect(coordinator.state).to.equal('STATE_READY');

      var logLine = coordinator.logger.getLogsSync(1)[0];
      expect(logLine.type).to.equal('end');
    });
  });

  describe('in case of failure', function() {
    describe('where a node times out sending a vote', function() {
      beforeEach(function() {
        coordinator.executeTransaction(testtransaction);
      });

      it('should send abort messages to yes voters and timed out nodes', function(done) {
        comm.get('node0').simulateMessage('YES VOTE', 'node0');

        setTimeout(function() {
          expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('ABORT');
          expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('ABORT');

          done();
        }, testVoteTimeout + 16);
      });

      it('should not send abort messages to no voters', function(done) {
        comm.get('node0').simulateMessage('NO VOTE', 'node0');

        setTimeout(function() {
          expect(_.last(comm.getMessagesSent('node0'))[0]).not.to.equal('ABORT');
          expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('ABORT');

          done();
        }, testVoteTimeout + 16);
      });

      it('should wait for specific acks after ABORT, move to STATE_READY and write an end record', function(done) {
        comm.get('node0').simulateMessage('YES VOTE', 'node0');

        setTimeout(function() {
          expect(coordinator.state).to.equal('STATE_ACK');

          comm.get('node0').simulateMessage('ACK', 'node0');

          // paper is unspecific here
          // it seem that when a node does not respond to a vote
          // but still can send an ack
          // we assume this here as well for now and send
          // an ack from node1 (who did not respond to the vote)
          comm.get('node1').simulateMessage('ACK', 'node1');

          expect(coordinator.state).to.equal('STATE_READY');

          var logLine = coordinator.logger.getLogsSync(1)[0];
          expect(logLine.type).to.equal('end');

          done();
        }, testVoteTimeout + 16);
      });
    });

    describe('where a node times out sending an ack', function() {
      beforeEach(function() {
        coordinator.executeTransaction(testtransaction);

        comm.get('node0').simulateMessage('YES VOTE', 'node0');
        comm.get('node1').simulateMessage('YES VOTE', 'node1');

        comm.get('node0').simulateMessage('ACK', 'node0');
      });

      it('should hand over transaction to the recovery process', function(done) {
        setTimeout(function() {
          expect(coordinator.state).to.equal('STATE_RECOVERY');
          done();
        }, testAckTimeout + 16);
      });

      it('has its recovery process, sending COMMITs and waits only for unreceived acks', function(done) {
        comm.clearMessagesSent();

        setTimeout(function() {
          expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('COMMIT');

          comm.get('node1').simulateMessage('ACK', 'node1');

          expect(coordinator.state).to.equal('STATE_READY');

          var logLine = coordinator.logger.getLogsSync(1)[0];
          expect(logLine.type).to.equal('end');

          done();
        }, testAckTimeout + 16);
      });
    });
  });

  describe('has a recovery process that', function() {
    describe('recovers from committing state', function() {
      // create a new coordinator, that will simulate recovery
      var recoveringCoordinator = null;

      beforeEach(function() {
        coordinator.executeTransaction(testtransaction);

        comm.get('node0').simulateMessage('YES VOTE', 'node0');
        comm.get('node1').simulateMessage('YES VOTE', 'node1');

        // move this coordinator to end state, shutting it down
        coordinator.transition('STATE_END');

        recoveringCoordinator = new coordinatorFsm(
          comm,
          coordinator.logger,
          {
            voteTimeout: testVoteTimeout,
            ackTimeout: testAckTimeout
          }
        );

        comm.clearMessagesSent();

        recoveringCoordinator.ready();
      });

      it('by sending COMMIT to nodes and waits for the acks', function() {
        expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('COMMIT');
        expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('COMMIT');

        comm.get('node0').simulateMessage('ACK', 'node0');
        comm.get('node1').simulateMessage('ACK', 'node1');

        expect(recoveringCoordinator.state).to.equal('STATE_READY');

        var logLine = recoveringCoordinator.logger.getLogsSync(1)[0];
        expect(logLine.type).to.equal('end');
      });

      it('by sending periodically COMMIT to nodes and waits for the acks', function(done) {
        expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('COMMIT');
        expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('COMMIT');

        comm.get('node0').simulateMessage('ACK', 'node0');
        comm.clearMessagesSent();

        setTimeout(function() {
          // we should still be in recovery state
          expect(recoveringCoordinator.state).to.equal('STATE_RECOVERY');

          // non-acking node1 should have received another commit message
          expect(_.last(comm.getMessagesSent('node1'))[0]).to.equal('COMMIT');

          // after getting finally an ack from node1
          comm.get('node1').simulateMessage('ACK', 'node1');

          // back to normal (end record + state_ready)
          var logLine = recoveringCoordinator.logger.getLogsSync(1)[0];
          expect(logLine.type).to.equal('end');

          expect(recoveringCoordinator.state).to.equal('STATE_READY');
          done();
        }, testAckTimeout + 16);
      });
    });

    describe('recovers from aborting state', function() {
      // create a new coordinator, that will simulate recovery
      var recoveringCoordinator = null;

      beforeEach(function() {
        coordinator.executeTransaction(testtransaction);

        comm.get('node0').simulateMessage('YES VOTE', 'node0');
        comm.get('node1').simulateMessage('NO VOTE', 'node1');

        // move this coordinator to end state, shutting it down
        coordinator.transition('STATE_END');

        recoveringCoordinator = new coordinatorFsm(
          comm,
          coordinator.logger,
          {
            voteTimeout: testVoteTimeout,
            ackTimeout: testAckTimeout
          }
        );

        comm.clearMessagesSent();

        recoveringCoordinator.ready();
      });

      it('by sending ABORT to nodes and waits for the acks', function() {
        expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('ABORT');

        comm.get('node0').simulateMessage('ACK', 'node0');

        expect(recoveringCoordinator.state).to.equal('STATE_READY');

        var logLine = recoveringCoordinator.logger.getLogsSync(1)[0];
        expect(logLine.type).to.equal('end');
      });

      it('by sending periodically ABORT to nodes and waits for the acks', function(done) {
        expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('ABORT');

        comm.clearMessagesSent();

        setTimeout(function() {
          // we should still be in recovery state
          expect(recoveringCoordinator.state).to.equal('STATE_RECOVERY');
          expect(_.last(comm.getMessagesSent('node0'))[0]).to.equal('ABORT');

          comm.get('node0').simulateMessage('ACK', 'node0');

          var logLine = recoveringCoordinator.logger.getLogsSync(1)[0];
          expect(logLine.type).to.equal('end');

          expect(recoveringCoordinator.state).to.equal('STATE_READY');
          done();
        }, testAckTimeout + 16);
      });
    });
  });
});