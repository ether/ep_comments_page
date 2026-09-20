'use strict';

const {template} = require('ep_plugin_helpers');

const AttributePool = require('ep_etherpad-lite/static/js/AttributePool').default || require('ep_etherpad-lite/static/js/AttributePool');
const Changeset = require('ep_etherpad-lite/static/js/Changeset').default || require('ep_etherpad-lite/static/js/Changeset');
const eejs = require('ep_etherpad-lite/node/eejs');
// Read the settings through the ES default export when there is one: on
// Etherpad 3.x the CJS mirror of Settings is built before the top-level `ep_*`
// plugin blocks are merged in, so `require(...).ep_comments_page` is undefined
// on released cores and every option silently fell back to its default (#454).
// Same `.default ||` idiom this file already uses for Changeset et al.
const settings = require('ep_etherpad-lite/node/utils/Settings').default || require('ep_etherpad-lite/node/utils/Settings');
const {Formidable} = require('formidable');
const commentManager = require('./commentManager');
const apiUtils = require('./apiUtils');
const padMessageHandler = require('ep_etherpad-lite/node/handler/PadMessageHandler');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager').default || require('ep_etherpad-lite/node/db/ReadOnlyManager');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const authorManager = require('ep_etherpad-lite/node/db/AuthorManager').default || require('ep_etherpad-lite/node/db/AuthorManager');
const securityManager = require('ep_etherpad-lite/node/db/SecurityManager').default || require('ep_etherpad-lite/node/db/SecurityManager');
const webaccess = require('ep_etherpad-lite/node/hooks/express/webaccess');
let expressHooks = {};
try {
  expressHooks = require('ep_etherpad-lite/node/hooks/express');
} catch (err) {
  // Core lays its express hooks out differently: carry on without the session
  // (authors then resolve from the token cookie alone, as before).
}

// Core only installs its express-session middleware on its own socket.io
// namespaces, so a plugin namespace's handshake request has no `session` — and
// therefore no authenticated `user`. Run it here so `/comment` handshakes carry
// the same session (and user) core's pad socket has. Without it the `getAuthorId`
// hook chain runs without a user, so plugins that map an authenticated user to a
// stable author id (ep_stable_authorid) fall back to the token-derived id and
// comments get stamped with an author that never matches the pad session's —
// which hides the edit/delete actions and rejects edits (#449).
// Mirrors core's socketio.js `socketSessionMiddleware`.
const attachSession = (socket, next) => {
  const req = socket && socket.request;
  if (!req || req.session != null) return next();
  const sessionMiddleware = expressHooks && expressHooks.sessionMiddleware;
  if (!sessionMiddleware) return next();
  try {
    if (req.headers && !req.headers.cookie && socket.handshake && socket.handshake.query) {
      // socket.io-client on node.js doesn't support cookies, so it passes them
      // via a query parameter (same fallback core uses).
      req.headers.cookie = socket.handshake.query.cookie;
    }
    // Never fail the connection because the session couldn't be loaded: without
    // a session the author is still resolved from the token cookie as before.
    sessionMiddleware(req, {}, () => next());
  } catch (err) {
    next();
  }
};
// Exported for tests (verifies the /comment handshake gets core's session).
exports.attachSession = attachSession;

// Read one cookie from a socket.io handshake. The handshake does not run
// cookie-parser, so parse the raw Cookie header the way core's
// PadMessageHandler does. A value that cannot be decoded (e.g. `name=%ZZ`)
// is treated as absent rather than throwing.
const readCookie = (socket, name) => {
  const cookieHeader =
    (socket && socket.request && socket.request.headers && socket.request.headers.cookie) || '';
  const match = cookieHeader.split(/;\s*/).find((c) => c.split('=')[0] === name);
  if (!match) return null;
  try {
    return decodeURIComponent(match.split('=').slice(1).join('=')) || null;
  } catch (err) {
    if (err instanceof URIError) return null;
    throw err;
  }
};

