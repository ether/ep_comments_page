/* ***** Public methods: ***** */

var localize = function(element) {
  html10n.translateElement(html10n.translations, element.get(0));
};

exports.localize = localize;
