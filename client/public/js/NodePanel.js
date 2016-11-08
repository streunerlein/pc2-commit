
"use strict";

var NodePanel = Backbone.View.extend({
  className: 'node',

  initialize: function() {
    this.model.on('change', this.render, this);
  },

  events: {
    'click .stop': 'stopNode',
    'click .start': 'startNode',
    'click .lock': 'lockNode',
    'click .unlock': 'unlockNode'
  },

  stopNode: function() {
    this.trigger('stopNode');
  },

  startNode: function() {
    this.trigger('startNode');
  },

  lockNode: function() {
    this.trigger('lockNode');
  },

  unlockNode: function() {
    this.trigger('unlockNode');
  },

  render: function() {
    this.$el.html('<div class="panel panel-default">' +
      '<div class="panel-heading">' +
        '<h3 class="panel-title">' +
          '<div class="row">' +
            '<div class="col-md-6' + (this.model.get('online') ? ' text-success' : ' text-danger') + '"><small>' + this.model.get('id') + '</small><br/>' + this.model.get('state') + '</div>' +
            '<div class="col-md-6">' +
              '<div class="btn-group pull-right">' +
                (this.model.get('db') !== '' ? '' +
                    '<div class="btn-group" role="group">' +
                    '  <button type="button" class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
                    '    <span class="' + (this.model.get('lockstate') || !this.model.get('online') ? 'text-danger' : 'text-success') + ' glyphicon glyphicon-hdd" aria-hidden="true"></span> <span class="' + (this.model.get('lockstate') || !this.model.get('online') ? 'text-danger' : 'text-success') + '">' + this.model.get('db') + '</span>' +
                    '    <span class="' + (this.model.get('lockstate') || !this.model.get('online') ? 'text-danger' : 'text-success') + ' caret"></span>' +
                    '  </button>' +
                    '  <ul class="dropdown-menu">' +
                    '    <li>' + (this.model.get('lockstate') ? '<a class="unlock" href="#">Unlock database</a>' : ' <a class="lock" href="#">Lock database</a>') + '</li>' +
                    '  </ul>' +
                    '</div>' : '') +
                (this.model.get('online') ?
                  '<button class="stop btn btn-sm btn-default">' +
                    '<span class="glyphicon glyphicon-stop" aria-hidden="true"></span> Stop' +
                  '</button>' :
                  '<button class="start btn btn-sm btn-default">' +
                    '<span class="glyphicon glyphicon-play" aria-hidden="true"></span> Start' +
                  '</button>') +
              '</div></div>' +
          '</div>' +
        '</h3>' +
      '</div>' +
      '<div class="panel-body">' +
        '<h4>Log</h4>' +
        '<div class="log">' +
          '<table class="table table-condensed">' + (
            _.map(this.model.get('log'), function(line, ix) {
              var parts = line.split("|");
              return '<tr>' + _.map([ix, parts[0], parts[4]], function(part) {
                return '<td>' + part + '</td>';
              }).join('') + '</tr>';
            }).reverse().join('')) +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="panel-footer">' +
        '<small>' + this.model.get('host') + '</small>' +
        '<small class="pull-right">' + (this.model.get('geo').city + ', ' + this.model.get('geo').country) + '</small>' +
      '</div>' +
    '</div>');
  }
});