'use strict';

const $ = require('cheerio').load('');
const commentManager = require('./commentManager');
const settings = require('ep_etherpad-lite/node/utils/Settings');

// Iterate over pad attributes to find only the comment ones
const findAllCommentUsedOn = (pad) => {
  const commentsUsed = [];
  pad.pool.eachAttrib((key, value) => { if (key === 'comment') commentsUsed.push(value); });
  return commentsUsed;
};

// Add the props to be supported in export
exports.exportHtmlAdditionalTagsWithData =
  async (hookName, pad) => findAllCommentUsedOn(pad).map((name) => ['comment', name]);

// Footnote-style markers for comments. Numbering them (rather than a bare "*")
// keeps the inline reference correlatable with the comment list once the export
// is flattened to a rich format (odt/doc/pdf) where the `#id` anchor is lost.
// Numbering follows the comments map order so both hooks agree (#190).
// Build a commentId -> "[n]" lookup once so per-span/per-comment marker
// resolution is O(1) instead of an indexOf scan per call (avoids O(n^2) over
// many comments, #190).
const buildMarkerMap = (commentIds) => {
  const markers = new Map();
  commentIds.forEach((id, i) => markers.set(id, `[${i + 1}]`));
  return markers;
};

exports.getLineHTMLForExport = async (hookName, context) => {
  if (settings.ep_comments_page && settings.ep_comments_page.exportHtml === false) return;

  // I'm not sure how optimal this is - it will do a database lookup for each line..
  const {comments} = await commentManager.getComments(context.padId);
  if (!comments) return;
  const commentIds = Object.keys(comments);
  const markers = buildMarkerMap(commentIds);
  let hasPlugin = false;
  // Load the HTML into a throwaway div instead of calling $.load() to avoid
  // https://github.com/cheeriojs/cheerio/issues/1031
  const content = $('<div>').html(context.lineContent);
  // include links for each comment which we will add content later.
  content.find('span').each(function () {
    const span = $(this);
    const commentId = span.data('comment');
    if (!commentId) return; // not a comment.  please optimize me in selector
    if (!comments[commentId]) return; // if this comment has been deleted..
    hasPlugin = true;
    span.append(
        $('<sup>').append(
            $('<a>').attr('href', `#${commentId}`).text(markers.get(commentId))));
    // Replace data-comment="foo" with class="comment foo".
    if (/^c-[0-9a-zA-Z]+$/.test(commentId)) {
      span.removeAttr('data-comment').addClass('comment').addClass(commentId);
    }
  });
  if (hasPlugin) context.lineContent = content.html();
};

exports.exportHTMLAdditionalContent = async (hookName, {padId}) => {
  if (settings.ep_comments_page && settings.ep_comments_page.exportHtml === false) return;
  const {comments} = await commentManager.getComments(padId);
  if (!comments || !Object.keys(comments).length) return;
  const commentIds = Object.keys(comments);
  const markers = buildMarkerMap(commentIds);
  const div = $('<div>').attr('id', 'comments');
  // A heading so the block is recognisable once flattened into odt/doc/pdf,
  // where the surrounding markup is gone.
  div.append($('<h2>').text('Comments'));
  for (const [commentId, comment] of Object.entries(comments)) {
    // Build "[n] author: text" with an optional suggested-change clause so the
    // full comment survives into rich-format exports (#190). Assemble via text
    // nodes so author/comment content can't inject markup.
    const p = $('<p>')
        .attr('role', 'comment')
        .addClass('comment')
        .attr('id', commentId);
    const marker = markers.get(commentId);
    const author = (comment.name && String(comment.name).trim()) || 'Anonymous';
    let line = `${marker} ${author}: ${comment.text || ''}`;
    if (comment.changeTo) line += ` (suggested change to: "${comment.changeTo}")`;
    p.text(line);
    div.append(p);
  }
  // adds additional HTML to the body, we get this HTML from the database of comments:padId
  return $.html(div);
};
