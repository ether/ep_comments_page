var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.apiUtils = {
  DATA_CHANGED_EVENT: 'comments_data_changed',
  COMMENT_ACTIVATED_EVENT: 'comment_activated',

  lastDataSent: {},

  startListeningToApiEvents: function() {
    var self = this;
    var outboundApiEventsTarget = helper.padChrome$.window.parent;

    outboundApiEventsTarget.addEventListener('message', function(e) {
      self.lastDataSent[e.data.type] = e.data;
    });
  },

  resetData: function() {
    this.lastDataSent = {};
  },

  waitForDataToBeSent: function(done) {
    var self = this;
    helper.waitFor(function() {
      return self.getLastDataSent();
    }).done(done);
  },

  getLastDataSent: function() {
    return this.lastDataSent[this.DATA_CHANGED_EVENT].values;
  },
  getLastActivatedComment: function() {
    return this.lastDataSent[this.COMMENT_ACTIVATED_EVENT].commentId;
  },

  /**** DELETE_COMMENT_EVENT ****/
  DELETE_COMMENT_EVENT: 'comment_delete',
  simulateCallToDeleteComment: function(commentId) {
    var message = {
      type: this.DELETE_COMMENT_EVENT,
      commentId: commentId,
    };

    var inboundApiEventsTarget = helper.padChrome$.window;
    inboundApiEventsTarget.postMessage(message, '*');
  },

}