// Resolve the authoritative authorId for a /comment socket connection from the
// HttpOnly author-token cookie on its handshake — the same cookie core uses to
// identify the author. The cookie is never exposed to the page, so a client
// cannot spoof another user's authorId (#222). Returns null when it can't be
// resolved (e.g. no token cookie), in which case authorship checks fail closed.
const authorIdForSocket = async (socket) => {
  try {
    const cookiePrefix = (settings.cookie && settings.cookie.prefix) || '';
    const token = readCookie(socket, `${cookiePrefix}token`);
    if (!token) return null;
    // Pass the authenticated user along so the `getAuthorId` hook chain can map
    // the session to a stable author id exactly as core's SecurityManager does
    // (#449). Falls back to `{}` — i.e. the token-derived author — when the pad
    // is not behind authentication or the session couldn't be loaded.
    const user =
      (socket && socket.request && socket.request.session && socket.request.session.user) || {};
    const getAuthorId = authorManager.getAuthorId
      ? (t) => authorManager.getAuthorId(t, user)
      : (t) => authorManager.getAuthor4Token(t); // older cores
    return await getAuthorId(token);
  } catch (err) {
    return null;
  }
};
// Exported for tests (verifies author identity derives from the token cookie).
exports.authorIdForSocket = authorIdForSocket;

// Authorize a /comment socket for the pad id it just named.
//
// The plugin has its own socket.io namespace, so core never authorizes anything
// that arrives on it: core's PadMessageHandler only guards its own namespace.
// Until this check existed, every handler below acted on whatever `padId` the
// client sent, which let any connected client read — and write — the comments
// of any pad it could name, including pads it was refused over HTTP.
//
// Ask core exactly what core asks itself before honouring a pad message: hand
// `SecurityManager.checkAccess()` the connection's author token, its HTTP API
// session cookie and the authenticated express-session user (available on this
// namespace since #456 runs core's session middleware on the handshake), then
// derive write permission the way core's `webaccess.userCanModify()` does.
//
// Fails closed: a missing session, a denial, or any error at all rejects.
// Returns the real (non-read-only) pad id the caller may act on.
const checkPadAccess = async (socket, userPadId, {write = false} = {}) => {
  const unauth = () => new Error('unauth');
  let padId;
  let readonly;
  try {
    if (!userPadId || typeof userPadId !== 'string') throw unauth();
    const cookiePrefix = (settings.cookie && settings.cookie.prefix) || '';
    const req = (socket && socket.request) || {};
    const {accessStatus} = await securityManager.checkAccess(
        userPadId,
        readCookie(socket, `${cookiePrefix}sessionID`) || readCookie(socket, 'sessionID'),
        readCookie(socket, `${cookiePrefix}token`),
        (req.session && req.session.user) || undefined) || {};
    if (accessStatus !== 'grant') throw unauth();
    padId = (await readOnlyManager.getIds(userPadId)).padId;
    if (padId == null) throw unauth();
    readonly = readOnlyManager.isReadOnlyId(userPadId) || !webaccess.userCanModify(userPadId, req);
  } catch (err) {
    // Never leak why access was refused, and never let an unexpected error
    // (a missing session, a database hiccup) read as "allowed".
    throw unauth();
  }
  // Read-only sessions may always read comments. They may only write them when
  // the admin opted in with `allowReadonlyComments` (#8) — the same switch
  // `handleMessageSecurity` above uses to let comment-only changesets through.
  if (write && readonly && !readonlyCommentsAllowed()) throw unauth();
  return padId;
};
// Exported for tests.
exports.checkPadAccess = checkPadAccess;

// Comment char-ranges per line for a given revision's atext. The timeslider on
// older Etherpad cores can't run the plugin's client hooks, so it never paints
// the `comment` class; this lets the client reconstruct those ranges and render
// comments read-only there (issue #33). Returns {commentId: [{line, start, end}]}.
const commentLocationsFromAText = (atext, apool) => {
  const text = atext.text;
  const out = {};
  let charIdx = 0;
  let line = 0;
  let col = 0;
  const opIter = Changeset.opIterator(atext.attribs);
  while (opIter.hasNext()) {
    const op = opIter.next();
    let commentId = null;
    Changeset.eachAttribNumber(op.attribs, (n) => {
      if (apool.getAttribKey(n) === 'comment') commentId = apool.getAttribValue(n);
    });
    for (let i = 0; i < op.chars; i++) {
      const ch = text[charIdx++];
      if (ch === '\n') { line++; col = 0; continue; }
      if (commentId) {
        const ranges = out[commentId] || (out[commentId] = []);
        const last = ranges[ranges.length - 1];
        if (last && last.line === line && last.end === col) last.end = col + 1;
        else ranges.push({line, start: col, end: col + 1});
      }
      col++;
    }
  }
  return out;
};
const {padToggle} = require('ep_plugin_helpers/pad-toggle-server');
const {toggle} = require('ep_plugin_helpers/settings-toggle');

