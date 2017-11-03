var copyPasteFakeIdsMapper = function() {
  this.fakeIdToRealIdMap = {};
};

copyPasteFakeIdsMapper.prototype.registerNewMapping = function(fakeId, realId) {
  this.fakeIdToRealIdMap[fakeId] = realId;
}

copyPasteFakeIdsMapper.prototype.getRealIdOfFakeId = function(fakeId) {
  return this.fakeIdToRealIdMap[fakeId];
}

exports.init = function() {
  return new copyPasteFakeIdsMapper();
}
