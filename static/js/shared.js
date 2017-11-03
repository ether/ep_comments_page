var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var preTextMarker = require('./preTextMarker');

var COMMENT_PREFIX = 'c-';
var REPLY_PREFIX = 'cr-';

exports.FAKE_ID_PREFIX = 'fake-';
var FAKE_ID_PREFIX = exports.FAKE_ID_PREFIX;

exports.collectContentPre = function(hook, context){
  collectAttribFrom(context, REPLY_PREFIX, 'comment-reply-');

  var commentIds = getIdsFrom(context.cls, COMMENT_PREFIX);
  if (commentIds.length > 0) {
    // FIXME allow more than one comment on each segment
    // there can be only one comment on each text segment
    context.cc.doAttrib(context.state, 'comment::' + commentIds[0]);
  }

  if (pad && pad.preTextMarkers) {
    preTextMarker.processCollectContentPre(context);
  }
};

exports.getIdsFrom = function(str, classPrefix) {
  // ex: regex = /(?:^| |fake-)(cr-[A-Za-z0-9]*)/g
  var regex = new RegExp('(?:^| |' + FAKE_ID_PREFIX + ')(' + classPrefix + '[A-Za-z0-9]*)', 'g');

  var ids = (str || '').match(regex) || [];

  // replace fake ids with the real ones
  ids = _(ids).map(function(id) {
    var cleanId = id.trim();
    if (cleanId.startsWith(FAKE_ID_PREFIX)) {
      // make sure fake id mapper is ready to be used
      if ((((pad || {}).plugins || {}).ep_comments_page || {}).fakeIdsMapper) {
        cleanId = pad.plugins.ep_comments_page.fakeIdsMapper.getRealIdOfFakeId(cleanId);
      }
    }
    return cleanId;
  });

  return ids;
}
var getIdsFrom = exports.getIdsFrom;

exports.collectAttribFrom = function(context, classPrefix, attribPrefix) {
  attribPrefix = attribPrefix || '';

  var ids = getIdsFrom(context.cls, classPrefix);

  // there might be more than one attrib id on the same text segment
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var attribName = attribPrefix + id;
    var attribValue = id;
    context.cc.doAttrib(context.state, attribName + '::' + attribValue);
  }
}
var collectAttribFrom = exports.collectAttribFrom;

exports.getCommentIdsFrom = function(str) {
  return getIdsFrom(str, COMMENT_PREFIX);
}

exports.getReplyIdsFrom = function(str) {
  return getIdsFrom(str, REPLY_PREFIX);
}

exports.generateCommentId = function(){
  return COMMENT_PREFIX + randomString(16);
}

exports.generateReplyId = function(){
  return REPLY_PREFIX + randomString(16);
}
