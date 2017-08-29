var _ = require('ep_etherpad-lite/static/js/underscore');
var utils = require('./utils');
var scheduler = require('./scheduler');

var scenesChangedListener = function(callback) {
  this.headingAlreadyChanged = false;
  this.callback = callback;

  // to avoid lagging while user is typing, we set a scheduler to postpone
  // calling callback until edition had stopped
  this.scheduler = scheduler.setCallbackWhenUserStopsChangingPad(this.triggerCallbackIfNecessary.bind(this));

  this.startObserving();
}

scenesChangedListener.prototype.startObserving = function() {
  var $editor = utils.getPadInner().find('#innerdocbody');
  this.createObserver().observe($editor.get(0), { childList: true });
}

scenesChangedListener.prototype.createObserver = function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
  return new MutationObserver(this.handlePadLinesChanged.bind(this));
}

scenesChangedListener.prototype.handlePadLinesChanged = function(mutations) {
  this.scheduler.padChanged();

  // don't need to check mutations if we already know there was a heading affected
  if (!this.headingAlreadyChanged && this.mutationsAffectedASceneHeading(mutations)) {
    this.headingAlreadyChanged = true;
  }
}

scenesChangedListener.prototype.mutationsAffectedASceneHeading = function(mutations) {
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
    // check if any of the changed lines was a heading
    .any(function(lineNode) { return lineNode.querySelector('heading') })
    .value();
}

scenesChangedListener.prototype.triggerCallbackIfNecessary = function() {
  if (this.headingAlreadyChanged) {
    this.headingAlreadyChanged = false;
    this.callback();
  }
}

exports.onSceneChanged = function(callback) {
  return new scenesChangedListener(callback);
}
