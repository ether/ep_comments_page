const _ = require('ep_etherpad-lite/static/js/underscore');
const eejs = require('ep_etherpad-lite/node/eejs/');
const rehype = require('ep_etherpad-lite/node_modules/rehype');
const cheerio = require('ep_etherpad-lite/node_modules/cheerio');

// Add the props to be supported in export
exports.exportHtmlAdditionalTagsWithData = async (hookName, pad) => {
  return findAllCommentUsedOn(pad).map((name) => ['comment', name]);
};

// Iterate over pad attributes to find only the comment ones
function findAllCommentUsedOn(pad) {
  const commentsUsed = [];
  pad.pool.eachAttrib((key, value) => { if (key === 'comment') commentsUsed.push(value); });
  console.warn(commentsUsed);
  return commentsUsed;
}

exports.getLineHTMLForExport = async (hookName, context) => {

  var $ = cheerio.load(context.lineContent); // gives us a jquery selector for the html! :)

  // include links for each comment which we will add content later.
  $("span").each(function(){
    let commentId = $(this).data("comment");
    if(!commentId) return; // not a comment.  please optimize me in selector
    $(this).append("<sup><a href='#"+commentId+"'>*</a></sup>");
    context.lineContent = $.html();

    // Replace data-comment="foo" with class="comment foo".
    context.lineContent = context.lineContent.replace(/data-comment=["|'](c-[0-9a-zA-Z]+)["|']/gi, 'class="comment $1"');
  });

};
