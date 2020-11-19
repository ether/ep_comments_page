'use strict';

const cheerio = require('ep_etherpad-lite/node_modules/cheerio');
const commentManager = require('./commentManager');

// Add the props to be supported in export
exports.exportHtmlAdditionalTagsWithData =
  async (hookName, pad) => findAllCommentUsedOn(pad).map((name) => ['comment', name]);

// Iterate over pad attributes to find only the comment ones
const findAllCommentUsedOn = (pad) => {
  const commentsUsed = [];
  pad.pool.eachAttrib((key, value) => { if (key === 'comment') commentsUsed.push(value); });
  return commentsUsed;
};

exports.getLineHTMLForExport = async (hookName, context) => {
  // I'm not sure how optimal this is - it will do a database lookup for each line..
  const comments = await commentManager.getComments(context.padId);

  const $ = cheerio.load(context.lineContent); // gives us a jquery selector for the html! :)

  // include links for each comment which we will add content later.
  $('span').each(function () {
    const commentId = $(this).data('comment');
    if (!commentId) return; // not a comment.  please optimize me in selector
    if (!comments.comments[commentId]) return; // if this comment has been deleted..
    $(this).append(`<sup><a href='#${commentId}'>*</a></sup>`);
    context.lineContent = $.html();

    // Replace data-comment="foo" with class="comment foo".
    context.lineContent = context.lineContent.replace(
        /data-comment=["|'](c-[0-9a-zA-Z]+)["|']/gi, 'class="comment $1"');
  });
};

exports.exportHTMLAdditionalContent = async (hookName, {padId}) => {
  let comments = await commentManager.getComments(padId);
  if (!comments.comments) return;
  comments = comments.comments;
  let html = '<div id=comments>';

  for (const [commentId, comment] of Object.entries(comments)) {
    // prolly should escape text here?
    html += `<p role="comment" class="comment" id="${commentId}">* ${comment.text}</p>`;
  }

  html += '</div>';

  // adds additional HTML to the body, we get this HTML from the database of comments:padId
  return html;
};
