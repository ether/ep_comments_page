var _ = require('ep_etherpad-lite/static/js/underscore');

var commentDelete = require('./commentDelete');

var COMMENT_ACTIVATED_MESSAGE_TYPE = 'comment_activated';
var NEW_DATA_MESSAGE_TYPE = 'comments_data_changed';
var DELETE_COMMENT_MESSAGE_TYPE = 'comment_delete';

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
  }
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