// Parallel User Settings + Pad Wide Settings checkboxes for comment-pane
// visibility. Helper owns the storage, broadcast, enforce, and i18n wiring.
const commentsToggle = padToggle({
  pluginName: 'ep_comments_page',
  settingId: 'comments',
  l10nId: 'ep_comments_page.show_comments',
  defaultLabel: 'Show Comments',
  defaultEnabled: true,
});

// #12/#5: the all-comments overview is a checkbox in the user Settings pane
// (not a toolbar icon), built with the ep_plugin_helpers `toggle` helper —
// cookie-persisted, default off. The client shows/hides the panel from it.
const overviewToggle = toggle({
  pluginName: 'ep_comments_page',
  settingId: 'comments-overview',
  templatePath: 'ep_comments_page/templates/commentsOverviewSetting.ejs',
  defaultEnabled: false,
});

exports.loadSettings = commentsToggle.loadSettings;
// Compose both settings checkboxes (Show Comments + Show all comments) into the
// single eejsBlock_mySettings hook.
exports.eejsBlock_mySettings = (hookName, args, cb) =>
  commentsToggle.eejsBlock_mySettings(hookName, args, () =>
    overviewToggle.eejsBlock_mySettings(hookName, args, cb));
exports.eejsBlock_padSettings = commentsToggle.eejsBlock_padSettings;

let io;

exports.exportEtherpadAdditionalContent = (hookName, context, callback) => callback(['comments']);

exports.padRemove = async (hookName, context) => {
  await Promise.all([
    commentManager.deleteCommentReplies(context.pad.id),
    commentManager.deleteComments(context.pad.id),
  ]);
};

exports.padCopy = async (hookName, context) => {
  await Promise.all([
    commentManager.copyComments(context.originalPad.id, context.destinationID),
    commentManager.copyCommentReplies(context.originalPad.id, context.destinationID),
  ]);
};

exports.handleMessageSecurity = async (hookName, ctx) => {
  // ctx.client was renamed to ctx.socket in newer versions of Etherpad. Fall back to ctx.client in
  // case this plugin is installed on an older version of Etherpad.
  const {message, socket = ctx.client} = ctx;
  const {type: mtype, data: {type: dtype, apool, changeset} = {}} = message;
  if (mtype !== 'COLLABROOM') return;
  if (dtype !== 'USER_CHANGES') return;
  // Nothing needs to be done if the user already has write access.
  if (!padMessageHandler.sessioninfos[socket.id].readonly) return;
  // Read-only commenting is opt-in (#8). When it's off (the default), fall
  // through without granting permission so core's normal read-only enforcement
  // rejects the change.
  if (!(settings.ep_comments_page && settings.ep_comments_page.allowReadonlyComments)) return;
  const pool = new AttributePool().fromJsonable(apool);
  const cs = Changeset.unpack(changeset);
  const opIter = Changeset.opIterator(cs.ops);
  while (opIter.hasNext()) {
    const op = opIter.next();
    // Only operations that manipulate the 'comment' attribute on existing text are allowed.
    if (op.opcode !== '=') return;
    const forbiddenAttrib = new Error();
    try {
      Changeset.eachAttribNumber(op.attribs, (n) => {
        // Use an exception to break out of the iteration early.
        if (pool.getAttribKey(n) !== 'comment') throw forbiddenAttrib;
      });
    } catch (err) {
      if (err !== forbiddenAttrib) throw err;
      return;
    }
  }
  return true;
};

