var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var commentL10n = require('ep_comments_page/static/js/commentL10n');

// Easier access to outer pad
var padOuter;
var getPadOuter = function() {
  padOuter = padOuter || $('iframe[name="ace_outer"]').contents();
  return padOuter;
}

// Easier access to new comment container
var newCommentContainer;
var getNewCommentContainer = function() {
  newCommentContainer = newCommentContainer || getPadOuter().find('#newComments');
  return newCommentContainer;
}

// Insert a comment node
var createNewCommentForm = function(comment) {
  var container = getNewCommentContainer();

  comment.commentId = "";
  var content = $('#newCommentTemplate').tmpl(comment);
  content.prependTo(container);

  return content;
};

// Create a comment object with data filled on the given form
var buildCommentFrom = function(form) {
  var text       = form.find('.comment-content').val();
  var changeFrom = form.find('.comment-suggest-from').val();
  var changeTo   = form.find('.comment-suggest-to').val() || null;
  var comment    = {};

  comment.text = text;
  if(changeTo){
    comment.changeFrom = changeFrom;
    comment.changeTo = changeTo;
  }

  return comment;
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

    getNewCommentContainer().find('input, textarea')
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
      waitForResizeToFinishThenCall(500, function() {
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
  var newCommentForm = getNewCommentContainer().find('#newComment');
  if (newCommentForm.length !== 0) commentL10n.localize(newCommentForm);
};

// Create container to hold new comment form
var insertContainers = function(target) {
  target.prepend('<div id="newComments"></div>');

  // Listen for include suggested change toggle
  getNewCommentContainer().on("change", '#suggestion-checkbox', function() {
    if($(this).is(':checked')) {
      getPadOuter().find('.suggestion').show();
    } else {
      getPadOuter().find('.suggestion').hide();
    }
  });
}

// Insert new Comment Form
var insertNewCommentFormIfDontExist = function(comment, callback) {
  var newCommentForm = getNewCommentContainer().find('#newComment');
  var formDoesNotExist = newCommentForm.length === 0;
  if (formDoesNotExist) {
    newCommentForm = createNewCommentForm(comment);
    localizeNewCommentForm();

    // Listen to cancel
    newCommentForm.find('#comment-reset').on('click', function() {
      cancelNewComment();
    });

    // Hack to avoid "flying" toolbars on iOS
    fixFlyingToobarOnIOS();

  } else {
    // Reset form to make sure it is all clear
    newCommentForm.get(0).reset();

    // Detach current "submit" handler to be able to call the updated callback
    newCommentForm.off("submit");
  }

  // Listen to comment confirmation (needs to be outside of if/else to be able to update the callback)
  newCommentForm.submit(function() {
    var form = $(this);
    return submitNewComment(form, callback);
  });

  return newCommentForm;
};

var showNewCommentForm = function() {
  getNewCommentContainer().addClass("active");
  // we need to set a timeout otherwise the animation to show #newComment won't be visible
  window.setTimeout(function() {
    getPadOuter().find('.suggestion').hide(); // Hides suggestion in case of a cancel
    getNewCommentContainer().find('#newComment').removeClass("hidden").addClass("visible");
  }, 0);

  // mark selected text, so it is clear to user which text range the comment is being applied to
  pad.plugins.ep_comments_page.preCommentMarker.markSelectedText();
}

var hideNewCommentForm = function() {
  getNewCommentContainer().find('#newComment').removeClass("visible").addClass("hidden");

  // force focus to be lost, so virtual keyboard is hidden on mobile devices
  getNewCommentContainer().find(':focus').blur();

  // we need to give some time for the animation of #newComment to finish
  window.setTimeout(function() {
    getNewCommentContainer().removeClass("active");
  }, 500);

  // unmark selected text, as now there is no text being commented
  pad.plugins.ep_comments_page.preCommentMarker.unmarkSelectedText();
}

// Some browsers trigger resize several times while resizing the window, so
// we need to make sure resize is done to avoid calling the callback multiple
// times.
// Based on: https://css-tricks.com/snippets/jquery/done-resizing-event/
var waitForResizeToFinishThenCall = function(timeout, callback){
  var resizeTimer;
  $(window).on("resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(callback, timeout);
  });
}

exports.localizeNewCommentForm = localizeNewCommentForm;
exports.insertNewCommentFormIfDontExist = insertNewCommentFormIfDontExist;
exports.showNewCommentForm = showNewCommentForm;
exports.hideNewCommentForm = hideNewCommentForm;
exports.insertContainers = insertContainers;
exports.waitForResizeToFinishThenCall = waitForResizeToFinishThenCall;
