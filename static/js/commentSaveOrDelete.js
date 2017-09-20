exports.saveCommentOnSelectedText = function(commentId, rep, ace) {
  ace.callWithAce(function(aceTop){
    aceTop.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
    aceTop.ace_setAttributeOnSelection('comment', commentId);
  },'saveComment', true);
}

exports.deleteComment = function(commentId, ace) {
  var selector = '.' + commentId;
  var attributeName = 'comment';
  // Note that this is the correct way of doing it, instead of there being
  // a commentId we now flag it as "comment-deleted"
  var attributeValue = 'comment-deleted';
  var aceEventName = 'deleteCommentedSelection';
  _setAttributeOnSelections(selector, attributeName, attributeValue, aceEventName, ace);
}

exports.saveReplyOnCommentText = function(replyId, commentId, ace) {
  var selector = '.' + commentId;
  var attributeName = 'comment-reply-' + replyId;
  var attributeValue = replyId;
  var aceEventName = 'saveCommentReply';
  _setAttributeOnSelections(selector, attributeName, attributeValue, aceEventName, ace);
}

exports.deleteReply = function(replyId, commentId, ace) {
  var selector = '.' + commentId;
  var attributeName = 'comment-reply-' + replyId;
  var attributeValue = false;
  var aceEventName = 'deleteCommentReply';
  _setAttributeOnSelections(selector, attributeName, attributeValue, aceEventName, ace);
}

var _setAttributeOnSelections = function(selector, attributeName, attributeValue, aceEventName, ace) {
  ace.callWithAce(function(aceTop) {
    var repArr = aceTop.ace_getRepFromSelector(selector);

    // rep is an array of reps.. I will need to iterate over each to do something meaningful..
    $.each(repArr, function(index, rep) {
      aceTop.ace_performSelectionChange(rep[0], rep[1], true);
      aceTop.ace_setAttributeOnSelection(attributeName, attributeValue);
    });
  }, aceEventName, true);
}