exports.socketio = (hookName, args, cb) => {
  io = args.io.of('/comment');
  io.use(attachSession);
  io.on('connection', (socket) => {
    const handler = (fn) => (...args) => {
      const respond = args.pop();
      (async () => await fn(...args))().then(
          (val) => respond(null, val),
          (err) => respond({name: err.name, message: err.message}));
    };

    // Join the rooms
    socket.on('getComments', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId);
      // Put read-only and read-write users in the same socket.io "room" so that they can see each
      // other's updates. Only after the access check: joining the room would
      // otherwise subscribe an unauthorized socket to the pad's live comments.
      socket.join(padId);
      return await commentManager.getComments(padId);
    }));

    socket.on('getCommentReplies', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId);
      return await commentManager.getCommentReplies(padId);
    }));

    // Where each comment's text sits at a given revision (for the timeslider).
    socket.on('getCommentLocations', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId);
      const pad = await padManager.getPad(padId);
      const head = pad.getHeadRevisionNumber();
      let rev = Number(data.rev);
      if (!Number.isInteger(rev) || rev < 0 || rev > head) rev = head;
      const atext = await pad.getInternalRevisionAText(rev);
      return {rev, locations: commentLocationsFromAText(atext, pad.pool)};
    }));

    // On add events
    socket.on('addComment', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      const content = data.comment;
      // Stamp the authoritative author server-side so a comment can't be created
      // labelled as someone else (#222). Fall back to the supplied value when no
      // token is resolvable (e.g. API/test contexts without the cookie).
      const resolvedAuthor = await authorIdForSocket(socket);
      if (content && resolvedAuthor) content.author = resolvedAuthor;
      const [commentId, comment] = await commentManager.addComment(padId, content);
      if (commentId != null && comment != null) {
        socket.broadcast.to(padId).emit('pushAddComment', commentId, comment);
        return [commentId, comment];
      }
    }));

    socket.on('deleteComment', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      // Authorize against the server-resolved author, never the client-supplied
      // authorId (which is spoofable) (#222).
      const authorId = await authorIdForSocket(socket);
      await commentManager.deleteComment(padId, data.commentId, authorId);
      socket.broadcast.to(padId).emit('commentDeleted', data.commentId);
    }));

    socket.on('revertChange', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padId, data.commentId, false);
      socket.broadcast.to(padId).emit('changeReverted', data.commentId);
    }));

    socket.on('acceptChange', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      // Broadcast to all other users that this change was accepted.
      // Note that commentId here can either be the commentId or replyId..
      await commentManager.changeAcceptedState(padId, data.commentId, true);
      socket.broadcast.to(padId).emit('changeAccepted', data.commentId);
    }));

    socket.on('bulkAddComment', handler(async (padId, data) => {
      padId = await checkPadAccess(socket, padId, {write: true});
      const [commentIds, comments] = await commentManager.bulkAddComments(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentInBulk');
      // {c-123:data, c-124:data}
      return Object.fromEntries(commentIds.map((id, i) => [id, comments[i]]));
    }));

    socket.on('bulkAddCommentReplies', handler(async (padId, data) => {
      padId = await checkPadAccess(socket, padId, {write: true});
      const [repliesId, replies] = await commentManager.bulkAddCommentReplies(padId, data);
      socket.broadcast.to(padId).emit('pushAddCommentReply', repliesId, replies);
      return repliesId.map((id, i) => [id, replies[i]]);
    }));

    socket.on('updateCommentText', handler(async (data) => {
      const {commentId, commentText} = data;
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      // Authorize against the server-resolved author, never the client-supplied
      // authorId (which is spoofable) (#222).
      const authorId = await authorIdForSocket(socket);
      await commentManager.changeCommentText(padId, commentId, commentText, authorId);
      socket.broadcast.to(padId).emit('textCommentUpdated', commentId, commentText);
    }));

    socket.on('addCommentReply', handler(async (data) => {
      const padId = await checkPadAccess(socket, data.padId, {write: true});
      // Stamp the authoritative author server-side (#222); fall back to the
      // supplied value when no token is resolvable (API/test contexts).
      const resolvedAuthor = await authorIdForSocket(socket);
      if (data && resolvedAuthor) data.author = resolvedAuthor;
      const [replyId, reply] = await commentManager.addCommentReply(padId, data);
      reply.replyId = replyId;
      socket.broadcast.to(padId).emit('pushAddCommentReply', replyId, reply);
      return [replyId, reply];
    }));
  });
  return cb();
};

exports.eejsBlock_dd_insert =
    template('ep_comments_page/templates/menuButtons.ejs');

// `acl-write` lets Etherpad core hide the add-comment affordance on read-only
// pads (`.readonly .acl-write { display: none }`) — see issue #204. That rule is
// also what made `allowReadonlyComments` unreachable: with the setting on, the
// button was rendered but still `display: none`, so read-only viewers could
// never open the comment form (#454). Drop the class when read-only commenting
// is enabled; keep #204's behaviour when it is off (the default).
const readonlyCommentsAllowed = () =>
  !!(settings.ep_comments_page && settings.ep_comments_page.allowReadonlyComments);
const aclWriteClass = () => (readonlyCommentsAllowed() ? '' : 'acl-write');
// Exported for tests.
exports.aclWriteClass = aclWriteClass;

