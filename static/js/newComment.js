var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var utils = require('./utils');
var commentL10n = require('./commentL10n');
var preCommentMark = require('./preCommentMark');

var SELECTED_TEXT = '.' + preCommentMark.MARK_CLASS;

// Easier access to new comment container
var newCommentContainer;
var getNewCommentContainer = function() {
  newCommentContainer = newCommentContainer || utils.getPadOuter().find('#newComments');
  return newCommentContainer;
}

// Insert a comment node
var createNewCommentForm = function(comment) {
  var $container = getNewCommentContainer();

  var $content = $('#newCommentTemplate').tmpl(comment);
  $content.prependTo($container);

  $content.dialog({
    autoOpen: false,
    resizable: false,
    show: {
      effect: "drop",
      duration: 500
    },
    hide: {
      effect: "drop",
      duration: 500
    },
    // de-select text when modal is closed
    close: hideNewCommentForm,
  });
  // the close button of $.dialog() cannot be customized as needed, so override it
  var $closeButton = $('#closeButton').tmpl();
  var $originalButtonContainer = utils.getPadOuter().find('.ui-dialog-titlebar-close');
  $originalButtonContainer.html($closeButton.html());

  // enable l10n of close button
  $originalButtonContainer.attr('data-l10n-id', 'ep_comments_page.comments_template.close.title');

  // enable l10n of dialog title
  var $dialogTitle = utils.getPadOuter().find('.ui-dialog-title');
  $dialogTitle.attr('data-l10n-id', 'ep_comments_page.comments_template.comment');
};

// Create a comment object with data filled on the given form
var buildCommentFrom = function(form) {
  var text = form.find('.comment-content').val();
  return { text: text };
}

// Callback for new comment Cancel
var cancelNewComment = function(){
  hideNewCommentForm();
}

// Callback for new comment Submit
var submitNewComment = function(form, callback) {
  var index = 0;
  var text = form.find('.comment-content').val();
  var commentTextIsNotEmpty = text.length !== 0;
  var comment = buildCommentFrom(form);
  if (commentTextIsNotEmpty) {
    hideNewCommentForm();
    callback(comment, index);
  }
  return false;
}

var fixFlyingToobarOnIOS = function() {
  if (browser.ios) {
    var shouldPlaceMenuRightOnBottom = $(".toolbar ul.menu_right").css('bottom') !== "auto";

    utils.getPadOuter().find('#newComments').find('input, textarea')
    .on("focus", function() {
      fixToolbarPosition();
      if (shouldPlaceMenuRightOnBottom) placeMenuRightOnBottom();
    })
    .on("blur", function() {
      revertFixToToolbarPosition();
      if (shouldPlaceMenuRightOnBottom) revertPlacingMenuRightOnBottom();
    });

    // When user changes orientation, we need to re-position menu_right
    if (shouldPlaceMenuRightOnBottom) {
      utils.waitForResizeToFinishThenCall(500, function() {
        var needToUpdateTop = $(".toolbar ul.menu_right").css("top") !== "";
        if (needToUpdateTop) placeMenuRightOnBottom();
      });
    }

  }
}

var fixToolbarPosition = function() {
  $(".toolbar ul.menu_left, .toolbar ul.menu_right").css("position", "absolute");
}
var revertFixToToolbarPosition = function() {
  $(".toolbar ul.menu_left, .toolbar ul.menu_right").css("position", "");
}

var placeMenuRightOnBottom = function() {
  $(".toolbar ul.menu_right").css("top", $(document).outerHeight());
}
var revertPlacingMenuRightOnBottom = function() {
  $(".toolbar ul.menu_right").css("top", "");
}

/* ***** Public methods: ***** */

var localizeNewCommentForm = function() {
  var $newCommentContainer = utils.getPadOuter().find('.ui-dialog');
  if ($newCommentContainer.length !== 0) commentL10n.localize($newCommentContainer);
};

// Create container to hold new comment form
var insertContainers = function(target) {
  target.prepend('<div id="newComments"></div>');

  createNewCommentForm();

  // Hack to avoid "flying" toolbars on iOS
  fixFlyingToobarOnIOS();
}

// create an element on the exact same position of the selected text.
// Use it as reference to display new comment modal later
var createShadowOnPadOuterOfSelectedText = function() {
  var $selectedText = utils.getPadInner().find(SELECTED_TEXT);
  // there might have multiple <span>'s on selected text
  var beginningOfSelectedText = $selectedText.first().get(0).getBoundingClientRect();
  var endingOfSelectedText    = $selectedText.last().get(0).getBoundingClientRect();

  var topOfSelectedText    = beginningOfSelectedText.top;
  var bottomOfSelectedText = endingOfSelectedText.bottom;
  var leftOfSelectedText   = Math.min(beginningOfSelectedText.left, endingOfSelectedText.left);
  var rightOfSelectedText  = Math.max(beginningOfSelectedText.right, endingOfSelectedText.right);

  // get "ghost" position
  var editor = utils.getPadOuter().find('iframe[name="ace_inner"]').offset();
  var $ghost = $('<span id="ghost"></span>');
  $ghost.css({
    top: editor.top + topOfSelectedText,
    left: editor.left + leftOfSelectedText,
    width: rightOfSelectedText - leftOfSelectedText,
    height: bottomOfSelectedText - topOfSelectedText,
    position: 'absolute',
  });
  $ghost.insertAfter(getNewCommentContainer());

  return $ghost;
}

var showNewCommentForm = function(comment, callback) {
  localizeNewCommentForm();

  // TODO do we need this??
  comment.commentId = "";

  var $newCommentForm = utils.getPadOuter().find('#newComment');

  // Reset form to make sure it is all clear
  $newCommentForm.get(0).reset();

  // Detach current "submit" handler to be able to call the updated callback
  $newCommentForm.off("submit").submit(function() {
    return submitNewComment($(this), callback);
  });

  // we need to set a timeout to make sure selected text was marked and $ghost can be
  // created at the correct position
  window.setTimeout(function() {
    var $ghost = createShadowOnPadOuterOfSelectedText();

    $newCommentForm.dialog('option', 'position', {
      my: 'left top',
      at: 'left bottom+3',
      of: $ghost,
      // make sure dialog positioning takes into account the amount of scroll editor has
      within: utils.getPadOuter(),
    }).dialog('open');
    $ghost.remove();

    // TODO scroll if necessary
    // var outerIframe = $('iframe[name="ace_outer"]').get(0);
    // outerIframe.contentWindow.scrollIntoView(utils.getPadOuter().find('#newComment').get(0));
  }, 0);

  // mark selected text, so it is clear to user which text range the comment is being applied to
  pad.plugins.ep_comments_page.preCommentMarker.markSelectedText();
}

var hideNewCommentForm = function() {
  var $newCommentForm = utils.getPadOuter().find('#newComment');
  $newCommentForm.dialog('close');

  // force focus to be lost, so virtual keyboard is hidden on mobile devices
  utils.getPadOuter().find(':focus').blur();

  // unmark selected text, as now there is no text being commented
  pad.plugins.ep_comments_page.preCommentMarker.unmarkSelectedText();
}

exports.localizeNewCommentForm = localizeNewCommentForm;
exports.showNewCommentForm = showNewCommentForm;
exports.insertContainers = insertContainers;
