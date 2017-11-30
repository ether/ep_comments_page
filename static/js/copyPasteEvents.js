var _ = require('ep_etherpad-lite/static/js/underscore');
var utils = require('./utils');
var copyPasteHelper = require('./copyPasteHelper');
var fakeIdsMapper = require('./copyPasteFakeIdsMapper');
var htmlExtractor = require('./htmlExtractorFromSelection');

var addTextAndDataOfAllHelpersToClipboardAndDeleteSelectedContent = function(e) {
  var cutWasOverrode = addTextAndDataOfAllHelpersToClipboard(e);

  // we only remove the selection if the cut default behavior was overrode. Doing it we avoid
  // losing the text cut on the clipboard
  if (cutWasOverrode) {
    utils.getPadInner().get(0).execCommand('delete');
  }
}

var addTextAndDataOfAllHelpersToClipboard = function(e) {
  var $copiedHtml = htmlExtractor.getHtmlOfSelectedContent();
  var clipboardData = e.originalEvent.clipboardData;

  var helpersHaveItemsOnSelection = _(pad.plugins.ep_comments_page.copyPasteHelpers).map(function(helper) {
    return helper.addTextAndDataToClipboard(clipboardData, $copiedHtml);
  });

  var atLeastOneItemChangedClipboard = _(helpersHaveItemsOnSelection).any();
  if (atLeastOneItemChangedClipboard) {
    // override the default copy behavior
    clipboardData.setData('text/html', $copiedHtml.html());
    e.preventDefault();
  }

  return atLeastOneItemChangedClipboard;
}

var saveItemsAndSubItemsOfAllHelpers = function(e) {
  var clipboardData = e.originalEvent.clipboardData;
  _(pad.plugins.ep_comments_page.copyPasteHelpers).each(function(helper) {
    helper.saveItemsAndSubItems(clipboardData);
  });
}

exports.init = function() {
  pad.plugins = pad.plugins || {};
  pad.plugins.ep_comments_page = pad.plugins.ep_comments_page || {};
  pad.plugins.ep_comments_page.copyPasteHelpers = pad.plugins.ep_comments_page.copyPasteHelpers || [];
  pad.plugins.ep_comments_page.fakeIdsMapper = fakeIdsMapper.init();

  // Override  copy, cut, paste events on Google chrome and Mozilla Firefox.
  if(browser.chrome || browser.firefox) {
    utils.getPadInner().
    on('copy' , addTextAndDataOfAllHelpersToClipboard).
    on('cut'  , addTextAndDataOfAllHelpersToClipboardAndDeleteSelectedContent).
    on('paste', saveItemsAndSubItemsOfAllHelpers);
  }
}

exports.listenToCopyCutPasteEventsOfItems = function(configs) {
  var helper = copyPasteHelper.init(configs);
  pad.plugins.ep_comments_page.copyPasteHelpers.push(helper)
}
