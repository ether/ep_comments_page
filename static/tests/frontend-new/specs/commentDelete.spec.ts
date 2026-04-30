import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  addCommentToLine,
  addReplyToLine,
  aNewCommentsPad,
  enlargeScreen,
  expandSidebarComment,
  reopenCommentsPad,
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

  test.describe('when user presses the delete button on other users comment', () => {
    test('should not delete comment', async ({page}) => {
      // Reload as a fresh user — re-opens the same pad and waits for plugin init.
      await page.waitForTimeout(500);
      await reopenCommentsPad(page, padId);

      const outer = await getPadOuter(page);
      const inner = await getPadBody(page);
      // Wait for the comment marker to re-attach in the inner pad before
      // resolving its id; right after reopen the .comment span hasn't
      // necessarily been re-applied yet.
      const commentId = await waitForCommentOnLine(page, FIRST_LINE);
      // After a fresh load the sidebar comment is collapsed; expand it so
      // .comment-delete becomes visible.
      await expandSidebarComment(page, commentId);
      await expect.poll(async () => outer.locator('.comment-delete').count())
          .toBeGreaterThan(0);
      await outer.locator('.comment-delete').first().click();

      // Error gritter shown.
      await expect.poll(async () =>
        page.locator('#gritter-container .error').count()).toBeGreaterThan(0);
      // Comment was not deleted.
      expect(await inner.locator('.comment').count()).toBeGreaterThan(0);
    });
  });
});
