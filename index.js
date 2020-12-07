'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const formidable = require('ep_etherpad-lite/node_modules/formidable');
const commentManager = require('./commentManager');
const apiUtils = require('./apiUtils');
const _ = require('ep_etherpad-lite/static/js/underscore');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager.js');

let io;

exports.exportEtherpadAdditionalContent = (hookName, context, callback) => callback(['comments']);

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

exports.handleMessageSecurity = (hookName, context, callback) => {
  const {message: {data: {apool} = {}} = {}} = context;
  if (apool && apool[0] && apool[0][0] === 'comment') {
    // Comment change, allow it to override readonly security model!!
    return callback(true);
  }
  return callback();
};

exports.socketio = (hookName, args, cb) => {
  io = args.io.of('/comment');
  io.on('connection', (socket) => {
    // Join the rooms
    socket.on('getComments', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      // Put read-only and read-write users in the same socket.io "room" so that they can see each
      // other's updates.
      socket.join(padId);
      respond(await commentManager.getComments(padId));
    });

    socket.on('getCommentReplies', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      respond(await commentManager.getCommentReplies(padId));
    });

    // On add events
    socket.on('addComment', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      const content = data.comment;
      const [commentId, comment] = await commentManager.addComment(padId, content);
      if (commentId != null && comment != null) {
        socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        respond(commentId, comment);
      }
    });

    socket.on('deleteComment', async (data, respond) => {
      try {
        const {padId} = await readOnlyManager.getIds(data.padId);
        await commentManager.deleteComment(padId, data.commentId, data.authorId);
        socket.broadcast.to(padId).emit('commentDeleted', data.commentId);
        respond('');
      } catch (err) {
        respond(err.message || err.toString());
      }
    });

    socket.on('revertChange', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padId, data.commentId, false);
      socket.broadcast.to(padId).emit('changeReverted', data.commentId);
    });

    socket.on('acceptChange', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padId, data.commentId, true);
      socket.broadcast.to(padId).emit('changeAccepted', data.commentId);
    });

    socket.on('bulkAddComment', async (padId, data, respond) => {
      padId = (await readOnlyManager.getIds(padId)).padId;
      const [commentIds, comments] = await commentManager.bulkAddComments(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentInBulk');
      respond(_.object(commentIds, comments)); // {c-123:data, c-124:data}
    });

    socket.on('bulkAddCommentReplies', async (padId, data, respond) => {
      padId = (await readOnlyManager.getIds(padId)).padId;
      const [repliesId, replies] = await commentManager.bulkAddCommentReplies(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentReply', repliesId, replies);
      respond(_.zip(repliesId, replies));
    });

    socket.on('updateCommentText', async (data, respond) => {
      try {
        const {commentId, commentText, authorId} = data;
        const {padId} = await readOnlyManager.getIds(data.padId);
        await commentManager.changeCommentText(padId, commentId, commentText, authorId);
        socket.broadcast.to(padId).emit('textCommentUpdated', commentId, commentText);
        respond('');
      } catch (err) {
        respond(err.message || err.toString());
      }
    });

    socket.on('addCommentReply', async (data, respond) => {
      const {padId} = await readOnlyManager.getIds(data.padId);
      const [replyId, reply] = await commentManager.addCommentReply(padId, data);
      reply.replyId = replyId;
      socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
      respond(replyId, reply);
    });
  });
  return cb();
};

exports.eejsBlock_dd_insert = (hookName, args, cb) => {
  args.content += eejs.require('ep_comments_page/templates/menuButtons.ejs');
  return cb();
};

exports.eejsBlock_mySettings = (hookName, args, cb) => {
  args.content += eejs.require('ep_comments_page/templates/settings.ejs');
  return cb();
};

exports.padInitToolbar = (hookName, args, cb) => {
  const toolbar = args.toolbar;

  const button = toolbar.button({
    command: 'addComment',
    localizationId: 'ep_comments_page.add_comment.title',
    class: 'buttonicon buttonicon-comment-medical',
  });

  toolbar.registerButton('addComment', button);

  return cb();
};

