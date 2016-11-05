"use strict";

var chai = require('chai');
var expect = chai.expect;

var logger = require('../logger');
var fs = require('fs');
var rmdir = require('rmdir');

describe('Log', function() {
  var testLogPath = './';
  var testlogfile = '';
  var testLogger = null;

  beforeEach(function() {
    testLogger = new logger('process', 'coordinator', testLogPath);
    testlogfile = testLogger.getFilePath();
  });

  afterEach(function() {
    fs.unlinkSync(testlogfile);
  });

  it('should create logfile and intermediate directories', function() {
    var testPath = 'testpath/does/not/exist/';
    var l = new logger('process', 'coordinator-test', testPath);

    expect(fs.existsSync(l.getFilePath())).to.equal(true);

    rmdir('./testpath');
  });

  it('should write synchronous when force write attribute is set', function() {
    testLogger.log('Test', '', {}, {force: true});

    var logContent = fs.readFileSync(testlogfile, 'utf8');

    expect(logContent).not.to.equal('');
  });

  it('should put every log on a new line', function() {
    testLogger.log('Test', '', {}, {force: true});
    testLogger.log('Test', '', {}, {force: true});
    testLogger.log('Test', '', {}, {force: true});

    var logContent = fs.readFileSync(testlogfile, 'utf8');

    expect(logContent.split("\n").length).to.equal(4);
  });

  it('write/read commit correctly', function() {
    testLogger.commit('id1', ['node0', 'node1'], {force: true});

    var line = testLogger.getLogsSync(1)[0];

    expect(line).to.deep.equal({
      type: 'commit',
      process: 'process',
      transaction: 'id1',
      coordinator: 'coordinator',
      data: ['node0', 'node1']
    });
  });

  it('write/read abort correctly', function() {
    testLogger.abort('id1', ['node0', 'node1'], {force: true});

    var line = testLogger.getLogsSync(1)[0];

    expect(line).to.deep.equal({
      type: 'abort',
      process: 'process',
      transaction: 'id1',
      coordinator: 'coordinator',
      data: ['node0', 'node1']
    });
  });

  it('write/read end correctly', function() {
    testLogger.end('id1', {force: true});

    var line = testLogger.getLogsSync(1)[0];

    expect(line).to.deep.equal({
      type: 'end',
      process: 'process',
      transaction: 'id1',
      coordinator: 'coordinator',
      data: null
    });
  });

  it('return complete log', function() {
    testLogger.log('Test 1', '', {}, {force: true});
    testLogger.log('Test 2', '', {}, {force: true});
    testLogger.log('Test 3', '', {}, {force: true});

    var logs = testLogger.getLogsSync(0);

    expect(logs.length).to.equal(3);
    expect(logs[0].type).to.equal('Test 1');
    expect(logs[1].type).to.equal('Test 2');
    expect(logs[2].type).to.equal('Test 3');
  });
});