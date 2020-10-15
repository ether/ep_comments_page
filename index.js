/* global exports, require */

var eejs = require('ep_etherpad-lite/node/eejs/');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var formidable = require('ep_etherpad-lite/node_modules/formidable');
var clientIO = require('ep_etherpad-lite/node_modules/socket.io-client');
var commentManager = require('./commentManager');
var apiUtils = require('./apiUtils');
var _ = require('ep_etherpad-lite/static/js/underscore');

exports.padRemove = async (hookName, context) => {
  await Promise.all([
    commentManager.deleteCommentReplies(context.padID),
    commentManager.deleteComments(context.padID),
  ]);
};

exports.padCopy = async (hookName, context) => {
  await Promise.all([
    commentManager.copyComments(context.originalPad.id, context.destinationID),
    commentManager.copyCommentReplies(context.originalPad.id, context.destinationID),
  ]);
};

exports.handleMessageSecurity = function(hook_name, context, callback){
  const {message: {data: {apool} = {}} = {}} = context;
  if (apool && apool[0] && apool[0][0] === 'comment') {
    // Comment change, allow it to override readonly security model!!
    return callback(true);
  }
  return callback();
};

exports.socketio = function (hook_name, args, cb){
  const io = args.io.of('/comment');
  io.on('connection', (socket) => {

    // Join the rooms
    socket.on('getComments', async (data, respond) => {
      const padId = data.padId;
      socket.join(padId);
      respond(await commentManager.getComments(padId));
    });

    socket.on('getCommentReplies', async (data, respond) => {
      respond(await commentManager.getCommentReplies(data.padId));
    });

    // On add events
    socket.on('addComment', async (data, respond) => {
      var padId = data.padId;
      var content = data.comment;
      const [commentId, comment] = await commentManager.addComment(padId, content);
      if (commentId != null && comment != null) {
        socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        respond(commentId, comment);
      }
    });

    socket.on('deleteComment', async (data, respond) => {
      // delete the comment on the database
      await commentManager.deleteComment(data.padId, data.commentId);
      // Broadcast to all other users that this comment was deleted
      socket.broadcast.to(data.padId).emit('commentDeleted', data.commentId);
    });

    socket.on('revertChange', async (data, respond) => {
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      var padId = data.padId;
      await commentManager.changeAcceptedState(padId, data.commentId, false);
      socket.broadcast.to(padId).emit('changeReverted', data.commentId);
    });

    socket.on('acceptChange', async (data, respond) => {
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      var padId = data.padId;
      await commentManager.changeAcceptedState(padId, data.commentId, true);
      socket.broadcast.to(padId).emit('changeAccepted', data.commentId);
    });

    socket.on('bulkAddComment', async (padId, data, respond) => {
      const [commentIds, comments] = await commentManager.bulkAddComments(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentInBulk');
      respond(_.object(commentIds, comments)); // {c-123:data, c-124:data}
    });

    socket.on('bulkAddCommentReplies', async (padId, data, respond) => {
      const [repliesId, replies] = await commentManager.bulkAddCommentReplies(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentReply', repliesId, replies);
      respond(_.zip(repliesId, replies));
    });

    socket.on('updateCommentText', async (data, respond) => {
      // Broadcast to all other users that the comment text was changed.
      // Note that commentId here can either be the commentId or replyId..
      var padId = data.padId;
      var commentId = data.commentId;
      var commentText = data.commentText;
      const failed = await commentManager.changeCommentText(padId, commentId, commentText);
      if (!failed) socket.broadcast.to(padId).emit('textCommentUpdated', commentId, commentText);
      respond(failed);
    });

    socket.on('addCommentReply', async (data, respond) => {
      const padId = data.padId;
      const [replyId, reply] = await commentManager.addCommentReply(padId, data);
      reply.replyId = replyId;
      socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
      respond(replyId, reply);
    });

    // comment added via API
    socket.on('apiAddComments', function (data) {
      var padId = data.padId;
      var commentIds = data.commentIds;
      var comments = data.comments;

      for (var i = 0, len = commentIds.length; i < len; i++) {
        socket.broadcast.to(padId).emit('pushAddComment', commentIds[i], comments[i]);
      }
    });

    // comment reply added via API
    socket.on('apiAddCommentReplies', function (data) {
      var padId = data.padId;
      var replyIds = data.replyIds;
      var replies = data.replies;

      for (var i = 0, len = replyIds.length; i < len; i++) {
        var reply = replies[i];
        var replyId = replyIds[i];
        reply.replyId = replyId;
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
      }
    });

  });
  return cb();
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
  args.content = args.content + eejs.require("ep_comments_page/templates/comments.html");
  args.content = args.content + eejs.require("ep_comments_page/templates/commentIcons.html");
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_comments_page/templates/styles.html");
  return cb();
};

exports.clientVars = function (hook, context, cb) {
  var displayCommentAsIcon = settings.ep_comments_page ? settings.ep_comments_page.displayCommentAsIcon : false;
  var highlightSelectedText = settings.ep_comments_page ? settings.ep_comments_page.highlightSelectedText : false;
  return cb({
    "displayCommentAsIcon": displayCommentAsIcon,
    "highlightSelectedText": highlightSelectedText,
  });
};

exports.expressCreateServer = function (hook_name, args, callback) {
  args.app.get('/p/:pad/:rev?/comments', async (req, res) => {
    var fields = req.query;
    // check the api key
    if(!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    let data;
    try {
      data = await commentManager.getComments(padIdReceived);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: 'internal error', data: null});
      return;
    }
    if (data == null) return;
    res.json({code: 0, data});
  });

  args.app.post('/p/:pad/:rev?/comments', async (req, res) => {
    const [fields, files] = await new Promise((resolve, reject) => {
      (new formidable.IncomingForm()).parse(req, (err, fields, files) => {
        if (err != null) return reject(err);
        resolve([fields, files]);
      });
    });

    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // check required fields from comment data
    if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

    // sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    // create data to hold comment information:
    let data;
    try {
      data = JSON.parse(fields.data);
    } catch (err) {
      res.json({code: 1, message: "data must be a JSON", data: null});
      return;
    }

    let commentIds, comments;
    try {
      [commentIds, comments] = await commentManager.bulkAddComments(padIdReceived, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: "internal error", data: null});
      return;
    }
    if (commentIds == null) return;
    broadcastCommentsAdded(padIdReceived, commentIds, comments);
    res.json({code: 0, commentIds: commentIds});
  });

  args.app.get('/p/:pad/:rev?/commentReplies', async (req, res) => {
    //it's the same thing as the formidable's fields
    var fields = req.query;
    // check the api key
    if(!apiUtils.validateApiKey(fields, res)) return;

    //sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    // call the route with the pad id sanitized
    let data;
    try {
      data = await commentManager.getCommentReplies(padIdReceived);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: "internal error", data:null});
      return;
    }
    if (data == null) return;
    res.json({code: 0, data: data});
  });

  args.app.post('/p/:pad/:rev?/commentReplies', async (req, res) => {
    const [fields, files] = await new Promise((resolve, reject) => {
      (new formidable.IncomingForm()).parse(req, (err, fields, files) => {
        if (err != null) return reject(err);
        resolve([fields, files]);
      });
    });

    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // check required fields from comment data
    if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

    // sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    // create data to hold comment reply information:
    let data;
    try {
        data = JSON.parse(fields.data);
    } catch (err) {
      res.json({code: 1, message: "data must be a JSON", data: null});
      return;
    }

    let replyIds, replies;
    try {
      [replyIds, replies] = await commentManager.bulkAddCommentReplies(padIdReceived, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: "internal error", data: null});
      return;
    }
    if (replyIds == null) return;
    broadcastCommentRepliesAdded(padIdReceived, replyIds, replies);
    res.json({code: 0, replyIds: replyIds});
  });
  return callback();
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

var broadcastCommentRepliesAdded = function(padId, replyIds, replies) {
  var socket = clientIO.connect(broadcastUrl);

  var data = {
    padId: padId,
    replyIds: replyIds,
    replies: replies
  };

  socket.emit('apiAddCommentReplies', data);
}

var broadcastUrl = apiUtils.broadcastUrlFor("/comment");