exports.padInitToolbar = (hookName, args, cb) => {
  const toolbar = args.toolbar;

  const button = toolbar.button({
    command: 'addComment',
    localizationId: 'ep_comments_page.add_comment.title',
    class: `buttonicon buttonicon-comment-medical ${aclWriteClass()}`.trim(),
  });

  toolbar.registerButton('addComment', button);

  return cb();
};

// Skip the default toolbar button when the admin placed `addComment` in a
// custom toolbar layout. Uses the ep_plugin_helpers template() helper.
exports.eejsBlock_editbarMenuLeft = template('ep_comments_page/templates/commentBarButtons.ejs', {
  skip: () => JSON.stringify(settings.toolbar).indexOf('addComment') > -1,
  vars: () => ({aclWrite: aclWriteClass()}),
});

exports.eejsBlock_scripts = (hookName, args, cb) => {
  args.content += eejs.require('ep_comments_page/templates/comments.html');
  args.content += eejs.require('ep_comments_page/templates/commentIcons.html');
  return cb();
};

exports.eejsBlock_styles =
    template('ep_comments_page/templates/styles.html');

// Read-only comments in the timeslider (issue #33). Injected as plain scripts
// rather than a client hook because older timeslider bundles can't load plugin
// hooks. socket.io's served client is loaded first so the script has a global
// `io`. Relative paths resolve from /p/<pad>/timeslider to the site root.
exports.eejsBlock_timesliderScripts = (hookName, args, cb) => {
  args.content +=
    '<script src="../../socket.io/socket.io.js"></script>' +
    '<script src="../../static/plugins/ep_comments_page/static/js/timeslider.js"></script>';
  return cb();
};

exports.clientVars = async (hook, context) => {
  const displayCommentAsIcon =
    settings.ep_comments_page ? settings.ep_comments_page.displayCommentAsIcon : false;
  const highlightSelectedText =
    settings.ep_comments_page ? settings.ep_comments_page.highlightSelectedText : false;
  // #95: the floating add-comment button is on unless an admin disables it.
  const floatingCommentButton = !(settings.ep_comments_page &&
    settings.ep_comments_page.floatingCommentButton === false);
  // #6: author-colour accent is on unless an admin disables it.
  const showAuthorColor = !(settings.ep_comments_page &&
    settings.ep_comments_page.showAuthorColor === false);
  // #8: read-only viewers may comment only when an admin opts in (default off).
  const allowReadonlyComments =
    !!(settings.ep_comments_page && settings.ep_comments_page.allowReadonlyComments);
  // Merge in the padToggle helper's clientVars block so the client-side
  // helper can read padWideSupported/initialPadEnabled/etc.
  const helperVars = await commentsToggle.clientVars(hook, context);
  return Object.assign(
      {displayCommentAsIcon, highlightSelectedText, floatingCommentButton, showAuthorColor,
        allowReadonlyComments},
      helperVars);
};

exports.expressCreateServer = (hookName, args, callback) => {
  args.app.get('/p/:pad{/:rev}/comments', async (req, res) => {
    if (!await apiUtils.validateAuth(req, res)) return;
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

  // Helper that returns request fields from either req.body (when Etherpad's
  // express body-parser middleware has already parsed JSON or urlencoded) or
  // by parsing the raw body with Formidable (multipart/form-data uploads).
  // Formidable v3 returns array values; flatten them so callers can use
  // fields.data without indexing.
  const parseRequestFields = async (req) => {
    if (req.body && Object.keys(req.body).length > 0) return req.body;
    const raw = await new Promise((resolve, reject) => {
      new Formidable().parse(req, (err, fields) => err ? reject(err) : resolve(fields));
    });
    const flat = {};
    for (const [k, v] of Object.entries(raw || {})) {
      flat[k] = Array.isArray(v) ? v[0] : v;
    }
    return flat;
  };

  args.app.post('/p/:pad{/:rev}/comments', async (req, res) => {
    if (!await apiUtils.validateAuth(req, res)) return;
    const fields = await parseRequestFields(req);

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

  args.app.get('/p/:pad{/:rev}/commentReplies', async (req, res) => {
    if (!await apiUtils.validateAuth(req, res)) return;
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

  args.app.post('/p/:pad{/:rev}/commentReplies', async (req, res) => {
    if (!await apiUtils.validateAuth(req, res)) return;
    const fields = await parseRequestFields(req);

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
