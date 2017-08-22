var _ = require('ep_etherpad-lite/static/js/underscore');

var commentDelete = require('./commentDelete');

// messages sent to outside
var COMMENT_ACTIVATED_MESSAGE_TYPE = 'comment_activated';
var NEW_DATA_MESSAGE_TYPE = 'comments_data_changed';
// messages coming from outside
var DELETE_COMMENT_MESSAGE_TYPE = 'comment_delete';
var ACTIVATE_COMMENT_MESSAGE_TYPE = 'comment_activate';
var EDIT_COMMENT_MESSAGE_TYPE = 'comment_edit';
var CREATE_REPLY_MESSAGE_TYPE = 'comment_reply_create';

exports.initialize = function(ace) {
  // listen to outbound calls of this API
  window.addEventListener('message', function(e) {
    _handleOutboundCalls(e, ace);
  });
}

var _handleOutboundCalls = function _handleOutboundCalls(e, ace) {
  switch (e.data.type) {
    case DELETE_COMMENT_MESSAGE_TYPE:
      commentDelete.deleteComment(e.data.commentId, ace);
      // TODO this should be replaced by a better method.
      // Call commentDataManager.updateListOfCommentsStillOnText() directly?
      pad.plugins.ep_comments_page.collectComments();
      break;
    case ACTIVATE_COMMENT_MESSAGE_TYPE:
      onCommentActivation(e.data.commentId);
      break;
    case EDIT_COMMENT_MESSAGE_TYPE:
      onCommentEdition(e.data.commentId, e.data.text);
      break;
    case CREATE_REPLY_MESSAGE_TYPE:
      onReplyCreate(e.data.commentId, e.data.text);
      break;
  }
}

var onCommentActivation = function() {};
exports.setHandleCommentActivation = function(fn) {
  onCommentActivation = fn;
}

var onCommentEdition = function() {};
exports.setHandleCommentEdition = function(fn) {
  onCommentEdition = fn;
}

var onReplyCreate = function() {};
exports.setHandleReplyCreation = function(fn) {
  onReplyCreate = fn;
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
        commentId: 'c-b4WEFBNt7Bxu6Dhr',
        author: 'a.dG8CtEvWhEmR3cf5',
        name: 'Author Name',
        text: 'the comment text',
        timestamp: 1501599806477,
        replies: [
          {
            replyId: 'c-reply-dfksfu2df',
            author: 'a.aT8CtEvWhEmR3cf5',
            name: 'Other Author Name',
            text: 'the reply text',
            timestamp: 1621599806477,
          },
          (...)
        ]
      },
      (...)
    ]
  }
*/
exports.triggerDataChanged = function(commentsData, repliesData, orderedCommentIds) {
  _putRepliesInsideComments(commentsData, repliesData);
  var orderedData = _buildSortedData(commentsData, orderedCommentIds);

  var message = {
    type: NEW_DATA_MESSAGE_TYPE,
    values: orderedData,
  };

  _triggerEvent(message);
}

var _putRepliesInsideComments = function(commentsData, repliesData) {
  _makeSureAllCommentsHaveRepliesProp(commentsData);

  _(repliesData).each(function(replyData, replyId) {
    var commentId = replyData.commentId;
    // TODO remove this "data" here
    var commentData = commentsData[commentId].data;
    commentData.replies.push(replyData);
  });
}

var _makeSureAllCommentsHaveRepliesProp = function(commentsData) {
  _(commentsData).each(function(commentData, commentId) {
    // TODO remove this "data" here
    commentData.data.replies = [];
  });
}

var _buildSortedData = function(commentsData, orderedCommentIds) {
  return _(orderedCommentIds).map(function(commentId) {
    // TODO remove this "data" here
    return commentsData[commentId].data;
  });
}

var _triggerEvent = function _triggerEvent(message) {
  // if there's a wrapper to Etherpad, send data to it; otherwise use Etherpad own window
  var target = window.parent ? window.parent : window;
  target.postMessage(message, '*');
}
