import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  addCommentToLine,
  addReplyToLine,
  aNewCommentsPad,
  enlargeScreen,
  expandSidebarComment,
  reopenCommentsPadAsFreshUser,
  setPadLines,
  waitForCommentOnLine,
} from '../helper/comments';

const textOfComment = 'original comment';
const textOfReply = 'original reply';
const FIRST_LINE = 0;

test.describe('ep_comments_page - Comment Delete', () => {
  let padId: string;

  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    padId = await aNewCommentsPad(page);
    await enlargeScreen(page);
    await setPadLines(page, ['something', ' anything']);
    await addCommentToLine(page, FIRST_LINE, textOfComment);
    await addReplyToLine(page, FIRST_LINE, textOfReply);
  });

  test.describe('when user presses the delete button on a comment', () => {
    test('should delete comment', async ({page}) => {
      const outer = await getPadOuter(page);
      const inner = await getPadBody(page);
      await outer.locator('.comment-delete').first().click();
      await expect.poll(async () => inner.locator('.comment').count()).toBe(0);
    });
  });

  test.describe('when viewing another user\'s comment', () => {
    test('the delete action is hidden so the comment cannot be removed',
        async ({page}) => {
          // The plugin enforces "only the author can delete" at the UI
          // layer: insertComment() in static/js/index.js adds a `hidden`
          // class to .comment-actions-wrapper whenever
          // comment.author !== clientVars.userId. Re-open with cleared
          // cookies / storage so Etherpad allocates a new authorId, then
          // assert the delete button is unreachable.
          await page.waitForTimeout(500);
          await reopenCommentsPadAsFreshUser(page, padId);
          await enlargeScreen(page);

          const outer = await getPadOuter(page);
          const inner = await getPadBody(page);
          const commentId = await waitForCommentOnLine(page, FIRST_LINE);
          await expandSidebarComment(page, commentId);

          // The actions wrapper for this comment carries the `hidden`
          // class, so its child .comment-delete is not visible.
          const wrapper = outer.locator(
              `#${commentId} .comment-actions-wrapper`).first();
          await expect.poll(async () => wrapper.evaluate(
              (el) => el.classList.contains('hidden'))).toBe(true);
          expect(await outer.locator(`#${commentId} .comment-delete`).first()
              .isVisible()).toBe(false);

          // Comment is still intact in the editor.
          expect(await inner.locator('.comment').count()).toBeGreaterThan(0);
        });
  });
});
