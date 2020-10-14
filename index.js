/* global exports, require */

var eejs = require('ep_etherpad-lite/node/eejs/');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var formidable = require('ep_etherpad-lite/node_modules/formidable');
var commentManager = require('./commentManager');
var apiUtils = require('./apiUtils');
var _ = require('ep_etherpad-lite/static/js/underscore');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager.js');

let io;

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
  io = args.io.of('/comment');
  io.on('connection', (socket) => {

    // Join the rooms
    socket.on('getComments', async (data, respond) => {
      // Don't translate a read-only pad ID to a normal pad ID here. This makes it possible to
      // control which messages get sent to read-only users vs. normal users.
      socket.join(data.padId);
      const {padId} = await readOnlyManager.getIds(data.padId);
      // This, however, should use the normal pad ID because that's what commentManager expects.
      respond(await commentManager.getComments(padId));
    });

    socket.on('getCommentReplies', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      respond(await commentManager.getCommentReplies(padId));
    });

    // On add events
    socket.on('addComment', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      var content = data.comment;
      const [commentId, comment] = await commentManager.addComment(padIds.padId, content);
      if (commentId != null && comment != null) {
        [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
          socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        });
        respond(commentId, comment);
      }
    });

    socket.on('deleteComment', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      // delete the comment on the database
      await commentManager.deleteComment(padIds.padId, data.commentId);
      // Broadcast to all other users that this comment was deleted
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('commentDeleted', data.commentId);
      });
    });

    socket.on('revertChange', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padIds.padId, data.commentId, false);
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('changeReverted', data.commentId);
      });
    });

    socket.on('acceptChange', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padIds.padId, data.commentId, true);
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('changeAccepted', data.commentId);
      });
    });

    socket.on('bulkAddComment', async (padId, data, respond) => {
      const padIds = await readOnlyManager.getIds(padId);
      const [commentIds, comments] = await commentManager.bulkAddComments(padIds.padId, data);
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('pushAddCommentInBulk');
      });
      respond(_.object(commentIds, comments)); // {c-123:data, c-124:data}
    });

    socket.on('bulkAddCommentReplies', async (padId, data, respond) => {
      const padIds = await readOnlyManager.getIds(padId);
      const [repliesId, replies] = await commentManager.bulkAddCommentReplies(padIds.padId, data);
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('pushAddCommentReply', repliesId, replies);
      });
      respond(_.zip(repliesId, replies));
    });

    socket.on('updateCommentText', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      // Broadcast to all other users that the comment text was changed.
      // Note that commentId here can either be the commentId or replyId..
      var commentId = data.commentId;
      var commentText = data.commentText;
      const failed = await commentManager.changeCommentText(padIds.padId, commentId, commentText);
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        if (!failed) socket.broadcast.to(padId).emit('textCommentUpdated', commentId, commentText);
      });
      respond(failed);
    });

    socket.on('addCommentReply', async (data, respond) => {
      const padIds = await readOnlyManager.getIds(data.padId);
      const [replyId, reply] = await commentManager.addCommentReply(padIds.padId, data);
      reply.replyId = replyId;
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
      });
      respond(replyId, reply);
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
    // Get the normal pad ID in case padIdReceived is a read-only pad ID.
    const {padId} = await readOnlyManager.getIds(padIdReceived);

    let data;
    try {
      // Use the normal pad ID here because that's what commentManager expects.
      data = await commentManager.getComments(padId);
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
    // Get the normal pad ID in case padIdReceived is a read-only pad ID.
    const padIds = await readOnlyManager.getIds(padIdReceived);

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
      // Use the normal pad ID here because that's what commentManager expects.
      [commentIds, comments] = await commentManager.bulkAddComments(padIds.padId, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: "internal error", data: null});
      return;
    }
    if (commentIds == null) return;
    for (let i = 0; i < commentIds.length; i++) {
      [padIds.padId, padIds.readOnlyPadId].forEach(padId) => {
        io.to(padId).emit('pushAddComment', commentIds[i], comments[i]);
      });
    }
    res.json({code: 0, commentIds: commentIds});
  });

  args.app.get('/p/:pad/:rev?/commentReplies', async (req, res) => {
    //it's the same thing as the formidable's fields
    var fields = req.query;
    // check the api key
    if(!apiUtils.validateApiKey(fields, res)) return;

    //sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);
    // Get the normal pad ID in case padIdReceived is a read-only pad ID.
    const {padId} = await readOnlyManager.getIds(padIdReceived);

    // call the route with the pad id sanitized
    let data;
    try {
      // Use the normal pad ID here because that's what commentManager expects.
      data = await commentManager.getCommentReplies(padId);
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
    // Get the normal pad ID in case padIdReceived is a read-only pad ID.
    const padIds = await readOnlyManager.getIds(padIdReceived);

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
      // Use the normal pad ID here because that's what commentManager expects.
      [replyIds, replies] = await commentManager.bulkAddCommentReplies(padIds.padId, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: "internal error", data: null});
      return;
    }
    if (replyIds == null) return;
    for (let i = 0; i < replyIds.length; i++) {
      replies[i].replyId = replyIds[i];
      [padIds.padId, padIds.readOnlyPadId].forEach((padId) => {
        io.to(padId).emit('pushAddCommentReply', replyIds[i], replies[i]);
      });
    }
    res.json({code: 0, replyIds: replyIds});
  });
  return callback();
}
