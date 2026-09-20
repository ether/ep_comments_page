'use strict';

// #449: comments could not be edited or deleted when ep_stable_authorid was
// installed. `authorIdForSocket()` resolved the author with an empty user
// object, so the `getAuthorId` hook chain had nothing to map to a stable author
// id and fell back to the token-derived id. The pad session meanwhile used the
// stable id, so every comment was stamped with an author that never matched
// `clientVars.userId` — the edit/delete actions were hidden and edits were
// rejected with "You cannot edit other users comments!".
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const epComments = require('ep_comments_page');
const pluginDefs = require('ep_etherpad-lite/static/js/pluginfw/plugin_defs');
const authorManager =
  require('ep_etherpad-lite/node/db/AuthorManager').default ||
  require('ep_etherpad-lite/node/db/AuthorManager');

// A /comment socket carrying an author token cookie, optionally with the
// express session core attaches to authenticated connections.
const socketWith = (token, user) => ({
  request: {
    headers: {cookie: `token=${token}`},
    ...(user ? {session: {user}} : {}),
  },
});

// Same shape as ep_stable_authorid's hook: when the connection belongs to an
// authenticated user, key the author off the username instead of the token.
const stableAuthorIdHook = {
  hook_fn: async (hookName, ctx) => {
    const {username} = ctx.user || {};
    if (!username) return;
    ctx.dbKey = `username=${username}`;
    return '';
  },
  hook_fn_name: 'ep_comments_page_test:getAuthorId',
  hook_name: 'getAuthorId',
  part: {plugin: 'ep_comments_page_test'},
};

describe(__filename, function () {
  before(async function () { await common.init(); });

  describe('author identity with a getAuthorId hook installed (#449)', function () {
    let hooks;

    beforeEach(async function () {
      hooks = pluginDefs.hooks.getAuthorId || (pluginDefs.hooks.getAuthorId = []);
      hooks.unshift(stableAuthorIdHook);
    });

    afterEach(async function () {
      const i = hooks.indexOf(stableAuthorIdHook);
      if (i >= 0) hooks.splice(i, 1);
    });

    it('resolves the same author id the pad session uses', async function () {
      const token = `t.${common.randomString()}`;
      const user = {username: `u${common.randomString()}`};
      // What core's SecurityManager would resolve for this pad session.
      const padSessionAuthor = await authorManager.getAuthorId(token, user);
      const resolved = await epComments.authorIdForSocket(socketWith(token, user));
      assert.equal(resolved, padSessionAuthor,
          'the /comment socket must resolve the same author id as the pad session');
    });

    it('does not fall back to the token-derived author for an authenticated user',
        async function () {
          const token = `t.${common.randomString()}`;
          const user = {username: `u${common.randomString()}`};
          const tokenAuthor = await authorManager.getAuthorId(token, {});
          const resolved = await epComments.authorIdForSocket(socketWith(token, user));
          assert.notEqual(resolved, tokenAuthor,
              'the stable (username-derived) author id must win over the token-derived one');
        });

    it('still resolves from the token when the connection is not authenticated',
        async function () {
          const token = `t.${common.randomString()}`;
          const tokenAuthor = await authorManager.getAuthorId(token, {});
          assert.equal(await epComments.authorIdForSocket(socketWith(token)), tokenAuthor);
        });

    it('two users are still kept apart', async function () {
      const tokenA = `t.${common.randomString()}`;
      const tokenB = `t.${common.randomString()}`;
      const userA = {username: `a${common.randomString()}`};
      const userB = {username: `b${common.randomString()}`};
      const a = await epComments.authorIdForSocket(socketWith(tokenA, userA));
      const b = await epComments.authorIdForSocket(socketWith(tokenB, userB));
      assert.notEqual(a, b);
      // The same user from another device/token resolves to the same author.
      const aAgain = await epComments.authorIdForSocket(
          socketWith(`t.${common.randomString()}`, userA));
      assert.equal(aAgain, a);
    });
  });

  // The session (and therefore the user) is only attached by core to its own
  // socket.io namespaces, so the plugin runs the middleware on /comment itself.
  describe('attachSession', function () {
    it('leaves an existing session alone and calls next() once', async function () {
      const session = {user: {username: 'someone'}};
      const socket = {request: {headers: {}, session}};
      let calls = 0;
      await new Promise((resolve) => epComments.attachSession(socket, () => {
        calls++;
        resolve();
      }));
      assert.equal(calls, 1);
      assert.equal(socket.request.session, session);
    });

    it('populates request.session for a /comment handshake', async function () {
      const socket = {request: {headers: {cookie: ''}, url: '/', method: 'GET'}};
      await new Promise((resolve) => epComments.attachSession(socket, resolve));
      assert.notEqual(socket.request.session, null,
          'express-session must have run on the handshake request');
    });

    it('never rejects the connection when there is no request', async function () {
      let called = false;
      await new Promise((resolve) => epComments.attachSession({}, () => {
        called = true;
        resolve();
      }));
      assert.equal(called, true);
    });
  });
});
