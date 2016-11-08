"use strict";

var NodeModel = Backbone.Model.extend({
  defaults: {
    log: []
  },

  initialize: function() {
    var model = this;
    this.socket = io.connect('http://' + this.get('host') + ':' + this.get('debug').port);

    this.socket.on('connect', function() {
      model.set('online', true);
    });
    this.socket.on('disconnect', function() {
      model.set('online', false);
    });
    this.socket.on('transition', function(s) { model.setState(s); });
    this.socket.on('state', function(s) { model.setState(s); });
    this.socket.on('fileupdate', function(s) { model.addLine(s); });
    this.socket.on('dbupdate', function(s) { model.set('db', s); });

    this.set('log', []);
    this.set('db', '');
  },

  setState: function(stateinfo) {
    this.set('state', stateinfo.state);
  },

  addLine: function(update) {
    var lines = this.get(update.id) || [];
    lines.push(update.line);

    this.set(update.id, lines);
    this.trigger('change');
  }
});