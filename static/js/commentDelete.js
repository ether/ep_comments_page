exports.deleteComment = function(commentId, ace) {
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
