var $ = require('ep_etherpad-lite/static/js/rjquery').$;

// Easier access to outer pad
var padOuter;
exports.getPadOuter = function() {
  padOuter = padOuter || $('iframe[name="ace_outer"]').contents();
  return padOuter;
}

// Easier access to inner pad
var padInner;
exports.getPadInner = function() {
  padInner = padInner || this.getPadOuter().find('iframe[name="ace_inner"]').contents();
  return padInner;
}

// Some browsers trigger resize several times while resizing the window, so
// we need to make sure resize is done to avoid calling the callback multiple
// times.
// Based on: https://css-tricks.com/snippets/jquery/done-resizing-event/
exports.waitForResizeToFinishThenCall = function(timeout, callback) {
  var resizeTimer;
  $(window).on('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(callback, timeout);
  });
}

/*
   input: comments = {
    'c-abc': {..., replies: { 'c-reply-123': {...}} },
    'c-def': {..., replies: { 'c-reply-456': {...}} },
   }

   output: {
    'c-reply-123': {...},
    'c-reply-456': {...},
   }
*/
exports.getRepliesIndexedByReplyId = function(comments) {
  return _.chain(comments)
    .pluck('replies') // until here we have [ {'c-reply-123': {...}}, ... ], still need to put
                      // all items of the array into a single object
    .reduce()
    .value();
};
