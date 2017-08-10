var $ = require('ep_etherpad-lite/static/js/rjquery').$;

var utils = require('ep_comments_page/static/js/utils');
var api = require('ep_comments_page/static/js/api');
var commentBoxes = require('ep_comments_page/static/js/commentBoxes');

// Indicates if Etherpad is configured to display icons
var displayIcons = function() {
  return clientVars.displayCommentAsIcon
}

// Indicates if screen has enough space on right margin to display icons
var screenHasSpaceToDisplayIcons;
var screenHasSpaceForIcons = function() {
  if (screenHasSpaceToDisplayIcons === undefined) calculateIfScreenHasSpaceForIcons();

  return screenHasSpaceToDisplayIcons;
}

var calculateIfScreenHasSpaceForIcons = function() {
  var $firstElementOnPad = utils.getPadInner().find('#innerdocbody > div').first();
  var availableSpaceOnTheRightOfPadLines = getSpaceAvailableOnTheRightSide($firstElementOnPad);

  screenHasSpaceToDisplayIcons = availableSpaceOnTheRightOfPadLines !== 0;
}

// The space available can be anything like padding, margin or border
var getSpaceAvailableOnTheRightSide = function($element) {
  var rightPadding      = parseInt($element.css('padding-right'), 10);
  var rightBorder       = parseInt($element.css('border-right-width'), 10);
  var rightMargin       = parseInt($element.css('margin-right'), 10);

  var rightEdgeSpace = rightPadding + rightBorder + rightMargin;
  return rightEdgeSpace;
}

var getOrCreateIconsContainerAt = function(top) {
  var iconContainer = utils.getPadOuter().find('#commentIcons');
  var iconClass = "icon-at-"+top;

  // is this the 1st comment on that line?
  var iconsAtLine = iconContainer.find("."+iconClass);
  var isFirstIconAtLine = iconsAtLine.length === 0;

  // create container for icons at target line, if it does not exist yet
  if (isFirstIconAtLine) {
    iconContainer.append('<div class="comment-icon-line '+iconClass+'"></div>');
    iconsAtLine = iconContainer.find("."+iconClass);
    iconsAtLine.css("top", top+"px");
  }

  return iconsAtLine;
}

var targetCommentIdOf = function(e) {
  return e.currentTarget.getAttribute("data-commentid");
}

var highlightTargetTextOf = function(commentId) {
  utils.getPadInner().find("head").append("<style>."+commentId+"{ background: #FFFACD !important }</style>");
}
var removeHighlightOfTargetTextOf = function(commentId) {
  utils.getPadInner().find("head").append("<style>."+commentId+"{ background: none !important }</style>");
}
var removeHighlightOfAllComments = function() {
  utils.getPadInner().find("head").append("<style>.comment{ background: none !important }</style>");
}

var toggleActiveCommentIcon = function(target) {
  target.toggleClass("active").toggleClass("inactive");
}

var placeCaretAtBeginningOfTextOf = function(commentId) {
  var beginningOfComment = utils.getPadInner().find('.comment.' + commentId).get(0);
  var selection = utils.getPadInner().get(0).getSelection();
  var range = selection.getRangeAt(0);

  range.setStart(beginningOfComment, 0);
  range.setEnd(beginningOfComment, 0);

  selection.removeAllRanges();
  selection.addRange(range);

  // when user clicks on the icon, the editor (padInner) looses focus, so user cannot
  // start typing right away. Force focus to be on editor to avoid that.
  makeSureEditorHasTheFocus();
}

var makeSureEditorHasTheFocus = function() {
  utils.getPadOuter().find('iframe[name="ace_inner"]').get(0).contentWindow.focus();
}

