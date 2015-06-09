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

  getPadOuter().contents().find('.comment-modal').hide();
};

var hideOpenedComments = function() {
  var openedComments = getCommentsContainer().find('.mouseover');
  openedComments.removeClass('mouseover').hide();

  getPadOuter().contents().find('.comment-modal').hide();
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
    getPadOuter().contents().find('.comment-modal').show().css({
      left: e.clientX +"px",
      top: e.clientY + 25 +"px"
    });
    // hovering comment view
    getPadOuter().contents().find('.comment-modal-comment').html(commentElm.html());
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

exports.showComment = showComment;
exports.hideComment = hideComment;
exports.hideOpenedComments = hideOpenedComments;
exports.hideAllComments = hideAllComments;
exports.highlightComment = highlightComment;
exports.adjustTopOf = adjustTopOf;
exports.isOnTop = isOnTop;
