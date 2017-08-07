var _ = require('ep_etherpad-lite/static/js/underscore');

var commentDelete = require('./commentDelete');

// messages sent to outside
var COMMENT_ACTIVATED_MESSAGE_TYPE = 'comment_activated';
var NEW_DATA_MESSAGE_TYPE = 'comments_data_changed';
// messages coming from outside
var DELETE_COMMENT_MESSAGE_TYPE = 'comment_delete';
var ACTIVATE_COMMENT_MESSAGE_TYPE = 'comment_activate';

exports.initialize = function(ace) {
  // listen to outbound calls of this API
  window.addEventListener('message', function(e) {
    _handleOutboundCalls(e, ace);
  });
}

var _handleOutboundCalls = function _handleOutboundCalls(e, ace) {
  if (e.data.type === DELETE_COMMENT_MESSAGE_TYPE) {
    commentDelete.deleteComment(e.data.commentId, ace);

    // TODO this should be replaced by a better method
    pad.plugins.ep_comments_page.collectComments();
  } else if (e.data.type === ACTIVATE_COMMENT_MESSAGE_TYPE) {
    onCommentActivation(e.data.commentId);
  }
}

var onCommentActivation = function() {};
exports.setHandleCommentActivation = function(fn) {
  onCommentActivation = fn;
}

/*
  message: {
    type: 'comment_activated',
    commentId: 'c-b4WEFBNt7Bxu6Dhr'
  }
*/
exports.triggerCommentActivation = function(commentId) {
  var message = {
    type: COMMENT_ACTIVATED_MESSAGE_TYPE,
    commentId: commentId,
  };
  _triggerEvent(message);
}
exports.triggerCommentDeactivation = function() {
  this.triggerCommentActivation(undefined);
}

/*
  message: {
    type: 'comments_data_changed',
    values: [
      {
        author: 'a.dG8CtEvWhEmR3cf5',
        commentId: 'c-b4WEFBNt7Bxu6Dhr',
        name: 'Author Name',
        text: 'the comment text',
        timestamp: 1501599806477,
      }
    ]
  }
*/
exports.triggerDataChanged = function(commentsData, orderedCommentIds) {
  var data = _buildSortedData(commentsData, orderedCommentIds);

  var message = {
    type: NEW_DATA_MESSAGE_TYPE,
    values: data,
  };

  _triggerEvent(message);
}

var _buildSortedData = function(commentsData, orderedCommentIds) {
  return _(orderedCommentIds).map(function(commentId) {
    return commentsData[commentId].data;
  });
}

var _triggerEvent = function _triggerEvent(message) {
  // if there's a wrapper to Etherpad, send data to it; otherwise use Etherpad own window
  var target = window.parent ? window.parent : window;
  target.postMessage(message, '*');
}
