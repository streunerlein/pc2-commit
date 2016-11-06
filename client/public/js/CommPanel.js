
var CommMessageView = Backbone.View.extend({
  model: CommModel,
  className: 'commmessage',

  labelMap: {
    'PREPARE': 'info',
    'COMMIT': 'primary',
    'ABORT': 'danger',
    'ACK': 'success',
    'transaction': 'primary',
    'YES VOTE': 'success',
    'NO VOTE': 'danger',
    'OK': 'success',
    'ERROR': 'danger'
  },

  initialize: function() {
    this.model.on('change:delivered', this.delivered, this);
    this.model.on('destroy', this.remove, this);
  },

  render: function() {
    this.$el.html('' +
      '<div class="label label-' + this.labelMap[this.model.get('type')] + '">' +
        '<div class="bg"></div>' +
        '<span class="glyphicon left glyphicon-arrow-left" aria-hidden="true"></span>' +
        '<span>' + this.model.get('type') + '</span>' +
        '<span class="glyphicon right glyphicon-arrow-right" aria-hidden="true"></span>' +
      '</div>');

    var self = this;
    setTimeout(function() {
      self.$el.addClass('delivering');
    }, 16);
  },

  delivered: function() {
  }
});

var CommPanel = Backbone.View.extend({
  model: CommCollection,

  initialize: function(opts) {
    this.options = opts;
    this.model.on('add', this.add, this);
  },

  add: function(model) {
    var message = new CommMessageView({
      model: model,
    });

    message.render();

    if (model.get('to') === this.options.left) {
      message.$el.addClass('toleft');
    }
    else {
      message.$el.addClass('toright');
    }

    this.$el.append(message.$el);

    if (this.length > 10) {
      var oldMessage = this.shift();
      oldMessage.destroy();
    }
  }
});