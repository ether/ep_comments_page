var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var _ = require('ep_etherpad-lite/static/js/underscore');
var shared = require('./shared');
var utils = require('./utils');

exports.addTextOnClipboard = function(e, ace, removeSelection, comments) {
  var hasCommentOnSelection;
  ace.callWithAce(function(ace) {
    hasCommentOnSelection = ace.ace_hasCommentOnSelection();
  });

  if(hasCommentOnSelection){
    var range = utils.getPadInner()[0].getSelection().getRangeAt(0);
    var $copiedHtml = createHiddenDiv(range);
    var onlyTextIsSelected = selectionHasOnlyText($copiedHtml);

    // when the range selection is fully inside a tag, '$copiedHtml' will have no HTML tag, so we have to
    // build it. Ex: if we have '<span>ab<b>cdef</b>gh</span>" and user selects 'de', the value of
    // '$copiedHtml' will be 'de', not '<b>de</b>'
    if (onlyTextIsSelected) {
      var textSelected = $copiedHtml[0].textContent;
      $copiedHtml = buildHtmlToCopyWhenSelectionHasOnlyText(textSelected, range);
    }

    var replies = utils.getRepliesIndexedByReplyId(comments);
    var commentsData = buildCommentsDataWithNewCommentIds($copiedHtml, comments);
    var replyData = buildRepliesDataWithNewCommentIds($copiedHtml, replies);
    var commentsJSON = JSON.stringify(commentsData);
    var replyJSON = JSON.stringify(replyData);
    e.originalEvent.clipboardData.setData('text/objectComment', commentsJSON);
    e.originalEvent.clipboardData.setData('text/objectReply', replyJSON);

    // here we override the default copy behavior
    e.originalEvent.clipboardData.setData('text/html', $copiedHtml.html());
    e.preventDefault();

    // if it is a cut event we have to remove the selection
    if(removeSelection){
      utils.getPadInner()[0].execCommand('delete');
    }
  }
};

var buildCommentsDataWithNewCommentIds = function($copiedHtml, comments){
  var commentsData = {};
  var originalCommentIds = getCommentIds($copiedHtml);

  _.each(originalCommentIds, function(originalCommentId){
    var newCommentId = shared.generateCommentId();

    // replace comment id on comment db data
    var comment = Object.assign({}, comments[originalCommentId]);
    comment.commentId = newCommentId;
    commentsData[newCommentId] = comment;

    // replace comment id on reply db data
    _.each(comment.replies, function(reply) {
      reply.commentId = newCommentId;
    });

    // replace comment id on pad content
    $copiedHtml.find('.' + originalCommentId).removeClass(originalCommentId).addClass(newCommentId);
  });

  return commentsData;
};

var buildRepliesDataWithNewCommentIds = function($copiedHtml, replies){
  var repliesData = {};
  var originalReplyIds = getReplyIds($copiedHtml);

  _.each(originalReplyIds, function(originalReplyId){
    var newReplyId = shared.generateReplyId();

    // replace comment id on comment db data
    var reply = Object.assign({}, replies[originalReplyId]);
    reply.replyId = newReplyId;
    repliesData[newReplyId] = reply;

    // replace reply id on pad content
    $copiedHtml.find('.' + originalReplyId).removeClass(originalReplyId).addClass(newReplyId);
  });

  return repliesData;
};

var getCommentIds = function($copiedHtml){
  var $allComments = $copiedHtml.find('span.comment');
  var commentIds = $allComments.map(function(){
    var cls = $(this).attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    var commentId = (classCommentId) ? classCommentId[1] : false;
    return commentId;
  });
  commentIds = _.compact(commentIds);
  commentIds = _.uniq(commentIds);
  return commentIds;
};

var getReplyIds = function($copiedHtml){
  var $allReplies = $copiedHtml.find('span.comment-reply');
  var replyIds = $allReplies.map(function(){
    var cls = $(this).attr('class');
    var classReplyId = /(?:^| )(cr-[A-Za-z0-9]*)/.exec(cls);
    var replyId = (classReplyId) ? classReplyId[1] : false;
    return replyId;
  });
  replyIds = _.compact(replyIds);
  replyIds = _.uniq(replyIds);
  return replyIds;
};

var createHiddenDiv = function(range){
  var content = range.cloneContents();
  var div = document.createElement("div");
  var hiddenDiv = $(div).html(content);
  return hiddenDiv;
};

var selectionHasOnlyText = function($copiedHtml){
  var html = $copiedHtml.html();
  var htmlDecoded = htmlDecode(html);
  var text = $copiedHtml.text();
  return htmlDecoded === text;
};

// copied from https://css-tricks.com/snippets/javascript/unescape-html-in-js/
var htmlDecode = function(input) {
  var e = document.createElement('div');
  e.innerHTML = input;
  return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
};

