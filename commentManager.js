var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;

exports.getComments = function (padId, callback)
{
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
      "timestamp": new Date().getTime()
    };

    //add the entry for this pad
    comments[commentId] = comment;

    //save the new element back
    db.set("comments:" + padId, comments);

    callback(null, commentId, comment);
  });
};

exports.getCommentReplies = function (padId, callback)
{
  console.warn("Loading comment replies for ", padId);
  console.warn("TO DO is support for getting specific comment ID replies");
  //get the globalComments replies
  db.get("comment-replies:" + padId, function(err, replies)
  {
    if(ERR(err, callback)) return;
    //comment does not exists
    if(replies == null) replies = {};
    // console.warn("Sending replies", replies);
    callback(null, { replies: replies });
  });
};


exports.addCommentReply = function(padId, data, callback)
{
  //create the new reply replyid
  var replyId = "c-reply-" + randomString(16);

  //get the entry
  db.get("comment-replies:" + padId, function(err, replies){

    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(replies == null) replies = {};

    console.warn("this should be populated", data);
    metadata = data.comment;

    var reply = {
      "commentId": data.commentId,
      "text": data.reply,
      "author": metadata.author,
      "name": metadata.name,
      "timestamp": new Date().getTime()
    };

    //add the entry for this pad
    replies[replyId] = reply;
    // console.warn("writing reply to DB", padId, replies);
    //save the new element back
    db.set("comment-replies:" + padId, replies);

    callback(null, replyId, reply);
  });
};

