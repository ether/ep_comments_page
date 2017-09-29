var eascUtils = require('ep_script_toggle_view/static/js/utils');
var SHORTCUT_BASE = require('ep_script_scene_marks/static/js/constants').TEKSTO_SHORTCUT_BASE;

var SHORTCUT_KEY = 'C';

exports.processAceKeyEvent = function(context) {
  var evt = context.evt;
  var key = String.fromCharCode(evt.which);

  var eventProcessed = false;

  var cmdAndCtrlPressed = eascUtils.isModifierKeyPressed(evt, SHORTCUT_BASE);
  if (cmdAndCtrlPressed && key === SHORTCUT_KEY) {
    evt.preventDefault();
    pad.plugins.ep_comments_page.displayNewCommentForm(context);
    eventProcessed = true;
  }

  return eventProcessed;
}