exports.eejsBlock_editbarMenuLeft = (hookName, args, cb) => {
  // check if custom button is used
  if (JSON.stringify(settings.toolbar).indexOf('addComment') > -1) {
    return cb();
  }
  args.content += eejs.require('ep_comments_page/templates/commentBarButtons.ejs');
  return cb();
};

exports.eejsBlock_scripts = (hookName, args, cb) => {
  args.content += eejs.require('ep_comments_page/templates/comments.html');
  args.content += eejs.require('ep_comments_page/templates/commentIcons.html');
  return cb();
};

exports.eejsBlock_styles = (hookName, args, cb) => {
  args.content += eejs.require('ep_comments_page/templates/styles.html');
  return cb();
};

exports.clientVars = (hook, context, cb) => {
  const displayCommentAsIcon =
    settings.ep_comments_page ? settings.ep_comments_page.displayCommentAsIcon : false;
  const highlightSelectedText =
    settings.ep_comments_page ? settings.ep_comments_page.highlightSelectedText : false;
  return cb({
    displayCommentAsIcon,
    highlightSelectedText,
  });
};

exports.expressCreateServer = (hookName, args, callback) => {
  args.app.get('/p/:pad/:rev?/comments', async (req, res) => {
    const fields = req.query;
    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    const padIdReceived = (await readOnlyManager.getIds(apiUtils.sanitizePadId(req))).padId;

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
    const fields = await new Promise((resolve, reject) => {
      (new formidable.IncomingForm()).parse(req, (err, fields) => {
        if (err != null) return reject(err);
        resolve(fields);
      });
    });

    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // check required fields from comment data
    if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

    // sanitize pad id before continuing
    const padIdReceived = (await readOnlyManager.getIds(apiUtils.sanitizePadId(req))).padId;

    // create data to hold comment information:
    let data;
    try {
      data = JSON.parse(fields.data);
    } catch (err) {
      res.json({code: 1, message: 'data must be a JSON', data: null});
      return;
    }

    let commentIds, comments;
    try {
      [commentIds, comments] = await commentManager.bulkAddComments(padIdReceived, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: 'internal error', data: null});
      return;
    }
    if (commentIds == null) return;
    for (let i = 0; i < commentIds.length; i++) {
      io.to(padIdReceived).emit('pushAddComment', commentIds[i], comments[i]);
    }
    res.json({code: 0, commentIds});
  });

  args.app.get('/p/:pad/:rev?/commentReplies', async (req, res) => {
    // it's the same thing as the formidable's fields
    const fields = req.query;
    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    const padIdReceived = (await readOnlyManager.getIds(apiUtils.sanitizePadId(req))).padId;

    // call the route with the pad id sanitized
    let data;
    try {
      data = await commentManager.getCommentReplies(padIdReceived);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: 'internal error', data: null});
      return;
    }
    if (data == null) return;
    res.json({code: 0, data});
  });

  args.app.post('/p/:pad/:rev?/commentReplies', async (req, res) => {
    const fields = await new Promise((resolve, reject) => {
      (new formidable.IncomingForm()).parse(req, (err, fields) => {
        if (err != null) return reject(err);
        resolve(fields);
      });
    });

    // check the api key
    if (!apiUtils.validateApiKey(fields, res)) return;

    // check required fields from comment data
    if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

    // sanitize pad id before continuing
    const padIdReceived = (await readOnlyManager.getIds(apiUtils.sanitizePadId(req))).padId;

    // create data to hold comment reply information:
    let data;
    try {
      data = JSON.parse(fields.data);
    } catch (err) {
      res.json({code: 1, message: 'data must be a JSON', data: null});
      return;
    }

    let replyIds, replies;
    try {
      [replyIds, replies] = await commentManager.bulkAddCommentReplies(padIdReceived, data);
    } catch (err) {
      console.error(err.stack ? err.stack : err.toString());
      res.json({code: 2, message: 'internal error', data: null});
      return;
    }
    if (replyIds == null) return;
    for (let i = 0; i < replyIds.length; i++) {
      replies[i].replyId = replyIds[i];
      io.to(padIdReceived).emit('pushAddCommentReply', replyIds[i], replies[i]);
    }
    res.json({code: 0, replyIds});
  });
  return callback();
};
