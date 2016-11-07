"use strict";

var chai = require('chai');
var expect = chai.expect;

var DB = require('./../db');
var fs = require('fs');

describe('DB', function() {
  var dbname = 'db-test-' + parseInt(Math.random()*1000, 10);
  var db = new DB();

  after(function() {
    fs.unlinkSync(db.getFilePath(dbname));
  });

  it('should initialize a new db file with 0', function() {
    var val = db.executeQuery([dbname, 'GET']);

    expect(val).to.equal(0);
  });

  it('should not throw an exception when writing while locked', function() {
    function set300() {
      db.executeQuery([dbname, 'SET', 300]);
    }

    db.lock(dbname);
    expect(set300).to.throw('locked');
    db.unlock(dbname);

    expect(db.executeQuery([dbname, 'GET'])).to.equal(0);
    set300();
    expect(db.executeQuery([dbname, 'GET'])).to.equal(300);
  });

  it('should write persistent to disk', function() {
    db.executeQuery([dbname, 'SET', 0]);

    db.executeQuery([dbname, 'ADD', 100]);
    expect(fs.readFileSync(db.getFilePath(dbname), {encoding: 'utf8'})).to.equal('100');

    db.executeQuery([dbname, 'ADD', 100]);
    expect(fs.readFileSync(db.getFilePath(dbname), {encoding: 'utf8'})).to.equal('200');

    db.executeQuery([dbname, 'SET', 100]);
    expect(fs.readFileSync(db.getFilePath(dbname), {encoding: 'utf8'})).to.equal('100');

    db.executeQuery([dbname, 'SUBTRACT', 100]);
    expect(fs.readFileSync(db.getFilePath(dbname), {encoding: 'utf8'})).to.equal('0');

    db.executeQuery([dbname, 'SUBTRACT', 100]);
    expect(fs.readFileSync(db.getFilePath(dbname), {encoding: 'utf8'})).to.equal('-100');
  });

  describe('SET', function() {
    it('should add specified amount to DB', function() {
      db.executeQuery([dbname, 'SET', 300]);
      var val = db.executeQuery([dbname, 'GET']);

      expect(val).to.equal(300);
    });
  });

  describe('ADD', function() {
    it('should add specified amount to DB', function() {
      db.executeQuery([dbname, 'SET', 100]);
      db.executeQuery([dbname, 'ADD', 100]);
      var valAfter = db.executeQuery([dbname, 'GET']);

      expect(valAfter).to.equal(200);
    });
  });

  describe('SUBTRACT', function() {
    it('should subtract specified amount from DB', function() {
      db.executeQuery([dbname, 'SET', 100]);
      db.executeQuery([dbname, 'SUBTRACT', 100]);
      var valAfter = db.executeQuery([dbname, 'GET']);

      expect(valAfter).to.equal(0);
    });
  });
});