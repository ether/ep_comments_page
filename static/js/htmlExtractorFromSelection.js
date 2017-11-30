var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var utils = require('./utils');

exports.getHtmlOfSelectedContent = function() {
  var range = utils.getPadInner().get(0).getSelection().getRangeAt(0);
  var $copiedHtml = _createHiddenDiv(range);
  var onlyTextIsSelected = _selectionHasOnlyText($copiedHtml);

  // when the range selection is fully inside a tag, '$copiedHtml' will have no HTML tag, so we have to
  // build it. Ex: if we have '<span>ab<b>cdef</b>gh</span>" and user selects 'de', the value of
  // '$copiedHtml' will be 'de', not '<b>de</b>'
  if (onlyTextIsSelected) {
    $copiedHtml = _buildHtmlWithOuterTags($copiedHtml, range);
  }

  return $copiedHtml;
}

var _createHiddenDiv = function(range) {
  var content = range.cloneContents();
  var div = document.createElement('div');
  var hiddenDiv = $(div).html(content);
  return hiddenDiv;
}

var _selectionHasOnlyText = function($copiedHtml) {
  var html = $copiedHtml.html();
  var htmlDecoded = _htmlDecode(html);
  var text = $copiedHtml.text();
  return htmlDecoded === text;
}

// copied from https://css-tricks.com/snippets/javascript/unescape-html-in-js/
var _htmlDecode = function(input) {
  var e = document.createElement('div');
  e.innerHTML = input;
  return e.childNodes.length === 0 ? '' : e.childNodes[0].nodeValue;
}

var _buildHtmlWithOuterTags = function($copiedHtml, range) {
  var htmlTemplate = _getHtmlTemplateWithAllTagsOfSelectedContent(range);
  var text = $copiedHtml.get(0).textContent;
  return _splitSelectedTextIntoTwoSpans(text, htmlTemplate);
};

var _getHtmlTemplateWithAllTagsOfSelectedContent = function(range) {
  // '.addBack': selected text might be a direct child of the item span
  var $elementWithItemOnRange = $(range.commonAncestorContainer).parentsUntil('body > div').addBack().first();
  return $elementWithItemOnRange.get(0).outerHTML;
}

// FIXME - Allow to copy an item when user copies only one char
/*
  This is a hack to preserve the item classes when user pastes an item.
  When user pastes a span like this: <span class='comment c-124'>thing</span>,
  chrome removes the classes and keeps only the style of the class.
  With comments, for example, chrome keeps the background-color. To avoid this
  we create two spans. The first one, <span class='comment c-124'>thi</span>
  has the text until the last but one character and second one with the last
  character <span class='comment c-124'>g</span>.
  Etherpad does a good job joining the two spans into one after the paste is
  triggered.
*/
var _splitSelectedTextIntoTwoSpans = function(text, itemSpanTemplate) {
  var $firstSpan = $(itemSpanTemplate);
  var $secondSpan = $(itemSpanTemplate);

  // '.find('*').last()': need to set text on the deepest tag
  // '.addBack()': itemSpanTemplate might not have any inner tag
  $firstSpan.find('*').addBack().last().text(text.slice(0, -1)); // text until before last char
  $secondSpan.find('*').addBack().last().text(text.slice(-1)); // last char
  return $('<span>' + $firstSpan.get(0).outerHTML + $secondSpan.get(0).outerHTML + '</span>');
}
