var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var utils = require('./utils');
var commentL10n = require('./commentL10n');
var preTextMarker = require('./preTextMarker');

/*
   Possible values for `config`:
     - ace: [mandatory] reference to the `ace` object
     - $content: [mandatory] jQuery reference to the root element to be displayed on the dialog
     - dialogTitleL10nKey: [mandatory] l10n key on locales/*.json to use as dialog title
     - targetType: used to mark selected text when opening & closing the dialog
     - targetAlreadyMarked: flag to avoid text to be marked/unmarked when dialog is
                            opened/closed. Useful when 2 dialogs handle the same targetType
     - dialogOpts: options to overwrite default options used by this component. Can be any of
                   those described on https://api.jqueryui.com/dialog
     - $referenceComponentForDialogPosition: element to be used as reference when positioning
                                             the dialog
     - onSubmit: function to be called when user submits the form on $content (if any)
     - customClose: function to be called when user closes the dialog
*/
var dialog = function(config) {
  this.textMarker = preTextMarker.createForTarget(config.targetType, config.ace);
  this.$content = config.$content;
  this.onSubmit = config.onSubmit;
  this.$referenceComponentForDialogPosition = config.$referenceComponentForDialogPosition;
  this.ace = config.ace;
  this.shouldMarkText = !config.targetAlreadyMarked;

  this._buildWidget(config);

  // When language is changed, we need to be localized too
  var self = this;
  html10n.bind('localized', function() {
    self._localizeDialogContent();
  });
}

dialog.prototype._buildWidget = function(config) {
  var closeDialog = config.customClose || this.close.bind(this);
  var $container = utils.getPadOuter().find('body');
  this.$content.appendTo($container);

  var defaultDialogOpts = {
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
    close: closeDialog,
  };
  var opts = Object.assign({}, defaultDialogOpts, (config.dialogOpts || {}));
  this.$content.dialog(opts);

  this.widget = this.$content.dialog('widget');
  this._customizeCloseButton();
  this._customizeDialogTitle(config.dialogTitleL10nKey);
  this._localizeDialogContent();
}

dialog.prototype._customizeCloseButton = function() {
  var $customizedCloseButton = $('#closeButton').tmpl();
  var $originalCloseButton = this.widget.find('.ui-dialog-titlebar-close');

  // the close button of $.dialog() cannot be customized as needed, so override it
  $originalCloseButton.html($customizedCloseButton.html());

  // enable l10n of close button (same label for all dialogs)
  $originalCloseButton.attr('data-l10n-id', 'ep_comments_page.comments_template.close.title');
}

dialog.prototype._customizeDialogTitle = function(l10nTitle) {
  // enable l10n of dialog title
  var $dialogTitle = this.widget.find('.ui-dialog-title');
  $dialogTitle.attr('data-l10n-id', l10nTitle);
}

dialog.prototype._localizeDialogContent = function() {
  commentL10n.localize(this.widget);
}

dialog.prototype.open = function(aceContext, callbackOnSubmit) {
  var self = this;

  // Detach current "submit" handler to be able to call the updated callbackOnSubmit
  this.$content.off("submit").submit(function() {
    var $form = $(this);

    self.ace.callWithAce(function(ace) {
      var preMarkedTextSelector = '.' + self.textMarker.markClass;
      var preMarkedTextRepArr = ace.ace_getRepFromSelector(preMarkedTextSelector);
      self.onSubmit($form, preMarkedTextRepArr, callbackOnSubmit);
    });

    // don't submit the form, we don't want Etherpad page to be reloaded
    return false;
  });

  // mark selected text, so it is clear to user which text range the dialog is being applied to
  if (this.shouldMarkText) {
    this.textMarker.markSelectedText(aceContext);
  }

  this._resetForm();
  this._openDialog();
  this._smoothlyScrollEditorToMakeDialogFullyVisible();
}

dialog.prototype._resetForm = function() {
  // if there's any form on the dialog, reset it
  this.widget.find('form').each(function() {
    this.reset();
  })
}

