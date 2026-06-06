'use strict';

// #222: comment edit/delete permissions are configurable. By default only the
// original author may edit/delete a comment (restrictive, from #163); setting
// `ep_comments_page.allowAnyoneToEditComments` switches to a permissive model.
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const commentManager = require('ep_comments_page/commentManager');

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
});
