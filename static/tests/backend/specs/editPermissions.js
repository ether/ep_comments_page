'use strict';

// #222: comment edit/delete permissions are configurable. By default only the
// original author may edit/delete a comment (restrictive, from #163); setting
// `ep_comments_page.allowAnyoneToEditComments` switches to a permissive model.
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const commentManager = require('ep_comments_page/commentManager');
const epComments = require('ep_comments_page');
const authorManager =
  require('ep_etherpad-lite/node/db/AuthorManager').default ||
  require('ep_etherpad-lite/node/db/AuthorManager');

// Build a minimal fake /comment socket carrying a given author token in its
// handshake Cookie header (the same place core reads it from).
const socketWithToken = (token) => ({request: {headers: {cookie: `token=${token}`}}});

describe(__filename, function () {
  let savedSetting;

  before(async function () { await common.init(); });
  beforeEach(async function () { savedSetting = settings.ep_comments_page; });
  afterEach(async function () { settings.ep_comments_page = savedSetting; });

  it('by default only the original author may delete a comment', async function () {
    settings.ep_comments_page = {};
    const padId = 'ep_comments_test_perms_default';
    const [commentId] =
        await commentManager.addComment(padId, {author: 'a.AUTHOR1', text: 'hello'});

    await assert.rejects(
        commentManager.deleteComment(padId, commentId, 'a.AUTHOR2'),
        /unauth/,
        'a different author must not be able to delete the comment by default');

    // The original author still can.
    await commentManager.deleteComment(padId, commentId, 'a.AUTHOR1');
  });

  it('by default only the original author may edit a comment', async function () {
    settings.ep_comments_page = {};
    const padId = 'ep_comments_test_perms_default_edit';
    const [commentId] =
        await commentManager.addComment(padId, {author: 'a.AUTHOR1', text: 'hello'});

    await assert.rejects(
        commentManager.changeCommentText(padId, commentId, 'hacked', 'a.AUTHOR2'),
        /unauth/);
  });

  it('allowAnyoneToEditComments lets any author edit and delete', async function () {
    settings.ep_comments_page = {allowAnyoneToEditComments: true};
    const padId = 'ep_comments_test_perms_permissive';
    const [commentId] =
        await commentManager.addComment(padId, {author: 'a.AUTHOR1', text: 'hello'});

    // A different author can edit...
    await commentManager.changeCommentText(padId, commentId, 'edited by someone else', 'a.AUTHOR2');
    const comments = await commentManager.getComments(padId);
    assert.equal(comments.comments[commentId].text, 'edited by someone else');

    // ...and delete.
    await commentManager.deleteComment(padId, commentId, 'a.AUTHOR2');
    const after = await commentManager.getComments(padId);
    assert.equal(after.comments[commentId], undefined);
  });

  // #222 (security): the authorId used for authorization is resolved server-side
  // from the HttpOnly token cookie on the /comment socket handshake, NOT from
  // the client payload — so a client cannot spoof another user's authorId.
  describe('author identity is resolved from the token cookie, not the client', function () {
    it('resolves a token cookie to its owning author', async function () {
      const tokenA = `t.${common.randomString()}`;
      const authorA = await authorManager.getAuthorId(tokenA, {});
      const resolved = await epComments.authorIdForSocket(socketWithToken(tokenA));
      assert.equal(resolved, authorA, 'must resolve the cookie token to its author');
    });

    it('a different token resolves to a different author (no impersonation)', async function () {
      const tokenA = `t.${common.randomString()}`;
      const tokenB = `t.${common.randomString()}`;
      const authorA = await authorManager.getAuthorId(tokenA, {});
      const resolvedFromB = await epComments.authorIdForSocket(socketWithToken(tokenB));
      assert.notEqual(resolvedFromB, authorA,
          'holding a different token must not yield author A\'s id');
    });

    it('fails closed (null) when no token cookie is present', async function () {
      assert.equal(await epComments.authorIdForSocket({request: {headers: {}}}), null);
      assert.equal(await epComments.authorIdForSocket({}), null);
    });

    it('a spoofed authorId cannot delete another author\'s comment (end to end)',
        async function () {
          settings.ep_comments_page = {};
          // Author A (identified by token A) owns the comment.
          const tokenA = `t.${common.randomString()}`;
          const authorA = await authorManager.getAuthorId(tokenA, {});
          const padId = 'ep_comments_test_token_authz';
          const [commentId] =
              await commentManager.addComment(padId, {author: authorA, text: 'hello'});

          // Attacker holds token B but tries to act as author A. The server
          // resolves the *attacker's* author from their cookie, ignoring any
          // client-claimed authorId, so the delete is rejected.
          const tokenB = `t.${common.randomString()}`;
          const attackerAuthor = await epComments.authorIdForSocket(socketWithToken(tokenB));
          await assert.rejects(
              commentManager.deleteComment(padId, commentId, attackerAuthor), /unauth/);

          // Author A (resolved from token A) can delete their own comment.
          const ownerAuthor = await epComments.authorIdForSocket(socketWithToken(tokenA));
          assert.equal(ownerAuthor, authorA);
          await commentManager.deleteComment(padId, commentId, ownerAuthor);
        });
  });
});
