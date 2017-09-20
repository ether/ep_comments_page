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
    'c-abc': {..., replies: { 'cr-123': {...}} },
    'c-def': {..., replies: { 'cr-456': {...}} },
   }

   output: {
    'cr-123': {...},
    'cr-456': {...},
   }
*/
exports.getRepliesIndexedByReplyId = function(comments) {
  return _.chain(comments)
    .pluck('replies') // array of hashes: [{ 'cr-123': {...} }, { 'cr-456': {...} }]
    .reduce(function(repliesIndexedById, replyPair) {
      return Object.assign(repliesIndexedById, replyPair)
    }, {}) // hash indexed by replyId: { 'cr-123': {...}, 'cr-456': {...} }
    .value();
};
