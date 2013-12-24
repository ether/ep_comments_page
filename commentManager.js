
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

    /*var comments = [];
    var jsonComments = globalComments.comments;
    for (var commentId in jsonComments)
    {
      comments[commentId] = jsonComments;
    }*/
    
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