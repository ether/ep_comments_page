'use strict';

// The `/comment` namespace runs core's pad socket origin check (through
// ep_plugin_helpers' guardSocketNamespace), so it treats a handshake exactly
// like core treats a pad socket: one from an Etherpad page keeps the
// visitor's cookies, one opened by a page on another origin does not.
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const io = require('socket.io-client');
const settings = require('ep_etherpad-lite/node/utils/Settings').default ||
  require('ep_etherpad-lite/node/utils/Settings');
const plugins = require('ep_etherpad-lite/static/js/pluginfw/plugin_defs');
const groupManager = require('ep_etherpad-lite/node/db/GroupManager');
const sessionManager = require('ep_etherpad-lite/node/db/SessionManager');
const authorManager = require('ep_etherpad-lite/node/db/AuthorManager').default ||
  require('ep_etherpad-lite/node/db/AuthorManager');
const commentManager = require('ep_comments_page/commentManager');

let coreHasCheck = false;
try {
  const m = require('ep_etherpad-lite/node/hooks/express/socketio');
  coreHasCheck = typeof (m.padOriginMiddleware || (m.default && m.default.padOriginMiddleware)) ===
      'function';
} catch (err) { /* older core */ }

// Opens the /comment namespace over WebSocket with the given cookies and
// extra handshake headers (Origin, Host, Sec-Fetch-Site, ...). socket.io-client
// on node.js can't send cookies, so they go via the query parameter the
// plugin's session middleware reads.
const connectComment = async ({cookie = '', headers = {}, auth} = {}) => {
  const socket = io(`${common.baseUrl}/comment`, {
    forceNew: true,
    transports: ['websocket'],
    query: {cookie},
    extraHeaders: headers,
    ...(auth ? {auth} : {}),
  });
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
  let groupID;
  let padId;
  let cookie;
  let serverHost;
  const backups = {};

  before(async function () {
    if (!coreHasCheck) return this.skip(); // Etherpad < 3.3.21: nothing to apply.
    agent = await common.init();
    serverHost = new URL(common.baseUrl).host;
  });

  beforeEach(async function () {
    backups.socketIo = settings.socketIo;
    backups.trustProxy = settings.trustProxy;
    backups.publicURL = settings.publicURL;
    backups.hooks = {};
    for (const hookName of ['preAuthorize', 'authenticate', 'authorize']) {
      backups.hooks[hookName] = plugins.hooks[hookName];
      plugins.hooks[hookName] = [];
    }
    settings.socketIo = {...(settings.socketIo || {}), crossOriginPadSockets: 'anonymous',
      allowedOrigins: [], padAllowedOrigins: []};
    settings.trustProxy = false;
    settings.publicURL = null;
    // A private group pad: only a valid HTTP API session cookie can read it,
    // so whether the comments come back shows whether the cookie was used.
    ({groupID} = await groupManager.createGroup());
    padId = `${groupID}$origin${common.randomString(8)}`;
    await groupManager.createGroupPad(groupID, padId.split('$')[1], 'secret text');
    await commentManager.addComment(padId, {author: 'a.INSIDER', text: 'members only'});
    const {authorID} = await authorManager.createAuthorIfNotExistsFor('origin-member', 'Member');
    const {sessionID} = await sessionManager.createSession(groupID, authorID, Date.now() + 60000);
    cookie = `sessionID=${encodeURIComponent(sessionID)}`;
  });

  afterEach(async function () {
    if (socket != null) socket.close();
    socket = null;
    settings.socketIo = backups.socketIo;
    settings.trustProxy = backups.trustProxy;
    settings.publicURL = backups.publicURL;
    Object.assign(plugins.hooks, backups.hooks);
    if (groupID) await groupManager.deleteGroup(groupID);
    groupID = null;
  });

  const padSocketToken = async (cookieHeader) => {
    const res = await agent.get('/pad-socket-token').set('Cookie', cookieHeader).expect(200);
    assert.equal(typeof res.body.token, 'string');
    return res.body.token;
  };

  const readsComments = async (s) => {
    const {comments} = await send(s, 'getComments', {padId});
    return Object.keys(comments).length;
  };

  describe('same origin', function () {
    it('a handshake without an Origin header (CLI/bot client) keeps its cookies',
        async function () {
          socket = await connectComment({cookie});
          assert.equal(await readsComments(socket), 1);
        });

    it('an Origin matching Host keeps its cookies', async function () {
      socket = await connectComment({cookie, headers: {origin: `http://${serverHost}`}});
      assert.equal(await readsComments(socket), 1);
    });

    it('Sec-Fetch-Site: same-origin keeps its cookies', async function () {
      socket = await connectComment({cookie, headers: {
        'origin': 'https://pad.example.com',
        'sec-fetch-site': 'same-origin',
      }});
      assert.equal(await readsComments(socket), 1);
    });

    it('can still write with the visitor\'s cookies', async function () {
      socket = await connectComment({cookie, headers: {origin: `http://${serverHost}`}});
      const [commentId] = await send(socket, 'addComment', {padId, comment: {text: 'hi'}});
      assert(commentId);
    });
  });

  describe('proxy that rewrites the Host header', function () {
    // The browser is on https://pad.example.com; the proxy forwards to
    // Etherpad with Host set to the backend address and no X-Forwarded-Host.
    // No Fetch Metadata either (as with Chromium's WebSocket handshakes).
    const proxied = {origin: 'https://pad.example.com'};

    it('a handshake with the pad socket token keeps its cookies', async function () {
      const token = await padSocketToken(cookie);
      socket = await connectComment({cookie, headers: proxied, auth: {padSocketToken: token}});
      assert.equal(await readsComments(socket), 1);
    });

    it('works with publicURL set and no token', async function () {
      settings.publicURL = 'https://pad.example.com';
      socket = await connectComment({cookie, headers: proxied});
      assert.equal(await readsComments(socket), 1);
    });

    it('works with trustProxy and X-Forwarded-Host and no token', async function () {
      settings.trustProxy = true;
      socket = await connectComment(
          {cookie, headers: {...proxied, 'x-forwarded-host': 'pad.example.com'}});
      assert.equal(await readsComments(socket), 1);
    });
  });

  describe('another origin', function () {
    const sibling = {'origin': 'https://evil.example.com', 'sec-fetch-site': 'same-site'};

    it('a same-site page connects, but without the visitor\'s cookies', async function () {
      socket = await connectComment({cookie, headers: sibling});
      await assert.rejects(send(socket, 'getComments', {padId}), /unauth/);
      await assert.rejects(
          send(socket, 'addComment', {padId, comment: {text: 'graffiti'}}), /unauth/);
      const {comments} = await commentManager.getComments(padId);
      assert.equal(Object.keys(comments).length, 1);
    });

    it('an Origin that matches nothing, without Fetch Metadata, gets no cookies',
        async function () {
          socket = await connectComment({cookie, headers: {origin: 'https://evil.example.com'}});
          await assert.rejects(send(socket, 'getComments', {padId}), /unauth/);
        });

    it('a token issued for other cookies does not help', async function () {
      // The page fetches a token for its own (empty) cookies, but the browser
      // attaches the visitor's cookies to the handshake.
      const token = await padSocketToken('');
      socket = await connectComment({cookie, headers: sibling, auth: {padSocketToken: token}});
      await assert.rejects(send(socket, 'getComments', {padId}), /unauth/);
    });

    it('is refused with crossOriginPadSockets: "reject"', async function () {
      settings.socketIo.crossOriginPadSockets = 'reject';
      await assert.rejects(connectComment({cookie, headers: sibling}), /origin not allowed/);
    });

    it('keeps its cookies when listed in socketIo.padAllowedOrigins', async function () {
      settings.socketIo.padAllowedOrigins = ['https://evil.example.com'];
      socket = await connectComment({cookie, headers: sibling});
      assert.equal(await readsComments(socket), 1);
    });
  });
});