dialog.prototype._openDialog = function() {
  if (this.$referenceComponentForDialogPosition) {
    this._openDialogAtSamePositionOf(this.$referenceComponentForDialogPosition);
  } else {
    this._openDialogBelowSelectedText();
  }
}
dialog.prototype._openDialogAtSamePositionOf = function($reference) {
  this.$content.dialog('option', 'position', {
    my: 'left top',
    at: 'left top',
    of: $reference,
    // make sure dialog positioning takes into account the amount of scroll editor has
    within: utils.getPadOuter(),
  }).dialog('open');
}
dialog.prototype._openDialogBelowSelectedText = function() {
  var $shadow = this._createShadowOnPadOuterOfSelectedText();

  // place dialog, using $shadow as reference
  this.$content.dialog('option', 'position', {
    my: 'left top',
    at: 'left bottom+3',
    of: $shadow,
    // make sure dialog positioning takes into account the amount of scroll editor has
    within: utils.getPadOuter(),
  }).dialog('open');

  $shadow.remove();
}

// create an element on the exact same position of the selected text.
// Use it as reference to display dialog later
dialog.prototype._createShadowOnPadOuterOfSelectedText = function() {
  var $selectedText = this._getSelectedText();

  // there might have multiple <span>'s on selected text (ex: if text has bold in the middle of it)
  var beginningOfSelectedText = $selectedText.first().get(0).getBoundingClientRect();
  var endingOfSelectedText    = $selectedText.last().get(0).getBoundingClientRect();

  var topOfSelectedText    = beginningOfSelectedText.top;
  var bottomOfSelectedText = endingOfSelectedText.bottom;
  var leftOfSelectedText   = Math.min(beginningOfSelectedText.left, endingOfSelectedText.left);
  var rightOfSelectedText  = Math.max(beginningOfSelectedText.right, endingOfSelectedText.right);

  // get "shadow" position
  var editor = utils.getPadOuter().find('iframe[name="ace_inner"]').offset();
  var $shadow = $('<span id="shadow"></span>');
  $shadow.css({
    top: editor.top + topOfSelectedText,
    left: editor.left + leftOfSelectedText,
    width: rightOfSelectedText - leftOfSelectedText,
    height: bottomOfSelectedText - topOfSelectedText,
    position: 'absolute',
  });

  var $container = utils.getPadOuter().find('body');
  $shadow.appendTo($container);

  return $shadow;
}

dialog.prototype._getSelectedText = function() {
  var selector = '.' + this.textMarker.markClass;
  var $selectedText = utils.getPadInner().find(selector);

  // when multiple lines are selected, use first one as reference to create the shadow
  var lineAtBeginningOfSelection = $selectedText.first().closest('div').get(0);
  var lineAtEndOfSelection = $selectedText.last().closest('div').get(0);
  if (lineAtBeginningOfSelection !== lineAtEndOfSelection) {
    $selectedText = $selectedText.first();
  }

  return $selectedText;
}

dialog.prototype._focusOnContainer = function() {
  this.$content.focus();

  // fix for iOS: when opening the dialog, we need to force focus on padOuter
  // contentWindow, otherwise keyboard will be displayed but text input made by
  // the user won't be added to $content
  var outerIframe = $('iframe[name="ace_outer"]').get(0);
  if (outerIframe && outerIframe.contentWindow) {
    outerIframe.contentWindow.focus();
  }
}

dialog.prototype._smoothlyScrollEditorToMakeDialogFullyVisible = function() {
  var self = this;

  var outerIframe = $('iframe[name="ace_outer"]').get(0);
  outerIframe.contentWindow.scrollIntoView(self.widget.get(0), function() {
    // Allow user to start typing an input right away
    self._focusOnContainer();
  });
}

dialog.prototype.isOpen = function() {
  return this.$content.dialog('isOpen');
}

dialog.prototype.close = function() {
  this.$content.dialog('close');

  // force focus to be lost, so virtual keyboard is hidden on mobile devices
  utils.getPadOuter().find(':focus').blur();

  // de-select text when dialog is closed
  if (this.shouldMarkText) {
    this.textMarker.unmarkSelectedText();
  }
}

exports.create = function(config) {
  return new dialog(config);
}
