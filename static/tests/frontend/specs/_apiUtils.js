var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.apiUtils = {
  DATA_CHANGED_EVENT: 'comments_data_changed',

  lastDataSent: undefined,

  startListeningToApiEvents: function() {
    var self = this;
    var outboundApiEventsTarget = helper.padChrome$.window.parent;

    outboundApiEventsTarget.addEventListener('message', function(e) {
      if (e.data.type === self.DATA_CHANGED_EVENT) {
        self.lastDataSent = e.data.values;
      }
    });
  },

  waitForDataToBeSent: function(done) {
    var self = this;
    helper.waitFor(function() {
      return self.getLastDataSent();
    }).done(done);
  },

  getLastDataSent: function() {
    return this.lastDataSent;
  },

  resetData: function() {
    this.lastDataSent = undefined;
  },
}
