var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var readOnlyManager = require("ep_etherpad-lite/node/db/ReadOnlyManager.js");

exports.getComments = function (padId, callback)
{
  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

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

exports.addComment = function(padId, data, callback)
{
 // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  //create the new comment
  var commentId = "c-" + randomString(16);

  //get the entry
  db.get("comments:" + padId, function(err, comments){

    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(comments == null) comments = {};

    var comment = {
      "author": data.author,
      "name": data.name,
      "text": data.text,
      "changeTo": data.changeTo,
      "changeFrom": data.changeFrom,
      "timestamp": data.timestamp || new Date().getTime()
    };
    //add the entry for this pad
    comments[commentId] = comment;

    //save the new element back
    db.set("comments:" + padId, comments);

    callback(null, commentId, comment);
  });
};

exports.getCommentReplies = function (padId, callback){
 // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  //get the globalComments replies
  db.get("comment-replies:" + padId, function(err, replies)
  {
    if(ERR(err, callback)) return;
    //comment does not exists
    if(replies == null) replies = {};
    callback(null, { replies: replies });
  });
};


exports.addCommentReply = function(padId, data, callback){
  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  //create the new reply replyid
  var replyId = "c-reply-" + randomString(16);

  //get the entry
  db.get("comment-replies:" + padId, function(err, replies){

    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(replies == null) replies = {};

    metadata = data.comment;

    var reply = {
      "commentId": data.commentId,
      "text": data.reply,
      "changeTo": data.changeTo || null,
      "changeFrom": data.changeFrom || null,
      "author": metadata.author,
      "name": metadata.name,
      "timestamp": data.timestamp || new Date().getTime()
    };

    //add the entry for this pad
    replies[replyId] = reply;
    //save the new element back
    db.set("comment-replies:" + padId, replies);

    callback(null, replyId, reply);
  });
};

exports.changeAcceptedState = function(padId, commentId, state, callback){
  // Given a comment we update that comment to say the change was accepted or reverted

  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  // If we're dealing with comment replies we need to a different query
  var prefix = "comments:";
  if(commentId.substring(0,7) === "c-reply"){
    prefix = "comment-replies:";
  }

  //get the entry
  db.get(prefix + padId, function(err, comments){

    if(ERR(err, callback)) return;

    //add the entry for this pad
    var comment = comments[commentId];

    if(state){
      comment.changeAccepted = true;
      comment.changeReverted = false;
    }else{
      comment.changeAccepted = false;
      comment.changeReverted = true;
    }

    comments[commentId] = comment;

    //save the new element back
    db.set(prefix + padId, comments);

    callback(null, commentId, comment);
  });
}

