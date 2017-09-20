var _ = require('ep_etherpad-lite/static/js/underscore');
var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var readOnlyManager = require("ep_etherpad-lite/node/db/ReadOnlyManager.js");
var shared = require('./static/js/shared');

var _getReadWritePadId = function(padId) {
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };
  return padId;
}

exports.getComments = function (padId, callback)
{
  // We need to change readOnly PadIds to Normal PadIds
  padId = _getReadWritePadId(padId);

  // Not sure if we will encouter race conditions here..  Be careful.

  //get the globalComments
  db.get("comments:" + padId, function(err, comments)
  {
    if(ERR(err, callback)) return;
    //comment does not exists
    if(comments == null) comments = {};
    callback(null, { comments: comments });
  });
};

exports.deleteComments = function (padId, callback)
{
  db.remove('comments:' + padId, function(err)
  {
    if(ERR(err, callback)) return;
    callback(null);
  });
};

exports.addComment = function(padId, data, callback)
{
  exports.bulkAddComments(padId, [data], function(err, commentIds, comments) {
    if(ERR(err, callback)) return;

    if(commentIds && commentIds.length > 0 && comments && comments.length > 0) {
      callback(null, commentIds[0], comments[0]);
    }
  });
};

exports.bulkAddComments = function(padId, data, callback)
{
   // We need to change readOnly PadIds to Normal PadIds
   padId = _getReadWritePadId(padId);

  //get the entry
  db.get("comments:" + padId, function(err, comments) {
    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(comments == null) comments = {};

    var newComments = [];
    var commentIds = _.map(data, function(commentData) {
      //if the comment was copied it already has a commentID, so we don't need create one
      var commentId = commentData.commentId || shared.generateCommentId();

      var comment = {
        "author": commentData.author || "empty",
        "name": commentData.name,
        "text": commentData.text,
        "timestamp": parseInt(commentData.timestamp) || new Date().getTime()
      };
      //add the entry for this pad
      comments[commentId] = comment;

      newComments.push(comment);
      return commentId;
    });

    //save the new element back
    db.set("comments:" + padId, comments);

    callback(null, commentIds, newComments);
  });
};

exports.copyComments = function(originalPadId, newPadID, callback)
{
  //get the comments of original pad
  db.get('comments:' + originalPadId, function(err, originalComments) {
    if(ERR(err, callback)) return;

    var copiedComments = _.mapObject(originalComments, function(thisComment, thisCommentId) {
      // make sure we have different copies of the comment between pads
      return _.clone(thisComment);
    });

    //save the comments on new pad
    db.set('comments:' + newPadID, copiedComments);

    callback(null);
  });
};

exports.getCommentReplies = function (padId, callback){
 // We need to change readOnly PadIds to Normal PadIds
 padId = _getReadWritePadId(padId);

  //get the globalComments replies
  db.get("comment-replies:" + padId, function(err, replies)
  {
    if(ERR(err, callback)) return;
    //replies do not exist
    if(replies == null) replies = {};
    callback(null, { replies: replies });
  });
};

exports.deleteCommentReplies = function (padId, callback){
  db.remove('comment-replies:' + padId, function(err)
  {
    if(ERR(err, callback)) return;
    callback(null);
  });
};

exports.addCommentReply = function(padId, data, callback){
  exports.bulkAddCommentReplies(padId, [data], function(err, replyIds, replies) {
    if(ERR(err, callback)) return;

    if(replyIds && replyIds.length > 0 && replies && replies.length > 0) {
      callback(null, replyIds[0], replies[0]);
    }
  });
};

exports.bulkAddCommentReplies = function(padId, data, callback){
  // We need to change readOnly PadIds to Normal PadIds
  padId = _getReadWritePadId(padId);

  //get the entry
  db.get("comment-replies:" + padId, function(err, replies){
    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(replies == null) replies = {};

    var newReplies = [];
    var replyIds = _.map(data, function(replyData) {
      //create the new reply id if necessary
      var replyId = replyData.replyId || "cr-" + randomString(16);

      metadata = replyData.comment || {};

      var reply = {
        "commentId"  : replyData.commentId,
        "text"       : replyData.reply               || replyData.text,
        "author"     : metadata.author               || replyData.author || "empty",
        "name"       : metadata.name                 || replyData.name,
        "timestamp"  : parseInt(replyData.timestamp) || new Date().getTime()
      };

      //add the entry for this pad
      replies[replyId] = reply;

      newReplies.push(reply);
      return replyId;
    });

    //save the new element back
    db.set("comment-replies:" + padId, replies);

    callback(null, replyIds, newReplies);
  });
};

exports.copyCommentReplies = function(originalPadId, newPadID, callback){
  //get the replies of original pad
  db.get('comment-replies:' + originalPadId, function(err, originalReplies){
    if(ERR(err, callback)) return;

    var copiedReplies = _.mapObject(originalReplies, function(thisReply, thisReplyId) {
      // make sure we have different copies of the reply between pads
      return _.clone(thisReply);
    });

    //save the comment replies on new pad
    db.set('comment-replies:' + newPadID, copiedReplies);

    callback(null);
  });
};

exports.changeCommentText = function(padId, commentId, commentText, callback){
  var commentTextIsNotEmpty = (commentText || '').length > 0;
  if(commentTextIsNotEmpty){
    // Given a comment we update the comment text
    // We need to change readOnly PadIds to Normal PadIds
    padId = _getReadWritePadId(padId);

    // If we're dealing with comment replies we need to a different query
    var prefix = "comments:";
    if(commentId.startsWith("cr")){
      prefix = "comment-replies:";
    }


    //get the entry
    db.get(prefix + padId, function(err, comments){
      if(ERR(err, callback)) return;

      //update the comment text
      comments[commentId].text = commentText;

      //save the comment updated back
      db.set(prefix + padId, comments);

      callback(null);
    });
  }else{// don't save comment text blank
    callback(true);
  }
}
