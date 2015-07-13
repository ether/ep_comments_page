// Easier access to outter pad
var padOuter;
var getPadOuter = function() {
  padOuter = padOuter || $('iframe[name="ace_outer"]').contents();
  return padOuter;
}

var getCommentsContainer = function() {
  return getPadOuter().find("#comments");
}

/* ***** Public methods: ***** */

var showComment = function(commentId, e) {
  var commentElm = getCommentsContainer().find('#'+ commentId);
  commentElm.show();

  highlightComment(commentId, e);
};

var hideComment = function(commentId, hideCommentTitle) {
  var commentElm = getCommentsContainer().find('#'+ commentId);
  commentElm.removeClass('mouseover');

  // hide even the comment title
  if (hideCommentTitle) commentElm.hide();

  getPadOuter().find('.comment-modal').hide();
};

var hideOpenedComments = function() {
  var openedComments = getCommentsContainer().find('.mouseover');
  openedComments.removeClass('mouseover').hide();

  getPadOuter().find('.comment-modal').hide();
}

var hideAllComments = function() {
  getCommentsContainer().children().hide();
}

var highlightComment = function(commentId, e){
  var container       = getCommentsContainer();
  var commentElm      = container.find('#'+ commentId);
  var commentsVisible = container.is(":visible");
  if(commentsVisible) {
    // sidebar view highlight
    commentElm.addClass('mouseover');
  } else {
    var commentElm = container.find('#'+ commentId);
    // hovering comment view
    getPadOuter().find('.comment-modal-comment').html(commentElm.html());

    // get modal position
    var containerWidth = getPadOuter().find('#outerdocbody').outerWidth(true);
    var modalWitdh = getPadOuter().find('.comment-modal').outerWidth(true);
    var targetLeft = e.clientX;
    var targetTop = $(e.target).offset().top;
    // if positioning modal on target left will make part of the modal to be
    // out of screen, we place it closer to the middle of the screen
    if (targetLeft + modalWitdh > containerWidth) {
      targetLeft = containerWidth - modalWitdh - 2;
    }
    getPadOuter().find('.comment-modal').show().css({
      left: targetLeft +"px",
      top: targetTop + 25 +"px"
    });
  }
}

// Adjust position of the comment detail on the container, to be on the same
// height of the pad text associated to the comment, and return the affected element
var adjustTopOf = function(commentId, baseTop) {
  var commentElement = getPadOuter().find('#'+commentId);
  var targetTop = baseTop - 5;
  commentElement.css("top", targetTop+"px");

  return commentElement;
}

// Indicates if comment is on the expected position (baseTop-5)
var isOnTop = function(commentId, baseTop) {
  var commentElement = getPadOuter().find('#'+commentId);
  var expectedTop = (baseTop - 5) + "px";
  return commentElement.css("top") === expectedTop;
}

// Indicates if event was on one of the elements that does not close comment
var shouldNotCloseComment = function(e) {
  if ($(e.target).closest('.sidebar-comment').length // a comment box
    || $(e.target).closest('.comment-modal').length) { // the comment modal
    return true;
  }
  return false;
}

exports.showComment = showComment;
exports.hideComment = hideComment;
exports.hideOpenedComments = hideOpenedComments;
exports.hideAllComments = hideAllComments;
exports.highlightComment = highlightComment;
exports.adjustTopOf = adjustTopOf;
exports.isOnTop = isOnTop;
exports.shouldNotCloseComment = shouldNotCloseComment;