var addListenersToCommentIcons = function() {
  utils.getPadOuter().find('#commentIcons').on("mouseover", ".comment-icon.inactive", function(e){
    var commentId = targetCommentIdOf(e);
    highlightTargetTextOf(commentId);
  }).on("mouseout", ".comment-icon.inactive", function(e){
    var commentId = targetCommentIdOf(e);
    removeHighlightOfTargetTextOf(commentId);
  }).on("click", ".comment-icon.active", function(e){
    toggleActiveCommentIcon($(this));
    var commentId = targetCommentIdOf(e);
    removeHighlightOfTargetTextOf(commentId);
    api.triggerCommentDeactivation();
  }).on("click", ".comment-icon.inactive", function(e){
    // deactivate/hide other comment boxes that are opened, so we have only
    // one comment box opened at a time
    var allActiveIcons = utils.getPadOuter().find('#commentIcons').find(".comment-icon.active");
    toggleActiveCommentIcon(allActiveIcons);
    removeHighlightOfAllComments();

    // activate/show only target comment
    toggleActiveCommentIcon($(this));
    var commentId = targetCommentIdOf(e);
    highlightTargetTextOf(commentId);
    placeCaretAtBeginningOfTextOf(commentId);
    api.triggerCommentActivation(commentId);
  });
}

// Listen to clicks on the page to be able to close comment when clicking
// outside of it
var addListenersToDeactivateComment = function() {
  // we need to add listeners to the different iframes of the page
  $(document).on("touchstart click", function(e){
    deactivateCommentIfNotOnSelectedElements(e);
  });
  utils.getPadOuter().find('html').on("touchstart click", function(e){
    deactivateCommentIfNotOnSelectedElements(e);
  });
  utils.getPadInner().find('html').on("touchstart click", function(e){
    deactivateCommentIfNotOnSelectedElements(e);
  });
}

// Close comment if event target was outside of comment or on a comment icon
var deactivateCommentIfNotOnSelectedElements = function(e) {
  // Don't do anything if clicked on the following elements:
  if (shouldNotCloseComment(e) // any of the comment icons
    || commentBoxes.shouldNotCloseComment(e)) { // a comment box or the comment modal
    return;
  }

  // All clear, can close the comment
  var openedComment = findOpenedComment();
  if (openedComment) {
    toggleActiveCommentIcon($(openedComment));
    removeHighlightOfAllComments();
    api.triggerCommentDeactivation();
  }
}

// Search on the page for an opened comment
var findOpenedComment = function() {
  return utils.getPadOuter().find('#commentIcons .comment-icon.active').get(0);
}

var loadHelperLibs = function() {
  // we must load this script on padOuter, otherwise it won't handle the scroll on
  // padOuter.contentWindow, but on padChrome.window instead
  var outerIframe = $('iframe[name="ace_outer"]').get(0);
  var outerDoc = outerIframe.contentDocument;
  var script = outerDoc.createElement('script');
  script.type = 'text/javascript';
  script.src = '../static/plugins/ep_comments_page/static/js/lib/scrollIntoView.min.js';
  outerDoc.body.appendChild(script);
}

// Handle when an external message asks for a comment to be activated.
var handleCommentActivation = function(commentId) {
  if (commentId) {
    triggerCommentActivation(commentId);
  } else {
    triggerCommentDeactivation();
  }
}

var triggerCommentDeactivation = function() {
  utils.getPadOuter().find('#commentIcons .active').click();
}
// Click on comment icon, so the whole cycle of events is performed
var triggerCommentActivation = function(commentId) {
  var $commentIcon = utils.getPadOuter().find('#commentIcons #icon-' + commentId);

  // make sure icon is visible on viewport
  var outerIframe = $('iframe[name="ace_outer"]').get(0);
  outerIframe.contentWindow.scrollIntoView($commentIcon.get(0));

  // ".inactive": comment is already active, don't need to be activated
  $commentIcon.filter('.inactive').click();
}

/* ***** Public methods: ***** */

