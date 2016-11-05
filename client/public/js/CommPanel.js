
var CommMessageView = Backbone.View.extend({
  model: CommModel,

  initialize: function() {
    this.model.on('change:delivered', this.delivered, this);
    this.model.on('destroy', this.remove, this);
  },

  render: function() {
    this.$el.html('<span>' + this.model.get('type') + '</span>');
    this.$el.addClass('delivering');
  },

  delivered: function() {
    this.$el.removeClass('delivering').addClass('delivered');
  }
});

var CommPanel = Backbone.View.extend({
  model: CommCollection,

  initialize: function() {
    this.model.on('add', this.add, this);
  },

  add: function(model) {
    var message = new CommMessageView({
      model: model
    });
    message.render();
    this.$el.prepend(message.$el);

    if (this.length > 10) {
      var oldMessage = this.shift();
      oldMessage.destroy();
    }
  }
});