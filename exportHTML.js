const _ = require('ep_etherpad-lite/static/js/underscore');
const eejs = require('ep_etherpad-lite/node/eejs/');
const cheerio = require('ep_etherpad-lite/node_modules/cheerio');
const commentManager = require('./commentManager');

// Add the props to be supported in export
exports.exportHtmlAdditionalTagsWithData = async (hookName, pad) => {
  return findAllCommentUsedOn(pad).map((name) => ['comment', name]);
};

// Iterate over pad attributes to find only the comment ones
function findAllCommentUsedOn(pad) {
  const commentsUsed = [];
  pad.pool.eachAttrib((key, value) => { if (key === 'comment') commentsUsed.push(value); });
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

exports.exportHTMLAdditionalContent = async (hookName, context) => {
  let padId = context;
  let comments = await commentManager.getComments(padId)
  if(!comments.comments) return;
  comments = comments.comments;
  let html = "<div id=comments>";

  for (const commentId in comments){
    // prolly should escape text here?
    html += '<p role="comment" class="comment" id="' + commentId + '">* '+comments[commentId].text+'</p>';
  }

  html += '</div>'

  // adds additional HTML to the body, we get this HTML from the database of comments:padId
  return html;

}
