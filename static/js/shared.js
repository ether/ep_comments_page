var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

exports.collectContentPre = function(hook, context){
  var commentReplies = (context.cls || '').match(/(?:^| )(cr-[A-Za-z0-9]*)/g) || [];
  for (var i = 0; i < commentReplies.length; i++) {
    var replyId = commentReplies[i].trim();
    context.cc.doAttrib(context.state, 'comment-reply-' + replyId + '::' + replyId);
  }

  var comment = /(?:^| )(c-[A-Za-z0-9]*)/.exec(context.cls);
  if(comment && comment[1]){
    context.cc.doAttrib(context.state, 'comment::' + comment[1]);
  }
};

exports.generateCommentId = function(){
  return 'c-' + randomString(16);
}

exports.generateReplyId = function(){
  return 'cr-' + randomString(16);
}
