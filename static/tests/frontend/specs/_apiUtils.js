var ep_comments_page_test_helper = ep_comments_page_test_helper || {};
ep_comments_page_test_helper.apiUtils = {
  /**** messages sent to outside ****/
  DATA_CHANGED_EVENT: 'comments_data_changed',
  COMMENT_ACTIVATED_EVENT: 'comment_activated',

  lastDataSent: {},

  startListeningToApiEvents: function() {
    var self = this;
    this.resetData();

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
    return (this.lastDataSent[this.DATA_CHANGED_EVENT] || {}).values;
  },
  getLastActivatedComment: function() {
    return (this.lastDataSent[this.COMMENT_ACTIVATED_EVENT] || {}).commentId;
  },

  /**** messages coming from outside ****/
  DELETE_COMMENT_EVENT: 'comment_delete',
  ACTIVATE_COMMENT_EVENT: 'comment_activate',
  EDIT_COMMENT_EVENT: 'comment_edit',
  EDIT_REPLY_EVENT: 'comment_reply_edit',

  simulateCallToDeleteComment: function(commentId) {
    var message = {
      type: this.DELETE_COMMENT_EVENT,
      commentId: commentId,
    };

    var inboundApiEventsTarget = helper.padChrome$.window;
    inboundApiEventsTarget.postMessage(message, '*');
  },

  simulateCallToActivateComment: function(commentId) {
    var message = {
      type: this.ACTIVATE_COMMENT_EVENT,
      commentId: commentId,
    };

    var inboundApiEventsTarget = helper.padChrome$.window;
    inboundApiEventsTarget.postMessage(message, '*');
  },

  simulateCallToEditComment: function(commentId, newText) {
    var message = {
      type: this.EDIT_COMMENT_EVENT,
      commentId: commentId,
      text: newText,
    };

    var inboundApiEventsTarget = helper.padChrome$.window;
    inboundApiEventsTarget.postMessage(message, '*');
  },


  simulateCallToCreateReply: function(commentId, replyText) {
    var message = {
      type: this.EDIT_REPLY_EVENT,
      commentId: commentId,
      replyId: undefined,
      text: replyText,
    };

    var inboundApiEventsTarget = helper.padChrome$.window;
    inboundApiEventsTarget.postMessage(message, '*');
  },

}
