var scheduler = function(callback) {
  this.timer = undefined;
  this.callback = callback;
}

scheduler.prototype.padChanged = function() {
  clearTimeout(this.timer);
  this.timer = setTimeout(this.callback, 300);
}

exports.setCallbackWhenUserStopsChangingPad = function(callback) {
  return new scheduler(callback);
}
