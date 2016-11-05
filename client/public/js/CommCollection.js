"use strict";

var CommModel = Backbone.Model.extend({
  defaults: {
    from: null,
    to: null,
    type: null,
    body: null,
    ended: false
  },
  idAttribute: 'msgid'
});

var CommCollection = Backbone.Collection.extend({
  model: CommModel
});