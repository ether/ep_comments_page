var _ = require('ep_etherpad-lite/static/js/underscore');

exports.saveCommentOnPreMarkedText = function(commentId, preMarkedTextRepArr, ace) {
  var attributeName = 'comment';
  var attributeValue = commentId;

  ace.callWithAce(function(aceTop) {
    _(preMarkedTextRepArr).each(function(rep) {
      aceTop.ace_performSelectionChange(rep[0], rep[1], true);
      aceTop.ace_setAttributeOnSelection(attributeName, attributeValue);
    });
  }, 'saveComment', true);
}

exports.deleteCommentAndItsReplies = function(commentId, replyIdsOfComment, ace) {
  ace.callWithAce(function(aceTop) {
    _(replyIdsOfComment).each(function(replyId) {
      _deleteReplyOnCurrentAceEvent(replyId, commentId, aceTop);
    });

    _deleteCommentOnCurrentAceEvent(commentId, aceTop);
  }, 'deleteCommentedSelection', true);
}

var _deleteCommentOnCurrentAceEvent = function(commentId, ace) {
  var selector = '.' + commentId;
  var attributeName = 'comment';
  // Note that this is the correct way of doing it, instead of there being
  // a commentId we now flag it as "comment-deleted"
  var attributeValue = 'comment-deleted';

  _setAttributeOnSelections(selector, attributeName, attributeValue, ace);
}

exports.saveReplyOnCommentText = function(replyId, commentId, ace) {
  var selector = '.' + commentId;
  var attributeName = 'comment-reply-' + replyId;
  var attributeValue = replyId;

  ace.callWithAce(function(aceTop) {
    _setAttributeOnSelections(selector, attributeName, attributeValue, aceTop);
  }, 'saveCommentReply', true);
}

exports.deleteReply = function(replyId, commentId, ace) {
  ace.callWithAce(function(aceTop) {
    _deleteReplyOnCurrentAceEvent(replyId, commentId, aceTop);
  }, 'deleteCommentReply', true);
}

var _deleteReplyOnCurrentAceEvent = function(replyId, commentId, ace) {
  var selector = '.' + replyId;
  var attributeName = 'comment-reply-' + replyId;
  var attributeValue = false;
  _setAttributeOnSelections(selector, attributeName, attributeValue, ace);
}

var _setAttributeOnSelections = function(selector, attributeName, attributeValue, ace) {
  var repArr = ace.ace_getRepFromSelector(selector);

  // repArr is an array of reps.. I will need to iterate over each to do something meaningful..
  _(repArr).each(function(rep) {
    ace.ace_performSelectionChange(rep[0], rep[1], true);
    ace.ace_setAttributeOnSelection(attributeName, attributeValue);
  });
}
