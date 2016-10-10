var collectContentPre = function(hook, context){
  var comment = /(?:^| )(c-[A-Za-z0-9]*)/.exec(context.cls);
  var fakeComment = /(?:^| )(fakecomment-[A-Za-z0-9]*)/.exec(context.cls);

  if(comment && comment[1]){
    context.cc.doAttrib(context.state, "comment::" + comment[1]);
  }
  // a fake comment, it is a comment copied. To avoid conflicts, it is used a fake commentId, so then we generate a new one when
  // it saves the comment.
  if(fakeComment){
    var mapFakeComments = pad.plugins.ep_comments_page.getMapfakeComments();
    var fakeCommentId = fakeComment[1];
    var commentId = mapFakeComments[fakeCommentId];
    context.cc.doAttrib(context.state, "comment::" + commentId);
  }
};

exports.collectContentPre = collectContentPre;
