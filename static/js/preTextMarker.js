var _ = require('ep_etherpad-lite/static/js/underscore');

exports.BASE_CLASS = 'pre-selected-';

var doNothing = function() {}

var preTextMarker = function(targetType, ace) {
  this.ace = ace;
  this.targetType = targetType;
  this.markClass = exports.BASE_CLASS + targetType;
  this.markTextEvent = 'markText-' + targetType;
  this.unmarkTextEvent = 'unmarkText-' + targetType;

  // remove any existing marks, as there is no item being added on plugin initialization
  // (we need the timeout to let the plugin be fully initialized before starting to remove
  // marked texts)
  var self = this;
  setTimeout(function() {
    self.unmarkSelectedText();
  }, 0);
}

preTextMarker.prototype.markSelectedText = function(aceContext) {
  if (aceContext && aceContext.callstack) {
    // there's an active callstack already, don't need to create a new one
    this.handleMarkText(aceContext.editorInfo, aceContext.rep, aceContext.callstack);
  } else {
    // we need a callstack to be able to make text marking/unmarking
    // a non-undoable event, so prepare to create a callstack here
    this.ace.callWithAce(doNothing, this.markTextEvent, true);
  }
}
preTextMarker.prototype.unmarkSelectedText = function() {
  this.ace.callWithAce(doNothing, this.unmarkTextEvent, true);
}

preTextMarker.prototype.processAceEditEvent = function(context) {
  var editorInfo = context.editorInfo;
  var rep        = context.rep;
  var callstack  = context.callstack;
  var eventType  = callstack.editEvent.eventType;

  if(eventType === this.unmarkTextEvent) {
    this.handleUnmarkText(editorInfo, rep, callstack);
  } else if(eventType === this.markTextEvent) {
    this.handleMarkText(editorInfo, rep, callstack);
  }
}

preTextMarker.prototype.handleMarkText = function(editorInfo, rep, callstack) {
  // first we need to unmark any existing text, otherwise we'll have 2 text ranges marked
  this.removeMarks(editorInfo, rep, callstack);

  this.addMark(editorInfo, callstack);
}

preTextMarker.prototype.handleUnmarkText = function(editorInfo, rep, callstack) {
  this.removeMarks(editorInfo, rep, callstack);
}

preTextMarker.prototype.addMark = function(editorInfo, callstack) {
  var eventType  = callstack.editEvent.eventType;
  var attributeName = this.markClass;

  // we don't want the text marking to be undoable
  this.performNonUnduableEvent(eventType, callstack, function() {
    editorInfo.ace_setAttributeOnSelection(attributeName, clientVars.userId);
  });
}

preTextMarker.prototype.removeMarks = function(editorInfo, rep, callstack) {
  var eventType        = callstack.editEvent.eventType;
  var originalSelStart = rep.selStart;
  var originalSelEnd   = rep.selEnd;
  var attributeName    = this.markClass;

  // we don't want the text marking to be undoable
  this.performNonUnduableEvent(eventType, callstack, function() {
    // remove marked text
    var selector = '.' + attributeName;
    var repArr = editorInfo.ace_getRepFromSelector(selector);
    // repArr is an array of reps
    _(repArr).each(function(rep) {
      editorInfo.ace_performSelectionChange(rep[0], rep[1], true);
      editorInfo.ace_setAttributeOnSelection(attributeName, false);
    });

    // make sure selected text is back to original value
    editorInfo.ace_performSelectionChange(originalSelStart, originalSelEnd, true);
  });
}

preTextMarker.prototype.performNonUnduableEvent = function(eventType, callstack, action) {
  callstack.startNewEvent('nonundoable');
  action();
  callstack.startNewEvent(eventType);
}

exports.createForTarget = function(targetType, ace) {
  var newMarker = new preTextMarker(targetType, ace);
  pad.preTextMarkers = pad.preTextMarkers || {};
  pad.preTextMarkers[targetType] = newMarker;

  return newMarker;
}

exports.processAceEditEvent = function(context) {
  // process event for all text markers
  _(pad.preTextMarkers).each(function(marker) {
    marker.processAceEditEvent(context);
  });
}