var buildHtmlToCopyWhenSelectionHasOnlyText = function(text, range) {
  var htmlTemplate = getHtmlTemplateWithAllTagsOfSelectedContent(range);
  return splitSelectedTextIntoTwoSpans(text, htmlTemplate);
};

var getHtmlTemplateWithAllTagsOfSelectedContent = function(range) {
  // '.addBack': selected text might be a direct child of the comment span
  var $commentSpanWithSelectedContent = $(range.commonAncestorContainer).parentsUntil('.comment').addBack().first().parent();
  return $commentSpanWithSelectedContent.get(0).outerHTML;
}

// FIXME - Allow to copy a comment when user copies only one char
// This is a hack to preserve the comment classes when user pastes a comment. When user pastes a span like this
// <span class='comment c-124'>thing</span>, chrome removes the classes and keeps only the style of the class. With comments
// chrome keeps the background-color. To avoid this we create two spans. The first one, <span class='comment c-124'>thi</span>
// has the text until the last but one character and second one with the last character <span class='comment c-124'>g</span>.
// Etherpad does a good job joining the two spans into one after the paste is triggered.
var splitSelectedTextIntoTwoSpans = function(text, commentSpanTemplate) {
  var $firstSpan = $(commentSpanTemplate);
  var $secondSpan = $(commentSpanTemplate);

  // '.find('*').last()': need to set text on the deepest tag
  $firstSpan.find('*').last().text(text.slice(0, -1)); // text until before last char
  $secondSpan.find('*').last().text(text.slice(-1)); // last char

  return $('<span>' + $firstSpan.get(0).outerHTML + $secondSpan.get(0).outerHTML + '</span>');
}

exports.saveCommentsAndReplies = function(e){
  var comments = e.originalEvent.clipboardData.getData('text/objectComment');
  var replies = e.originalEvent.clipboardData.getData('text/objectReply');

  if(comments && replies) {
    pad.plugins.ep_comments_page.saveCommentWithoutSelection(JSON.parse(comments));
    pad.plugins.ep_comments_page.saveRepliesWithoutSelection(JSON.parse(replies));
  }
};

exports.hasCommentOnSelection = function() {
  var hasComment;
  var attributeManager = this.documentAttributeManager;
  var rep = this.rep;
  var firstLineOfSelection = rep.selStart[0];
  var firstColumn = rep.selStart[1];
  var lastColumn = rep.selEnd[1];
  var lastLineOfSelection = rep.selEnd[0];
  var selectionOfMultipleLine = hasMultipleLineSelected(firstLineOfSelection, lastLineOfSelection);

  if(selectionOfMultipleLine){
    hasComment = hasCommentOnMultipleLineSelection(firstLineOfSelection,lastLineOfSelection, rep, attributeManager);
  }else{
    hasComment = hasCommentOnLine(firstLineOfSelection, firstColumn, lastColumn, attributeManager)
  }
  return hasComment;
};

var hasCommentOnMultipleLineSelection = function(firstLineOfSelection, lastLineOfSelection, rep, attributeManager){
  var foundLineWithComment = false;
  for (var line = firstLineOfSelection; line <= lastLineOfSelection && !foundLineWithComment; line++) {
    var firstColumn = getFirstColumnOfSelection(line, rep, firstLineOfSelection);
    var lastColumn = getLastColumnOfSelection(line, rep, lastLineOfSelection);
    var hasComment = hasCommentOnLine(line, firstColumn, lastColumn, attributeManager);
    if (hasComment){
      foundLineWithComment = true;
    }
  }
  return foundLineWithComment;
}

var getFirstColumnOfSelection = function(line, rep, firstLineOfSelection){
  return line !== firstLineOfSelection ? 0 : rep.selStart[1];
};

var getLastColumnOfSelection = function(line, rep, lastLineOfSelection){
  var lastColumnOfSelection;
  if (line !== lastLineOfSelection) {
    lastColumnOfSelection = getLength(line, rep); // length of line
  }else{
    lastColumnOfSelection = rep.selEnd[1] - 1; //position of last character selected
  }
  return lastColumnOfSelection;
};

var hasCommentOnLine = function(lineNumber, firstColumn, lastColumn, attributeManager){
  var foundCommentOnLine = false;
  for (var column = firstColumn; column <= lastColumn && !foundCommentOnLine; column++) {
    var commentId = _.object(attributeManager.getAttributesOnPosition(lineNumber, column)).comment;
    if (commentId !== undefined){
      foundCommentOnLine = true;
    }
  }
  return foundCommentOnLine;
};

var hasMultipleLineSelected = function(firstLineOfSelection, lastLineOfSelection){
  return  firstLineOfSelection !== lastLineOfSelection;
};

var getLength = function(line, rep) {
  var nextLine = line + 1;
  var startLineOffset = rep.lines.offsetOfIndex(line);
  var endLineOffset   = rep.lines.offsetOfIndex(nextLine);

  //lineLength without \n
  var lineLength = endLineOffset - startLineOffset - 1;

  return lineLength;
};
