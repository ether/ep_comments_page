var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');

var copyPasteHelper = function(configs) {
  this.itemDataTypeOnClipboard = this._getClipboardDataTypeOf(configs.itemType);
  this.subItemDataTypeOnClipboard = this._itemHasSubItems() && this._getClipboardDataTypeOf(configs.subItemType);
};

copyPasteHelper.prototype._getClipboardDataTypeOf = function(itemType) {
  return 'text/object' + this._capitalizeFirstChar(itemType);
}

copyPasteHelper.prototype.addTextAndDataToClipboard = function(clipboardData, $copiedHtml) {
  var hasItemsOnSelection = $copiedHtml.find(this.itemSelectorOnPad).length > 0;
  if (hasItemsOnSelection) {
    var items = this.getItemsData();
    this._buildDataAndSaveToClipboard(
      clipboardData,
      $copiedHtml,
      items,
      this.itemDataTypeOnClipboard,
      this._buildItemsDataWithFakeIds.bind(this),
    );

    if (this._itemHasSubItems()) {
      var subItems = this.getSubItemsData(items);
      this._buildDataAndSaveToClipboard(
        clipboardData,
        $copiedHtml,
        subItems,
        this.subItemDataTypeOnClipboard,
        this._buildSubItemsDataWithFakeIds.bind(this)
      );
    }
  }
  return hasItemsOnSelection;
}

copyPasteHelper.prototype._buildDataAndSaveToClipboard = function(clipboardData, $copiedHtml, items, clipboardDataType, buildItemsDataWithFakeIds) {
  var itemsWithFakeIds = buildItemsDataWithFakeIds($copiedHtml, items);
  var itemsJSON = JSON.stringify(itemsWithFakeIds);
  clipboardData.setData(clipboardDataType, itemsJSON);
}

copyPasteHelper.prototype._buildSubItemsDataWithFakeIds = function($copiedHtml, subItems) {
  return this._buildDataWithFakeIds(
    $copiedHtml,
    subItems,
    this._getSubItemIdsFrom.bind(this),
    this.setSubItemIdOnSubItem,
  );
}

copyPasteHelper.prototype._buildItemsDataWithFakeIds = function($copiedHtml, items) {
  return this._buildDataWithFakeIds(
    $copiedHtml,
    items,
    this._getItemIdsFrom.bind(this),
    this.setItemIdOnItem,
    true,
  );
}

copyPasteHelper.prototype._buildDataWithFakeIds = function($copiedHtml, items, getIdsFromHtml, setItemIdOnItem, updateSubItemsToo) {
  var itemsWithFakeIds = {};
  var originalIds = getIdsFromHtml($copiedHtml);

  _(originalIds).each(function(originaId) {
    var fakeId = 'fake-' + originaId;
    var originalItem = items[originaId];
    var itemWithFakeId = this._replaceIdOnItemAndSubItems(originalItem, fakeId, setItemIdOnItem, updateSubItemsToo);
    itemsWithFakeIds[fakeId] = itemWithFakeId;

    // replace item id on pad content
    $copiedHtml.find('.' + originaId).removeClass(originaId).addClass(fakeId);
  }, this);

  return itemsWithFakeIds;
}

copyPasteHelper.prototype._replaceIdOnItemAndSubItems = function(item, newId, setItemIdOnItem, updateSubItemsToo) {
  // create a copy of item with new id
  var itemWithReplacedId = Object.assign({}, item);
  setItemIdOnItem(itemWithReplacedId, newId);

  if (updateSubItemsToo && this._itemHasSubItems()) {
    // replace item id on its sub-items
    var subItems = this.getSubItemsOf(itemWithReplacedId);
    _(subItems).each(function(subItem) {
      this.setItemIdOnSubItem(subItem, newId);
    }, this);
  }

  return itemWithReplacedId;
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
  var itemsData = this._buildDataFromClipboard(
    clipboardData,
    this.itemDataTypeOnClipboard,
    this.generateNewItemId,
    this.setItemIdOnItem,
    true,
  );

  var subItemsData;
  if (this._itemHasSubItems()) {
    subItemsData = this._buildDataFromClipboard(
      clipboardData,
      this.subItemDataTypeOnClipboard,
      this.generateNewSubItemId,
      this.setSubItemIdOnSubItem,
    );

    // subItemsData still have fake ids for its items, we need to fix that before saving data
    this._replaceFakeItemIdsOnSubItems(subItemsData);
  }

  this.saveItemsData(itemsData);
  subItemsData && this.saveSubItemsData(subItemsData);
}

copyPasteHelper.prototype._buildDataFromClipboard = function(clipboardData, clipboardDataType, generateNewId, setItemIdOnItem, updateSubItemsToo) {
  var data = {};
  var itemsJSON = clipboardData.getData(clipboardDataType);
  if (itemsJSON) {
    var itemsWithFakeIds = JSON.parse(itemsJSON);
    var itemsWithNewIds = this._replaceFakeIdsWithNewIds(itemsWithFakeIds, generateNewId, setItemIdOnItem, updateSubItemsToo);
    data = itemsWithNewIds;
  }
  return data;
}

copyPasteHelper.prototype._replaceFakeIdsWithNewIds = function(itemsWithFakeIds, generateNewId, setItemIdOnItem, updateSubItemsToo) {
  var itemsWithNewIds = {};

  _(itemsWithFakeIds).each(function(itemWithFakeId, originaFakeId) {
    var newId = generateNewId();
    var itemWithNewId = this._replaceIdOnItemAndSubItems(itemWithFakeId, newId, setItemIdOnItem, updateSubItemsToo);
    itemsWithNewIds[newId] = itemWithNewId;

    // register fake id => new id mapping, to be used when pasted content is collected
    pad.plugins.ep_comments_page.fakeIdsMapper.registerNewMapping(originaFakeId, newId);
  }, this);

  return itemsWithNewIds;
}

copyPasteHelper.prototype._replaceFakeItemIdsOnSubItems = function(subItems) {
  _(subItems).each(function(subItem) {
    var fakeItemId = this.getItemIdOfSubItem(subItem);
    var itemId = pad.plugins.ep_comments_page.fakeIdsMapper.getRealIdOfFakeId(fakeItemId);
    this.setItemIdOnSubItem(subItem, itemId);
  }, this);
}

copyPasteHelper.prototype._itemHasSubItems = function() {
  return !!this.subItemType;
}

/* Possible configs:
   (*): configs only needed if item has sub-items
     itemType
   * subItemType
     itemSelectorOnPad
   * subItemSelectorOnPad
     getItemsData
   * getSubItemsData
     getItemIdsFromString
   * getSubItemIdsFromString
     generateNewItemId
   * generateNewSubItemId
     setItemIdOnItem
   * setSubItemIdOnSubItem
   * setItemIdOnSubItem
   * getItemIdOfSubItem
   * getSubItemsOf
     saveItemsData
   * saveSubItemsData
*/
exports.init = function(configs) {
  var helper = new copyPasteHelper(configs);
  // add configs as helper properties
  return _(helper).extend(configs);
}
