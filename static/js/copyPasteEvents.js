exports.addTextOnClipboard = function(e, ace, padInner){
  var commentIdOnSelection;
  ace.callWithAce(function(ace) {
    commentIdOnSelection = ace.ace_getCommentIdOnSelection();
  });
  // we check if all the selection is in the same comment, if so, we override the copy behavior
  if (commentIdOnSelection) {
    var range = padInner.contents()[0].getSelection().getRangeAt(0);
    var hiddenDiv = createHiddenDiv(range);
    var html = getHtml(hiddenDiv);
    // when the range selection is fully inside a tag, 'html' will have no HTML tag, so we have to
    // build it. Ex: if we have '<span>ab<b>cdef</b>gh</span>" and user selects 'de', the value of
    //'html' will be 'de', not '<b>de</b>'
    if (selectionHasOnlyText(html, hiddenDiv)) {
      html = buildHtmlToCopy(html, range);
      e.originalEvent.clipboardData.setData('text/copyCommentId', commentIdOnSelection);
    }
    // here we override the default copy behavior
    e.originalEvent.clipboardData.setData('text/html', html);
    e.preventDefault();
  }
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

var selectionHasOnlyText = function(html, hiddenDiv){
  var htmlDecoded = htmlDecode(html);
  var text = $(hiddenDiv).text();
  return htmlDecoded === text;
};

var buildHtmlToCopy = function(html, range) {
  var htmlOfParentNode = range.commonAncestorContainer.parentNode;
  var tags = getTagsInSelection(htmlOfParentNode);
  // this case happens when we got a selection with one or more styling (bold, italic, underline, strikethrough)
  // applied in all selection in the same range. For example, <b><i><u>text</u></i></b>
  if(tags){
    html = buildOpenTags(tags) + html + buildCloseTags(tags);
  }
  var htmlToCopy = "<span class='comment'>" + html + "</span>";
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
  while($(htmlObject)[0].localName != "span"){
    var html = $(htmlObject).prop('outerHTML');
    var stylingTagRegex = /<(b|i|u|s)>/.exec(html);
    tag = stylingTagRegex ? stylingTagRegex[1] : "";
    tags.push(tag);
    htmlObject = $(htmlObject).parent();
  }
  return tags;
}

exports.addCommentClasses = function(e){
  var commentId = e.originalEvent.clipboardData.getData('text/copyCommentId');
  var target = e.target;
  if (commentId) {
    // we need to wait the paste process finishes completely, otherwise we will not have the target to add the necessary classes
    setTimeout(function() {
      addCommentClassesOnline(target, commentId);
    }, 0);
  }
};

var addCommentClassesOnline = function (target, commentId) {
  var pastingOnEmptyLine = isEmptyLine(target);
  var targetElement;
  if (pastingOnEmptyLine){
    targetElement = $(target).parent();
  }else{
    targetElement = getTargetOnLineWithContent();
  }
  targetElement.addClass(commentId).addClass('comment');
};


var getTargetOnLineWithContent = function() {
  var padOuter = $('iframe[name="ace_outer"]').contents();
  var padInner = padOuter.find('iframe[name="ace_inner"]').contents();
  var target = padInner.find("span[style='background-color: rgb(255, 250, 205);']");
  return target;
};

// an empty line has only a <br>
var isEmptyLine = function(target) {
  return $(target).is("br");
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
  var selStartAttrib = _.object(attributeManager.getAttributesOnPosition(rep.selStart[0], rep.selStart[1])).comment;
  var selEndAttrib = _.object(attributeManager.getAttributesOnPosition(rep.selEnd[0], rep.selEnd[1] - 1)).comment;
  return selStartAttrib === selEndAttrib ? selStartAttrib : null;
};


