
"use strict";

var NodePanel = Backbone.View.extend({
  className: 'node',

  initialize: function() {
    this.model.on('change', this.render, this);
  },

  render: function() {
    this.$el.html('<div class="panel panel-default">' +
      '<div class="panel-heading">' +
        '<h3 class="panel-title">' +
          '<div class="row">' +
            '<div class="col-md-4">' + this.model.get('id') + '<br/><small>' + this.model.get('host')  + '<br/>' + this.model.get('geo') + '</small></div>' +
            '<div class="col-md-4">' + this.model.get('state') + '</div>' +
            (this.model.get('db') !== '' ? '<div class="col-md-4">DB: ' + this.model.get('db') + '</div>' : '') +
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
      '</div>' +
    '</div>');
  }
});