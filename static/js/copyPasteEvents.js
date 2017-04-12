var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var _ = require('ep_etherpad-lite/static/js/underscore');

exports.addTextOnClipboard = function(e, ace, padInner, removeSelection, comments, replies){
  var commentIdOnSelection;
  var hasCommentOnSelection;
  ace.callWithAce(function(ace) {
    commentIdOnSelection = ace.ace_getCommentIdOnSelection();
    hasCommentOnSelection = ace.ace_hasCommentOnSelection();
  });

  if(hasCommentOnSelection){
    var commentsData;
    var range = padInner.contents()[0].getSelection().getRangeAt(0);
    var rawHtml = createHiddenDiv(range);
    var html = rawHtml;
    var onlyTextIsSelected = selectionHasOnlyText(rawHtml);
    // when the range selection is fully inside a tag, 'rawHtml' will have no HTML tag, so we have to
    // build it. Ex: if we have '<span>ab<b>cdef</b>gh</span>" and user selects 'de', the value of
    //'rawHtml' will be 'de', not '<b>de</b>'. As it is not possible to have two comments in the same text
    // commentIdOnSelection is the commentId in this partial selection
    if (onlyTextIsSelected) {
      var textSelected = rawHtml[0].outerText;
      html = buildHtmlToCopy(textSelected, range, commentIdOnSelection);
    }
    var commentIds = getCommentIds(html);
    commentsData = buildCommentsData(html, comments);
    var htmlToCopy = replaceCommentIdsWithFakeIds(commentsData, html)
    commentsData = JSON.stringify(commentsData);
    var replyData = getReplyData(replies, commentIds);
    replyData = JSON.stringify(replyData);
    e.originalEvent.clipboardData.setData('text/objectReply', replyData);
    e.originalEvent.clipboardData.setData('text/objectComment', commentsData);
    // here we override the default copy behavior
    e.originalEvent.clipboardData.setData('text/html', htmlToCopy);
    e.preventDefault();

    // if it is a cut event we have to remove the selection
    if(removeSelection){
      padInner.contents()[0].execCommand("delete");
    }
  }
};

var getReplyData = function(replies, commentIds){
  var replyData = {};
  _.each(commentIds, function(commentId){
    replyData =  _.extend(getRepliesFromCommentId(replies, commentId), replyData);
  });
  return replyData;
};

var getRepliesFromCommentId = function(replies, commentId){
  var repliesFromCommentID = {};
  _.each(replies, function(reply, replyId){
    if(reply.commentId === commentId){
      repliesFromCommentID[replyId] = reply;
    }
  });
  return repliesFromCommentID;
};

var mapCommentIdToFakeId = function(commentsData){
  var commmentsDataInverted = {};
  _.each(commentsData, function(comment, fakeCommentId){
    var commentId = comment.data.originalCommentId;
    commmentsDataInverted[commentId] = fakeCommentId;
  });
  return commmentsDataInverted;
};

var replaceCommentIdsWithFakeIds = function(commentsData, html){
  var commmentsDataInverted =  mapCommentIdToFakeId(commentsData);
  _.each(commmentsDataInverted, function(fakeCommentId, commentId){
    $(html).find("." + commentId).removeClass(commentId).addClass(fakeCommentId);
  });
  var htmlWithFakeCommentIds = getHtml(html);
  return htmlWithFakeCommentIds;
};

var buildCommentsData = function(html, comments){
  var commentsData = {};
  var originalCommentIds = getCommentIds(html);
  if(originalCommentIds.length){
    _.each(originalCommentIds, function(originalCommentId){
      var fakeCommentId = generateFakeCommentId();
      var comment = comments[originalCommentId];
      comment.data.originalCommentId = originalCommentId;
      commentsData[fakeCommentId] = comment;
    });
  }
  return commentsData;
};

var generateFakeCommentId = function(){
  var commentId = "fakecomment-" + randomString(16);
  return commentId;
};

var getCommentIds = function(html){
  var commentId = null;
  var allSpans = $(html).find("span");
  var commentIds = [];
  _.each(allSpans, function(span){
    var cls = $(span).attr('class');
    var classCommentId = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
    commentId = (classCommentId) ? classCommentId[1] : false;
    if(commentId){
      commentIds.push(commentId);
    }
  });
  var uniqueCommentIds = _.uniq(commentIds);
  return uniqueCommentIds;
 };

var createHiddenDiv = function(range){
  var content = range.cloneContents();
  var div = document.createElement("div");
  var hiddenDiv = $(div).html(content);
  return hiddenDiv;
};

var getHtml = function(hiddenDiv){
  return $(hiddenDiv).html();
};

var selectionHasOnlyText = function(rawHtml){
  var html = getHtml(rawHtml);
  var htmlDecoded = htmlDecode(html);
  var text = $(rawHtml).text();
  return htmlDecoded === text;
};

