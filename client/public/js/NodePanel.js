
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
            '<div class="col-md-4">' + this.model.get('id') + '</div>' +
            '<div class="col-md-4">' + this.model.get('state') + '</div>' +
            (this.model.get('db') !== '' ? '<div class="col-md-4">DB: ' + this.model.get('db') + '</div>' : '') +
          '</div>' +
        '</h3>' +
      '</div>' +
      '<div class="panel-body">' +
        '<table class="table table-condensed log">' + (
          _.map(this.model.get('log'), function(line) {
            return '<tr>' + _.map(line.split("|"), function(part) {
              return '<td>' + JSON.stringify(part) + '</td>';
            }).join('') + '</tr>';
          }).join('')) +
        '</table>' +
      '</div>' +
      '<div class="panel-footer">' +
      '</div>' +
    '</div>');
  }
});