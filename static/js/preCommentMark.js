var $ = require('ep_etherpad-lite/static/js/rjquery').$;

exports.MARK_CLASS = 'pre-selected-comment';

var preCommentMarker = function(ace) {
  this.ace = ace;
  var self = this;

  // do nothing if this feature is not enabled
  if (!this.highlightSelectedText()) return;

  // remove any existing marks, as there is no comment being added on plugin initialization
  // (we need the timeout to let the plugin be fully initialized before starting to remove
  // marked texts)
  setTimeout(function() {
    self.unmarkSelectedText();
  }, 0);
}

// Indicates if Etherpad is configured to highlight text
preCommentMarker.prototype.highlightSelectedText = function() {
  return clientVars.highlightSelectedText;
}

preCommentMarker.prototype.markSelectedText = function() {
  // do nothing if this feature is not enabled
  if (!this.highlightSelectedText()) return;

  this.ace.callWithAce(doNothing, 'markPreSelectedTextToComment', true);
}

preCommentMarker.prototype.unmarkSelectedText = function() {
  // do nothing if this feature is not enabled
  if (!this.highlightSelectedText()) return;

  this.ace.callWithAce(doNothing, 'unmarkPreSelectedTextToComment', true);
}

preCommentMarker.prototype.performNonUnduableEvent = function(eventType, callstack, action) {
  callstack.startNewEvent("nonundoable");
  action();
  callstack.startNewEvent(eventType);
}

preCommentMarker.prototype.handleMarkText = function(context) {
  var editorInfo = context.editorInfo;
  var rep        = context.rep;
  var callstack  = context.callstack;

  // first we need to unmark any existing text, otherwise we'll have 2 text ranges marked
  this.removeMarks(editorInfo, rep, callstack);

  this.addMark(editorInfo, callstack);
}

preCommentMarker.prototype.handleUnmarkText = function(context) {
  var editorInfo = context.editorInfo;
  var rep        = context.rep;
  var callstack  = context.callstack;

  this.removeMarks(editorInfo, rep, callstack);
}

preCommentMarker.prototype.addMark = function(editorInfo, callstack) {
  var eventType  = callstack.editEvent.eventType;

  // we don't want the text marking to be undoable
  this.performNonUnduableEvent(eventType, callstack, function() {
    editorInfo.ace_setAttributeOnSelection(exports.MARK_CLASS, clientVars.userId);
  });
}

preCommentMarker.prototype.removeMarks = function(editorInfo, rep, callstack) {
  var eventType        = callstack.editEvent.eventType;
  var originalSelStart = rep.selStart;
  var originalSelEnd   = rep.selEnd;

  // we don't want the text marking to be undoable
  this.performNonUnduableEvent(eventType, callstack, function() {
    // remove marked text
    var padInner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');
    var selector = "." + exports.MARK_CLASS;
    var repArr = editorInfo.ace_getRepFromSelector(selector, padInner);
    // repArr is an array of reps
    $.each(repArr, function(index, rep){
      editorInfo.ace_performSelectionChange(rep[0], rep[1], true);
      editorInfo.ace_setAttributeOnSelection(exports.MARK_CLASS, false);
    });

    // make sure selected text is back to original value
    editorInfo.ace_performSelectionChange(originalSelStart, originalSelEnd, true);
  });
}

// we do nothing on callWithAce; actions will be handled on aceEditEvent
var doNothing = function() {}

exports.init = function(ace) {
  return new preCommentMarker(ace);
}
