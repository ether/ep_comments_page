var eejs = require('ep_etherpad-lite/node/eejs/');
var settings = require('ep_etherpad-lite/node/utils/Settings');
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

    socket.on('revertChange', function(data, callback) {
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      var padId = data.padId;
      commentManager.changeAcceptedState(padId, data.commentId, false, function(){
        socket.broadcast.to(padId).emit('changeReverted', data.commentId);
      });
    });

    socket.on('acceptChange', function(data, callback) {
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      var padId = data.padId;
      commentManager.changeAcceptedState(padId, data.commentId, true, function(){
        socket.broadcast.to(padId).emit('changeAccepted', data.commentId);
      });
    });

    socket.on('addCommentReply', function (data, callback) {
      var padId = data.padId;
      var content = data.reply;
      var changeTo = data.changeTo || null;
      var changeFrom = data.changeFrom || null;
      var changeAccepted = data.changeAccepted || null;
      var changeReverted = data.changeReverted || null;
      var commentId = data.commentId;
      commentManager.addCommentReply(padId, data, function (err, replyId, reply, changeTo, changeFrom, changeAccepted, changeReverted){
        reply.replyId = replyId;
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply, changeTo, changeFrom, changeAccepted, changeReverted);
        callback(replyId, reply);
      });
    });

    // comment added via API
    socket.on('apiAddComments', function (data) {
      var padId = data.padId;
      var commentIds = data.commentIds;
      var comments = data.comments;

      for (var i = 0, len = commentIds.length; i < len; i++) {
        socket.broadcast.to(padId).emit('pushAddComment', commentIds[i], comments[i]);
      };
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
  args.content = args.content + eejs.require("ep_comments_page/templates/commentIcons.html", {}, module);
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/styles.html", {}, module);
  return cb();
};

exports.clientVars = function (hook, context, cb) {
  var displayCommentAsIcon = settings.ep_comments_page ? settings.ep_comments_page.displayCommentAsIcon : false;
  return cb({ "displayCommentAsIcon": displayCommentAsIcon });
};

exports.expressCreateServer = function (hook_name, args, callback) {
  args.app.get('/p/:pad/:rev?/comments', function(req, res) {
    var fields = req.query;
    // check the api key
    if(!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    comments.getPadComments(padIdReceived, function(err, data) {
      if(err) {
        res.json({code: 2, message: "internal error", data: null});
      } else {
        res.json({code: 0, data: data});
      }
    });
  });

  args.app.post('/p/:pad/:rev?/comments', function(req, res) {
    new formidable.IncomingForm().parse(req, function (err, fields, files) {
      // check the api key
      if(!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if(!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

      // sanitize pad id before continuing
      var padIdReceived = apiUtils.sanitizePadId(req);

      // create data to hold comment information:
      try {
        var data = JSON.parse(fields.data);

        comments.bulkAddPadComments(padIdReceived, data, function(err, commentIds, comments) {
          if(err) {
            res.json({code: 2, message: "internal error", data: null});
          } else {
            broadcastCommentsAdded(padIdReceived, commentIds, comments);
            res.json({code: 0, commentIds: commentIds});
          }
        });
      } catch(e) {
        res.json({code: 1, message: "data must be a JSON", data: null});
      }
    });
  });

  args.app.get('/p/:pad/:rev?/commentReplies', function(req, res){
    //it's the same thing as the formidable's fields
    var fields = req.query;
    // check the api key
    if(!apiUtils.validateApiKey(fields, res)) return;

    //sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    // call the route with the pad id sanitized
    comments.getPadCommentReplies(padIdReceived, function(err, data) {
      if(err) {
        res.json({code: 2, message: "internal error", data:null})
      } else {
        res.json({code: 0, data: data});
      }
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
        comment: comment,
        timestamp: fields.timestamp
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

var broadcastCommentsAdded = function(padId, commentIds, comments) {
  var socket = clientIO.connect(broadcastUrl);

  var data = {
    padId: padId,
    commentIds: commentIds,
    comments: comments
  };

  socket.emit('apiAddComments', data);
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
