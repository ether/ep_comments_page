'use strict';

// The plugin's `/comment` socket.io namespace used to act on whatever `padId`
// the client named, without ever asking core whether the connection was allowed
// to touch that pad. Every handler below therefore has to go through
// `SecurityManager.checkAccess()` first, exactly like core's PadMessageHandler
// does before it honours a COLLABROOM message.
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const io = require('socket.io-client');
const settings = require('ep_etherpad-lite/node/utils/Settings').default ||
  require('ep_etherpad-lite/node/utils/Settings');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const plugins = require('ep_etherpad-lite/static/js/pluginfw/plugin_defs');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager').default ||
  require('ep_etherpad-lite/node/db/ReadOnlyManager');
const groupManager = require('ep_etherpad-lite/node/db/GroupManager');
const sessionManager = require('ep_etherpad-lite/node/db/SessionManager');
const authorManager = require('ep_etherpad-lite/node/db/AuthorManager').default ||
  require('ep_etherpad-lite/node/db/AuthorManager');
const commentManager = require('ep_comments_page/commentManager');

// Turn a superagent response's `set-cookie` headers into a `cookie` header.
const cookieHeaderFrom = (res) => ((res && res.headers && res.headers['set-cookie']) || [])
    .map((c) => c.split(';')[0]).join('; ');

// Connect to the plugin's own socket.io namespace, passing the cookies from an
// HTTP response (socket.io-client on node.js can't send cookies, so they go via
// the query parameter the plugin's `attachSession` middleware also reads).
const connectComment = async (res = null, extraCookies = '') => {
  const cookie = [cookieHeaderFrom(res), extraCookies].filter((c) => c).join('; ');
  const socket = io(`${common.baseUrl}/comment`, {forceNew: true, query: {cookie}});
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out connecting to /comment')), 10000);
      socket.on('connect', () => { clearTimeout(t); resolve(); });
      socket.on('connect_error', (err) => { clearTimeout(t); reject(err); });
    });
  } catch (err) {
    socket.close();
    throw err;
  }
  return socket;
};