// Create container to hold comment icons
var insertContainer = function() {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons()) return;

  utils.getPadOuter().find("#sidediv").after('<div id="commentIcons"></div>');

  adjustIconsForNewScreenSize();
  addListenersToCommentIcons();
  addListenersToDeactivateComment();
  loadHelperLibs();

  api.setHandleCommentActivation(handleCommentActivation);
}

// Create a new comment icon
var addIcon = function(commentId, comment){
  // we're only doing something if icons will be displayed at all
  if (!displayIcons()) return;

  var inlineComment = utils.getPadInner().find(".comment."+commentId);
  var top = inlineComment.get(0).offsetTop + 5;
  var iconsAtLine = getOrCreateIconsContainerAt(top);
  var icon = $('#commentIconTemplate').tmpl(comment);

  icon.appendTo(iconsAtLine);
}

// Hide comment icons from container
var hideIcons = function() {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons() || !screenHasSpaceForIcons()) return;

  utils.getPadOuter().find('#commentIcons').children().children().each(function(){
    $(this).hide();
  });
}

// Adjust position of the comment icon on the container, to be on the same
// height of the pad text associated to the comment, and return the affected icon
var adjustTopOf = function(commentId, baseTop) {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons() || !screenHasSpaceForIcons()) return;

  var icon = utils.getPadOuter().find('#icon-'+commentId);
  var targetTop = baseTop+5;
  var iconsAtLine = getOrCreateIconsContainerAt(targetTop);

  // move icon from one line to the other
  if (iconsAtLine != icon.parent()) icon.appendTo(iconsAtLine);

  icon.show();

  return icon;
}

// Indicate if comment detail currently opened was shown by a click on
// comment icon.
var isCommentOpenedByClickOnIcon = function() {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons() || !screenHasSpaceForIcons()) return false;

  var iconClicked = utils.getPadOuter().find('#commentIcons').find(".comment-icon.active");
  var commentOpenedByClickOnIcon = iconClicked.length !== 0;

  return commentOpenedByClickOnIcon;
}

// Mark comment as a comment-with-reply, so it can be displayed with a
// different icon
var commentHasReply = function(commentId) {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons()) return;

  // change comment icon
  var iconForComment = utils.getPadOuter().find('#commentIcons').find("#icon-"+commentId);
  iconForComment.addClass("with-reply");
}

// Indicate if sidebar comment should be shown, checking if it had the characteristics
// of a comment that was being displayed on the screen
var shouldShow = function(sidebarComent) {
  var shouldShowComment = false;

  if (!displayIcons() || !screenHasSpaceForIcons()) {
    // if icons are not being displayed, we always show comments
    shouldShowComment = true;
  } else if (sidebarComent.hasClass("mouseover")) {
    // if icons are being displayed, we only show comments clicked by user
    shouldShowComment = true;
  }

  return shouldShowComment;
}

var adjustIconsForNewScreenSize = function() {
  // we're only doing something if icons will be displayed at all
  if (!displayIcons()) return;

  // now that screen has a different size, we need to force calculation
  // of flag used by screenHasSpaceForIcons() before calling the function
  calculateIfScreenHasSpaceForIcons();

  if (screenHasSpaceForIcons()) {
    utils.getPadOuter().find('#commentIcons').show();
  } else {
    utils.getPadOuter().find('#commentIcons').hide();
  }
}

// Indicates if event was on one of the elements that does not close comment (any of the comment icons)
var shouldNotCloseComment = function(e) {
  return $(e.target).closest('.comment-icon').length !== 0;
}

exports.insertContainer = insertContainer;
exports.addIcon = addIcon;
exports.hideIcons = hideIcons;
exports.adjustTopOf = adjustTopOf;
exports.isCommentOpenedByClickOnIcon = isCommentOpenedByClickOnIcon;
exports.commentHasReply = commentHasReply;
exports.shouldShow = shouldShow;
exports.adjustIconsForNewScreenSize = adjustIconsForNewScreenSize;
exports.shouldNotCloseComment = shouldNotCloseComment;
