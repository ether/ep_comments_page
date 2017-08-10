var utils = require('ep_comments_page/static/js/utils');

var getCommentsContainer = function() {
  return utils.getPadOuter().find("#comments");
}

/* ***** Public methods: ***** */

var hideComment = function(commentId, hideCommentTitle) {
  var commentElm = getCommentsContainer().find('#'+ commentId);
  commentElm.removeClass('mouseover');

  // hide even the comment title
  if (hideCommentTitle) commentElm.hide();
};

var hideOpenedComments = function() {
  var openedComments = getCommentsContainer().find('.mouseover');
  openedComments.removeClass('mouseover').hide();
}

var hideAllComments = function() {
  getCommentsContainer().children().hide();
}

// Adjust position of the comment detail on the container, to be on the same
// height of the pad text associated to the comment, and return the affected element
var adjustTopOf = function(commentId, baseTop) {
  var commentElement = utils.getPadOuter().find('#'+commentId);
  var targetTop = baseTop - 5;
  commentElement.css("top", targetTop+"px");

  return commentElement;
}

// Indicates if comment is on the expected position (baseTop-5)
var isOnTop = function(commentId, baseTop) {
  var commentElement = utils.getPadOuter().find('#'+commentId);
  var expectedTop = (baseTop - 5) + "px";
  return commentElement.css("top") === expectedTop;
}

// Indicates if event was on one of the elements that does not close comment
var shouldNotCloseComment = function(e) {
  if ($(e.target).closest('.sidebar-comment').length) { // a comment box
    return true;
  }
  return false;
}

exports.hideComment = hideComment;
exports.hideOpenedComments = hideOpenedComments;
exports.hideAllComments = hideAllComments;
exports.adjustTopOf = adjustTopOf;
exports.isOnTop = isOnTop;
exports.shouldNotCloseComment = shouldNotCloseComment;
