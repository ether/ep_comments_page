var eejs = require('ep_etherpad-lite/node/eejs/');
var formidable = require('formidable');
var clientIO = require('socket.io-client');
var commentManager = require('./commentManager');
var comments = require('./comments');
var apiUtils = require('./apiUtils');

exports.handleMessageSecurity = function(hook_name, context, callback){
  if(context.message && context.message.data && context.message.data.apool){
    var apool = context.message.data.apool;
    if(apool.numToAttrib && apool.numToAttrib[0] && apool.numToAttrib[0][0]){
      if(apool.numToAttrib[0][0] === "comment"){
        // Comment change, allow it to override readonly security model!!

        var sandstormPermissions =
            context.client.request.headers["x-sandstorm-permissions"];
        if(sandstormPermissions !== undefined){
          // We're running on Sandstorm (or we're *not* on Sandstorm but for
          // some reason the client has forged a Sandstorm permissions header).
          // If the header doesn't indicate commenting is allowed, then do
          // *not* permit the message through. (Since this strictly reduces
          // the client's permissions, it's not a problem for this code to
          // run even when not on Sandstorm.)
          if(sandstormPermissions.split(",").indexOf("comment") === -1){
            callback();
            return;
          }
        }

        callback(true);
      }else{
        callback();
      }
    }else{
      callback();
    }
  }else{
    callback();
  }
};

exports.socketio = function (hook_name, args, cb){
  var app = args.app;
  var io = args.io;
  var pushComment;
  var padComment = io;

  var commentSocket = io
  .of('/comment')
  .on('connection', function (socket) {

    // Join the rooms
    socket.on('getComments', function (data, callback) {
      var padId = data.padId;
      socket.join(padId);
      commentManager.getComments(padId, function (err, comments){
        callback(comments);
      });
    });

    socket.on('getCommentReplies', function (data, callback) {
      var padId = data.padId;
      commentManager.getCommentReplies(padId, function (err, replies){
        callback(replies);
      });
    });

    // On add events
    socket.on('addComment', function (data, callback) {
      var padId = data.padId;
      var content = data.comment;
      commentManager.addComment(padId, content, function (err, commentId, comment){
        socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        callback(commentId, comment);
      });
    });

    socket.on('addCommentReply', function (data, callback) {
      var padId = data.padId;
      var content = data.reply;
      var changeTo = data.changeTo || null;
      var commentId = data.commentId;
      commentManager.addCommentReply(padId, data, function (err, replyId, reply, changeTo){
        reply.replyId = replyId;
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply, changeTo);
        callback(replyId, reply);
      });
    });

    // comment added via API
    socket.on('apiAddComment', function (data) {
      var padId = data.padId;
      var commentId = data.commentId;
      var comment = data.comment;

      socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
    });

    // comment reply added via API
    socket.on('apiAddCommentReply', function (data) {
      var padId = data.padId;
      var replyId = data.replyId;
      var reply = data.reply;

      reply.replyId = replyId;
      socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
    });

  });
};

exports.eejsBlock_dd_insert = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/menuButtons.ejs");
  return cb();
};

exports.eejsBlock_mySettings = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/settings.ejs");
  return cb();
};

exports.eejsBlock_editbarMenuLeft = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/commentBarButtons.ejs");
  return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/comments.html", {}, module);
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/styles.html", {}, module);
  return cb();
};

exports.expressCreateServer = function (hook_name, args, callback) {
  args.app.post('/p/:pad/:rev?/comments', function(req, res) {
    new formidable.IncomingForm().parse(req, function (err, fields, files) {
      // check the api key
      if(!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if(!apiUtils.validateRequiredFields(fields, ['name', 'text'], res)) return;

      // sanitize pad id before continuing
      var padIdReceived = apiUtils.sanitizePadId(req);

      // create data to hold comment information:
      var data = {
        author: "empty",
        name: fields.name,
        text: fields.text,
        changeTo: fields.changeTo
      };

      comments.addPadComment(padIdReceived, data, function(err, commentId, comment) {
        if(err) {
          res.json({code: 2, message: "internal error", data: null});
        } else {
          broadcastCommentAdded(padIdReceived, commentId, comment);
          res.json({code: 0, commentId: commentId});
        }
      });
    });
  });

  args.app.post('/p/:pad/:rev?/commentReplies', function(req, res) {
    new formidable.IncomingForm().parse(req, function (err, fields, files) {
      // check the api key
      if(!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if(!apiUtils.validateRequiredFields(fields, ['commentId', 'name', 'text'], res)) return;

      // sanitize pad id before continuing
      var padIdReceived = apiUtils.sanitizePadId(req);

      // create data to hold comment reply information:
      var comment = {
        name: fields.name
      };
      var data = {
        author: "empty",
        commentId: fields.commentId,
        reply: fields.text,
        comment: comment
      };

      comments.addPadCommentReply(padIdReceived, data, function(err, replyId, reply) {
        if(err) {
          res.json({code: 2, message: "internal error", data: null});
        } else {
          broadcastCommentReplyAdded(padIdReceived, replyId, reply);
          res.json({code: 0, replyId: replyId});
        }
      });
    });
  });

}

var broadcastCommentAdded = function(padId, commentId, comment) {
  var socket = clientIO.connect(broadcastUrl);

  var data = {
    padId: padId,
    commentId: commentId,
    comment: comment
  };

  socket.emit('apiAddComment', data);
}

var broadcastCommentReplyAdded = function(padId, replyId, reply) {
  var socket = clientIO.connect(broadcastUrl);

  var data = {
    padId: padId,
    replyId: replyId,
    reply: reply
  };

  socket.emit('apiAddCommentReply', data);
}

var broadcastUrl = apiUtils.broadcastUrlFor("/comment");
