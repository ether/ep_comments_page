exports.deleteComment = function(commentId, ace, socket, callback) {
  _deleteCommentFromText(commentId, ace);
  _deleteCommentFromDatabase(commentId, socket, callback);
}

var _deleteCommentFromText = function(commentId, ace) {
  var selector = '.' + commentId;
  ace.callWithAce(function(aceTop) {
    var repArr = aceTop.ace_getRepFromSelector(selector);

    // rep is an array of reps.. I will need to iterate over each to do something meaningful..
    $.each(repArr, function(index, rep) {
      aceTop.ace_performSelectionChange(rep[0], rep[1], true);
      aceTop.ace_setAttributeOnSelection('comment', 'comment-deleted');
      // Note that this is the correct way of doing it, instead of there being
      // a commentId we now flag it as "comment-deleted"
    });
  },'deleteCommentedSelection', true);
}

var _deleteCommentFromDatabase = function(commentId, socket, callback) {
  var data = {
    padId: clientVars.padId,
    commentId: commentId,
  };

  socket.emit('deleteComment', data, function(commentId) {
    callback();
  });
}

exports.deleteReply = function(replyId, commentId, socket, callback) {
  _deleteReplyFromDatabase(replyId, commentId, socket, callback);
}

var _deleteReplyFromDatabase = function(replyId, commentId, socket, callback) {
  var data = {
    padId: clientVars.padId,
    replyId: replyId,
    commentId: commentId,
  };

  socket.emit('deleteCommentReply', data, function(replyId, commentId) {
    callback();
  });
}
