var _ = require('ep_etherpad-lite/static/js/underscore');
var utils = require('./utils');
var scheduler = require('./scheduler');

var linesChangedListener = function(selector, callback) {
  this.targetLineAlreadyChanged = false;
  this.selector = selector;
  this.callback = callback;

  // to avoid lagging while user is typing, we set a scheduler to postpone
  // calling callback until edition had stopped
  this.scheduler = scheduler.setCallbackWhenUserStopsChangingPad(this.triggerCallbackIfNecessary.bind(this));

  this.startObserving();
}

linesChangedListener.prototype.startObserving = function() {
  var $editor = utils.getPadInner().find('#innerdocbody');
  this.createObserver().observe($editor.get(0), { childList: true });
}

linesChangedListener.prototype.createObserver = function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
  return new MutationObserver(this.handlePadLinesChanged.bind(this));
}

linesChangedListener.prototype.handlePadLinesChanged = function(mutations) {
  this.scheduler.padChanged();

  // don't need to check mutations if we already know there was a target line affected
  if (!this.targetLineAlreadyChanged && this.mutationsAffectedATargetLine(mutations)) {
    this.targetLineAlreadyChanged = true;
  }
}

linesChangedListener.prototype.mutationsAffectedATargetLine = function(mutations) {
  var selector = this.selector;
  return _(mutations)
    .chain()
    // extract changed lines
    .map(function(mutation) {
      var addedNodes = Array.from(mutation.addedNodes);
      var removedNodes = Array.from(mutation.removedNodes);
      return addedNodes.concat(removedNodes);
    })
    .flatten()
    .unique()
    // check if any of the changed lines matches the provided selector
    .any(function(lineNode) { return lineNode.querySelector(selector) })
    .value();
}

linesChangedListener.prototype.triggerCallbackIfNecessary = function() {
  if (this.targetLineAlreadyChanged) {
    this.targetLineAlreadyChanged = false;
    this.callback();
  }
}

exports.onLineChanged = function(selector, callback) {
  return new linesChangedListener(selector, callback);
}