// Emit an event on the /comment namespace and wait for its acknowledgement,
// rejecting the way the plugin's client does when the server reports an error.
const send = async (socket, event, ...args) => await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timed out waiting for ${event} ack`)), 10000);
  socket.emit(event, ...args, (err, val) => {
    clearTimeout(t);
    if (err != null) return reject(Object.assign(new Error(err.message), {name: err.name}));
    resolve(val);
  });
});

describe(__filename, function () {
  this.timeout(60000);
  let agent;
  let socket;
  let authorize;
  const backups = {};
  const pads = [];

  const makePad = async (text) => {
    const padId = `epcp_acl_${common.randomString()}`;
    const pad = await padManager.getPad(padId, text || 'text');
    pads.push(pad);
    return padId;
  };

  before(async function () { agent = await common.init(); });

  beforeEach(async function () {
    backups.hooks = {};
    for (const hookName of ['preAuthorize', 'authenticate', 'authorize']) {
      backups.hooks[hookName] = plugins.hooks[hookName];
      plugins.hooks[hookName] = [];
    }
    backups.settings = {};
    for (const s of ['requireAuthentication',
      'requireAuthorization',
      'users',
      'ep_comments_page',
      'editOnly']) {
      backups.settings[s] = settings[s];
    }
    settings.editOnly = false;
    settings.requireAuthentication = false;
    settings.requireAuthorization = false;
    settings.users = {user: {password: 'user-password'}};
    settings.ep_comments_page = {};
    authorize = () => true;
    plugins.hooks.authorize = [{hook_fn: (hookName, {req}, cb) => cb([authorize(req)])}];
  });

  afterEach(async function () {
    if (socket != null) socket.close();
    socket = null;
    Object.assign(plugins.hooks, backups.hooks);
    Object.assign(settings, backups.settings);
    while (pads.length) await pads.pop().remove();
  });

  describe('reading another pad\'s comments', function () {
    it('an anonymous socket cannot read comments when authentication is required',
        async function () {
          const victimPadId = await makePad();
          await commentManager.addComment(victimPadId, {author: 'a.SECRET', text: 'top secret'});
          settings.requireAuthentication = true;
          // No cookies at all: the handshake carries no authenticated user.
          socket = await connectComment(null);
          await assert.rejects(send(socket, 'getComments', {padId: victimPadId}), /unauth/);
        });

    it('an authenticated user cannot read the comments of a pad they were not authorized for',
        async function () {
          const allowedPadId = await makePad();
          const victimPadId = await makePad();
          await commentManager.addComment(victimPadId, {author: 'a.SECRET', text: 'top secret'});
          settings.requireAuthentication = true;
          settings.requireAuthorization = true;
          // The user may only reach their own pad.
          authorize = (req) => req.path === `/p/${allowedPadId}`;
          const res =
            await agent.get(`/p/${allowedPadId}`).auth('user', 'user-password').expect(200);
          socket = await connectComment(res);
          // Sanity check: the session really does reach the pad it is authorized for.
          assert.deepEqual(
              await send(socket, 'getComments', {padId: allowedPadId}), {comments: {}});
          await assert.rejects(send(socket, 'getComments', {padId: victimPadId}), /unauth/);
        });

    it('replies and comment locations are protected too', async function () {
      const allowedPadId = await makePad();
      const victimPadId = await makePad();
      const [commentId] =
        await commentManager.addComment(victimPadId, {author: 'a.SECRET', text: 'top secret'});
      await commentManager.addCommentReply(
          victimPadId, {commentId, author: 'a.SECRET', text: 'secret reply'});
      settings.requireAuthentication = true;
      settings.requireAuthorization = true;
      authorize = (req) => req.path === `/p/${allowedPadId}`;
      const res = await agent.get(`/p/${allowedPadId}`).auth('user', 'user-password').expect(200);
      socket = await connectComment(res);
      await assert.rejects(send(socket, 'getCommentReplies', {padId: victimPadId}), /unauth/);
      await assert.rejects(
          send(socket, 'getCommentLocations', {padId: victimPadId, rev: 0}), /unauth/);
    });
  });

  // The HTTP-API integration path (groups + sessions) is the other place the
  // plugin's namespace bypassed: a private group pad is only readable with a
  // valid sessionID cookie, and the /comment namespace never asked for one.
  describe('private group pads', function () {
    let groupID;
    let padId;

    beforeEach(async function () {
      ({groupID} = await groupManager.createGroup());
      padId = `${groupID}$acl${common.randomString(8)}`;
      await groupManager.createGroupPad(groupID, padId.split('$')[1], 'secret text');
      await commentManager.addComment(padId, {author: 'a.INSIDER', text: 'members only'});
    });

    afterEach(async function () {
      await groupManager.deleteGroup(groupID);
    });

    it('a socket with no HTTP API session cannot read a private group pad', async function () {
      socket = await connectComment(null);
      await assert.rejects(send(socket, 'getComments', {padId}), /unauth/);
      await assert.rejects(send(socket, 'getCommentReplies', {padId}), /unauth/);
    });

    it('a socket with no HTTP API session cannot write to a private group pad',
        async function () {
          socket = await connectComment(null);
          await assert.rejects(
              send(socket, 'addComment', {padId, comment: {text: 'graffiti'}}), /unauth/);
          const {comments} = await commentManager.getComments(padId);
          assert.equal(Object.keys(comments).length, 1);
        });

    it('a socket holding a valid session for the group still works', async function () {
      const authorID = await authorManager.createAuthorIfNotExistsFor('acl-member', 'Member');
      const {sessionID} =
        await sessionManager.createSession(groupID, authorID.authorID, Date.now() + 60000);
      socket = await connectComment(null, `sessionID=${encodeURIComponent(sessionID)}`);
      const {comments} = await send(socket, 'getComments', {padId});
      assert.equal(Object.keys(comments).length, 1);
      const [commentId] = await send(socket, 'addComment', {padId, comment: {text: 'hi'}});
      assert(commentId);
    });
  });

  describe('writing to another pad', function () {
    let allowedPadId;
    let victimPadId;
    let victimCommentId;

    beforeEach(async function () {
      allowedPadId = await makePad();
      victimPadId = await makePad();
      [victimCommentId] =
        await commentManager.addComment(victimPadId, {author: 'a.VICTIM', text: 'original'});
      settings.requireAuthentication = true;
      settings.requireAuthorization = true;
      authorize = (req) => req.path === `/p/${allowedPadId}`;
      const res = await agent.get(`/p/${allowedPadId}`).auth('user', 'user-password').expect(200);
      socket = await connectComment(res);
    });

    it('cannot add a comment to an unauthorized pad', async function () {
      await assert.rejects(
          send(socket, 'addComment', {padId: victimPadId, comment: {text: 'graffiti'}}), /unauth/);
      const {comments} = await commentManager.getComments(victimPadId);
      assert.equal(Object.keys(comments).length, 1);
    });

    it('cannot bulk-add comments to an unauthorized pad', async function () {
      await assert.rejects(
          send(socket, 'bulkAddComment', victimPadId, [{text: 'graffiti'}]), /unauth/);
      const {comments} = await commentManager.getComments(victimPadId);
      assert.equal(Object.keys(comments).length, 1);
    });

    it('cannot reply on an unauthorized pad', async function () {
      await assert.rejects(send(socket, 'addCommentReply',
          {padId: victimPadId, commentId: victimCommentId, text: 'graffiti'}), /unauth/);
      const {replies} = await commentManager.getCommentReplies(victimPadId);
      assert.deepEqual(replies, {});
    });

    it('cannot bulk-add replies on an unauthorized pad', async function () {
      await assert.rejects(send(socket, 'bulkAddCommentReplies', victimPadId,
          [{commentId: victimCommentId, text: 'graffiti'}]), /unauth/);
      const {replies} = await commentManager.getCommentReplies(victimPadId);
      assert.deepEqual(replies, {});
    });

    it('cannot delete a comment on an unauthorized pad', async function () {
      // allowAnyoneToEditComments removes the author check, so the pad access
      // check is the only thing standing between the attacker and the comment.
      settings.ep_comments_page = {allowAnyoneToEditComments: true};
      await assert.rejects(
          send(socket, 'deleteComment', {padId: victimPadId, commentId: victimCommentId}),
          /unauth/);
      const {comments} = await commentManager.getComments(victimPadId);
      assert.equal(comments[victimCommentId].text, 'original');
    });

    it('cannot edit a comment on an unauthorized pad', async function () {
      settings.ep_comments_page = {allowAnyoneToEditComments: true};
      await assert.rejects(send(socket, 'updateCommentText',
          {padId: victimPadId, commentId: victimCommentId, commentText: 'hacked'}), /unauth/);
      const {comments} = await commentManager.getComments(victimPadId);
      assert.equal(comments[victimCommentId].text, 'original');
    });

    it('cannot accept or revert a suggested change on an unauthorized pad', async function () {
      await assert.rejects(
          send(socket, 'acceptChange', {padId: victimPadId, commentId: victimCommentId}), /unauth/);
      await assert.rejects(
          send(socket, 'revertChange', {padId: victimPadId, commentId: victimCommentId}), /unauth/);
    });
  });

  describe('an authorized user is unaffected', function () {
    it('can read and write the comments of the pad they are authorized for', async function () {
      const padId = await makePad();
      settings.requireAuthentication = true;
      settings.requireAuthorization = true;
      authorize = (req) => req.path === `/p/${padId}`;
      const res = await agent.get(`/p/${padId}`).auth('user', 'user-password').expect(200);
      socket = await connectComment(res);
      const [commentId] =
        await send(socket, 'addComment', {padId, comment: {text: 'hello', name: 'user'}});
      assert(commentId);
      const {comments} = await send(socket, 'getComments', {padId});
      assert.equal(comments[commentId].text, 'hello');
      const [replyId] =
        await send(socket, 'addCommentReply', {padId, commentId, text: 'hi back'});
      assert(replyId);
      const {replies} = await send(socket, 'getCommentReplies', {padId});
      assert.equal(replies[replyId].text, 'hi back');
      const {locations} = await send(socket, 'getCommentLocations', {padId});
      assert.deepEqual(locations, {});
    });

    it('anonymous access to a public pad still works when authentication is off',
        async function () {
          const padId = await makePad();
          socket = await connectComment(null);
          const [commentId] =
            await send(socket, 'addComment', {padId, comment: {text: 'hello', name: 'anon'}});
          const {comments} = await send(socket, 'getComments', {padId});
          assert.equal(comments[commentId].text, 'hello');
        });
  });

  // PR #456 made `allowReadonlyComments` effective in the UI. The socket side
  // must honour the same switch: read-only sessions may only write comments
  // when the admin has opted in.
  describe('read-only sessions honour allowReadonlyComments', function () {
    let padId;
    let roPadId;

    beforeEach(async function () {
      padId = await makePad();
      roPadId = await readOnlyManager.getReadOnlyId(padId);
      const res = await agent.get(`/p/${roPadId}`).expect(200);
      socket = await connectComment(res);
    });

    it('a read-only session can always read comments', async function () {
      await commentManager.addComment(padId, {author: 'a.SOMEONE', text: 'visible'});
      const {comments} = await send(socket, 'getComments', {padId: roPadId});
      assert.equal(Object.keys(comments).length, 1);
    });

    it('a read-only session cannot add a comment by default', async function () {
      settings.ep_comments_page = {allowReadonlyComments: false};
      await assert.rejects(
          send(socket, 'addComment', {padId: roPadId, comment: {text: 'nope'}}), /unauth/);
      const {comments} = await commentManager.getComments(padId);
      assert.deepEqual(comments, {});
    });

    it('a read-only session can add a comment when allowReadonlyComments is on',
        async function () {
          settings.ep_comments_page = {allowReadonlyComments: true};
          const [commentId] =
            await send(socket, 'addComment', {padId: roPadId, comment: {text: 'ok'}});
          const {comments} = await commentManager.getComments(padId);
          assert.equal(comments[commentId].text, 'ok');
        });

    it('a read-only session cannot reply by default', async function () {
      const [commentId] = await commentManager.addComment(padId, {author: 'a.X', text: 'c'});
      settings.ep_comments_page = {allowReadonlyComments: false};
      await assert.rejects(
          send(socket, 'addCommentReply', {padId: roPadId, commentId, text: 'nope'}), /unauth/);
    });
  });
});
