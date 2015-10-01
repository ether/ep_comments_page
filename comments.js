
var commentManager = require('./commentManager');
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");

function padExists(padID){
  padManager.doesPadExists(padID, function(err, exists){
    return exists;
  });
}

exports.getPadComments = function(padID, callback)
{
  commentManager.getComments(padID, function (err, padComments)
  {
    if(ERR(err, callback)) return;

    if(padComments !== null) callback(null, padComments);
  });
};

exports.getPadCommentReplies = function(padID, callback)
{
  commentManager.getCommentReplies(padID, function (err, padCommentReplies)
  {
    if(ERR(err, callback)) return;

    if(padCommentReplies !== null) callback(null, padCommentReplies);
  });
};

exports.addPadComment = function(padID, data, callback)
{
  commentManager.addComment(padID, data, function (err, commentID, comment)
  {
    if(ERR(err, callback)) return;

    if(commentID !== null) callback(null, commentID, comment);
  });
};

exports.bulkAddPadComments = function(padID, data, callback)
{
  commentManager.bulkAddComments(padID, data, function (err, commentIDs, comments)
  {
    if(ERR(err, callback)) return;

    if(commentIDs !== null) callback(null, commentIDs, comments);
  });
};

exports.addPadCommentReply = function(padID, data, callback)
{
  commentManager.addCommentReply(padID, data, function (err, replyID, reply)
  {
    if(ERR(err, callback)) return;

    if(replyID !== null) callback(null, replyID, reply);
  });
};