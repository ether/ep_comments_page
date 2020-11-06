const _ = require('ep_etherpad-lite/static/js/underscore');
const eejs = require('ep_etherpad-lite/node/eejs/');

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
  // Replace data-comment="foo" with class="comment foo".
  context.lineContent = context.lineContent.replace(/data-comment=["|'](c-[0-9a-zA-Z]+)["|']/gi,
                                                    'class="comment $1"');
};
