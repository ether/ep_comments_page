var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');

var copyPasteHelper = function() {};

copyPasteHelper.prototype.addTextAndDataToClipboard = function(clipboardData, $copiedHtml) {
  var hasItemsOnSelection = $copiedHtml.find(this.itemSelectorOnPad).length > 0;
  if (hasItemsOnSelection) {
    var items = this.getItemsData();
    this._buildDataAndSaveToClipboard(clipboardData, $copiedHtml, items, this.itemType, this._buildItemsDataWithNewIds.bind(this));

    if (this._itemHasSubItems()) {
      var subItems = this.getSubItemsData(items);
      this._buildDataAndSaveToClipboard(clipboardData, $copiedHtml, subItems, this.subItemType, this._buildSubItemsDataWithNewIds.bind(this));
    }
  }
  return hasItemsOnSelection;
}

copyPasteHelper.prototype._buildDataAndSaveToClipboard = function(clipboardData, $copiedHtml, items, itemType, buildItemsDataWithNewIds) {
  var itemsWithNewIds = buildItemsDataWithNewIds($copiedHtml, items);
  var itemsJSON = JSON.stringify(itemsWithNewIds);
  var itemDataTypeOnClipboard = this._getClipboardDataTypeOf(itemType);
  clipboardData.setData(itemDataTypeOnClipboard, itemsJSON);
}

copyPasteHelper.prototype._buildSubItemsDataWithNewIds = function($copiedHtml, subItems) {
  return this._buildDataWithNewIds(
    $copiedHtml,
    subItems,
    this._getSubItemIdsFrom.bind(this),
    this.generateNewSubItemId,
    this.setSubItemIdOnSubItem,
  );
}

copyPasteHelper.prototype._buildItemsDataWithNewIds = function($copiedHtml, items) {
  return this._buildDataWithNewIds(
    $copiedHtml,
    items,
    this._getItemIdsFrom.bind(this),
    this.generateNewItemId,
    this.setItemIdOnItem,
    this.setItemIdOnSubItem,
    this.getSubItemsOf,
  );
}

copyPasteHelper.prototype._buildDataWithNewIds = function($copiedHtml, items, getIdsFromHtml, generateNewId, setItemIdOnItem, setItemIdOnSubItem, getSubItemsOf) {
  var itemsWithNewIds = {};
  var originalIds = getIdsFromHtml($copiedHtml);

  _.each(originalIds, function(originaId) {
    var newId = generateNewId();

    // create a copy of item with new id
    var itemWithNewId = Object.assign({}, items[originaId]);
    itemsWithNewIds[newId] = itemWithNewId;
    setItemIdOnItem(itemWithNewId, newId);

    var updateSubItemsToo = setItemIdOnSubItem && getSubItemsOf;
    if (updateSubItemsToo) {
      // replace item id on its sub-items
      var subItems = getSubItemsOf(itemWithNewId);
      _.each(subItems, function(subItem) {
        setItemIdOnSubItem(subItem, newId);
      });
    }

    // replace item id on pad content
    $copiedHtml.find('.' + originaId).removeClass(originaId).addClass(newId);
  });

  return itemsWithNewIds;
}

copyPasteHelper.prototype._getItemIdsFrom = function($copiedHtml) {
  return this._getIdsFrom($copiedHtml, this.itemSelectorOnPad, this.getItemIdsFromString);
}
copyPasteHelper.prototype._getSubItemIdsFrom = function($copiedHtml) {
  return this._getIdsFrom($copiedHtml, this.subItemSelectorOnPad, this.getSubItemIdsFromString);
}

copyPasteHelper.prototype._getIdsFrom = function($copiedHtml, selectorOnPad, getIdFromString) {
  var $copiedItemsOrSubItems = $copiedHtml.find(selectorOnPad);
  return _($copiedItemsOrSubItems)
    .chain()
    // extract item/sub-item ids from their classes
    .map(function(copiedItem) {
      var cls = $(copiedItem).attr('class');
      return getIdFromString(cls);
    })
    .flatten()
    .compact()
    .unique()
    .value();
}

copyPasteHelper.prototype._capitalizeFirstChar = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

copyPasteHelper.prototype.saveItemsAndSubItems = function(clipboardData) {
  this._getClipboardDataAndSaveIt(clipboardData, this.itemType, this.saveItemsData);
  if (this._itemHasSubItems()) {
    this._getClipboardDataAndSaveIt(clipboardData, this.subItemType, this.saveSubItemsData);
  }
}

copyPasteHelper.prototype._getClipboardDataAndSaveIt = function(clipboardData, itemType, saveItemsData) {
  var itemDataTypeOnClipboard = this._getClipboardDataTypeOf(itemType);
  var items = clipboardData.getData(itemDataTypeOnClipboard);
  if (items) {
    saveItemsData(JSON.parse(items));
  }
}

copyPasteHelper.prototype._getClipboardDataTypeOf = function(itemType) {
  return 'text/object' + this._capitalizeFirstChar(itemType);
}

copyPasteHelper.prototype._itemHasSubItems = function() {
  return !!this.subItemType;
}

/* Possible configs:
     itemType
     subItemType
     itemSelectorOnPad
     subItemSelectorOnPad
     getItemsData
     getSubItemsData
     getItemIdsFromString
     getSubItemIdsFromString
     generateNewItemId
     generateNewSubItemId
     setItemIdOnItem
     setSubItemIdOnSubItem
     setItemIdOnSubItem
     getSubItemsOf
     saveItemsData
     saveSubItemsData
*/
exports.init = function(configs) {
  var helper = new copyPasteHelper();
  // add configs as helper properties
  return _(helper).extend(configs);
}
