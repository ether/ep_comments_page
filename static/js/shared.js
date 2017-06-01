var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

var collectContentPre = function(hook, context){
  var comment = /(?:^| )(c-[A-Za-z0-9]*)/.exec(context.cls);
  var fakeComment = /(?:^| )(fakecomment-[A-Za-z0-9]*)/.exec(context.cls);

  if(comment && comment[1]){
    context.cc.doAttrib(context.state, "comment::" + comment[1]);
  }

  // a fake comment is a comment copied from this or another pad. To avoid conflicts
  // with existing comments, a fake commentId is used, so then we generate a new one
  // when the comment is saved
  if(fakeComment){
    var mapFakeComments = pad.plugins.ep_comments_page.getMapfakeComments();
    var fakeCommentId = fakeComment[1];
    var commentId = mapFakeComments[fakeCommentId];
    context.cc.doAttrib(context.state, "comment::" + commentId);
  }
};

exports.collectContentPre = collectContentPre;


exports.generateCommentId = function(){
   var commentId = "c-" + randomString(16);
   return commentId;
}
