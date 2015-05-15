var collectContentPre = function(hook, context){
  var comment = /(?:^| )(c-[A-Za-z0-9]*)/.exec(context.cls);
  if(comment && comment[1]){
    context.cc.doAttrib(context.state, "comment::" + comment[1]);
  }
};

exports.collectContentPre = collectContentPre;