var buildHtmlToCopy = function(html, range, commentId) {
  var htmlOfParentNode = range.commonAncestorContainer.parentNode;
  var tags = getTagsInSelection(htmlOfParentNode);
  // this case happens when we got a selection with one or more styling (bold, italic, underline, strikethrough)
  // applied in all selection in the same range. For example, <b><i><u>text</u></i></b>
  if(tags){
    html = buildOpenTags(tags) + html + buildCloseTags(tags);
  }
  var htmlToCopy = $.parseHTML("<div><span class='comment " + commentId + "'>" + html + "</span></br></div>");
  return htmlToCopy;
};

var buildOpenTags = function(tags){
  var openTags = "";
  tags.forEach(function(tag){
    openTags += "<"+tag+">";
  });
  return openTags;
};

var buildCloseTags = function(tags){
  var closeTags = "";
  var tags = tags.reverse();
  tags.forEach(function(tag){
    closeTags += "</"+tag+">";
  });
  return closeTags;
};

var getTagsInSelection = function(htmlObject){
  var tags = [];
  var tag;
  while($(htmlObject)[0].localName !== "span"){
    var html = $(htmlObject).prop('outerHTML');
    var stylingTagRegex = /<(b|i|u|s)>/.exec(html);
    tag = stylingTagRegex ? stylingTagRegex[1] : "";
    tags.push(tag);
    htmlObject = $(htmlObject).parent();
  }
  return tags;
};

exports.saveCommentsAndReplies = function(e){
  var comments = e.originalEvent.clipboardData.getData('text/objectComment');
  var replies = e.originalEvent.clipboardData.getData('text/objectReply');

  if(comments && replies) {
    comments = JSON.parse(comments);
    replies = JSON.parse(replies);
    saveComment(comments, function(){
      saveReplies(replies);
    });
  }
};

var saveComment = function(comments, callback){
  _.each(comments, function(comment, fakeCommentId){
    var commentData = buildCommentData(comment, fakeCommentId);
    pad.plugins.ep_comments_page.saveCommentWithoutSelection(commentData);
  });
  callback();
};

var saveReplies = function(replies){
  var repliesToSave = {};
  var padId = clientVars.padId;
  var mapOriginalCommentsId = pad.plugins.ep_comments_page.mapOriginalCommentsId;
  _.each(replies, function(reply, replyId){
    var originalCommentId = reply.commentId;
    // as the comment copied has got a new commentId, we set this id in the reply as well
    reply.commentId = mapOriginalCommentsId[originalCommentId];
    repliesToSave[replyId] = reply;
  });
  pad.plugins.ep_comments_page.saveCommentReplies(padId, repliesToSave);
};

var buildCommentData = function(comment, fakeCommentId){
  var commentData = {};
  commentData.comment = {};
  commentData.padId = clientVars.padId;
  commentData.comment = comment.data;
  commentData.comment.commentId = fakeCommentId;
  return commentData;
};
// copied from https://css-tricks.com/snippets/javascript/unescape-html-in-js/
var htmlDecode = function(input) {
  var e = document.createElement('div');
  e.innerHTML = input;
  return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
};

exports.getCommentIdOnSelection = function() {
  var attributeManager = this.documentAttributeManager;
  var rep = this.rep;
  var commentId = _.object(attributeManager.getAttributesOnPosition(rep.selStart[0], rep.selStart[1])).comment;
  return commentId;
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
  var line = firstLineOfSelection;
  var multipleLineSelectionHasComment = false;
  for (line; line <= lastLineOfSelection; line++) {
    var firstColumn = getFirstColumnOfSelection(line, rep, firstLineOfSelection);
    var lastColumn = getLastColumnOfSelection(line, rep, lastLineOfSelection);
    var hasComment = hasCommentOnLine(line, firstColumn, lastColumn, attributeManager)
    if (hasComment){
      multipleLineSelectionHasComment = true;
    }
  }
  return multipleLineSelectionHasComment;
};

var getFirstColumnOfSelection = function(line, rep, firstLineOfSelection){
  return line !== firstLineOfSelection ? 0 : rep.selStart[1];
};

var getLastColumnOfSelection = function(line, rep, lastLineOfSelection){
  var lineLength = getLength(line, rep);
  var positionOfLastCharacterSelected = rep.selEnd[1] - 1;
  return line !== lastLineOfSelection ? lineLength : positionOfLastCharacterSelected;
};

var hasCommentOnLine = function(lineNumber, firstColumn, lastColumn, attributeManager){
  var column = firstColumn;
  var hasComment = false;
  for (column; column <= lastColumn; column++) {
   var commentId = _.object(attributeManager.getAttributesOnPosition(lineNumber, column)).comment;
   if (commentId !== undefined){
    hasComment = true;
   }
  }
  return hasComment;
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
