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
  reopenCommentsPadAsFreshUser,
  setPadLines,
  waitForCommentOnLine,
} from '../helper/comments';

const textOfComment = 'original comment';
const textOfReply = 'original reply';
const FIRST_LINE = 0;

test.describe('ep_comments_page - Comment Edit', () => {
  let padId: string;

  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    padId = await aNewCommentsPad(page);
    await enlargeScreen(page);
    await setPadLines(page, ['something', ' anything']);
    await addCommentToLine(page, FIRST_LINE, textOfComment);
    await addReplyToLine(page, FIRST_LINE, textOfReply);
  });

  test.describe('when user presses the button edit on a comment', () => {
    test('should add a comment form', async ({page}) => {
      const outer = await getPadOuter(page);
      await outer.locator('.comment-edit').first().click();
      await expect(outer.locator('.comment-edit-form')).toHaveCount(1);
    });

    test('should show the original comment text on the edit form', async ({page}) => {
      const outer = await getPadOuter(page);
      await outer.locator('.comment-edit').first().click();
      await expect(outer.locator('.comment-edit-form .comment-edit-text').first())
          .toHaveText(textOfComment);
    });

    test('and presses edit button again should not add a new form', async ({page}) => {
      const outer = await getPadOuter(page);
      await outer.locator('.comment-edit').first().click();
      await outer.locator('.comment-edit').first().click();
      await expect(outer.locator('.comment-edit-form')).toHaveCount(1);
    });

    test('and presses cancel should remove the edit form', async ({page}) => {
      const outer = await getPadOuter(page);
      await outer.locator('.comment-edit').first().click();
      await outer.locator('.comment-edit-form .comment-edit-cancel').first().click();
      await expect(outer.locator('.comment-edit-form')).toHaveCount(0);
    });

    test('and writes a new comment text and presses save should update the comment text',
        async ({page}) => {
          const outer = await getPadOuter(page);
          const updatedText = 'this comment was edited';
          await outer.locator('.comment-edit').first().click();
          // Set the new text in the contenteditable edit area.
          await outer.locator('.comment-edit-form .comment-edit-text').first()
              .evaluate((el, t) => { (el as HTMLElement).innerText = t; }, updatedText);
          await outer.locator('.comment-edit-form .comment-edit-submit').first().click();
          await expect.poll(async () =>
            (await outer.locator('.comment-text').first().textContent())?.trim())
              .toBe(updatedText);
        });

    test('and reloads the page shows the comment text updated', async ({page}) => {
      const outer = await getPadOuter(page);
      const updatedText = 'this comment was edited';
      await outer.locator('.comment-edit').first().click();
      await outer.locator('.comment-edit-form .comment-edit-text').first()
          .evaluate((el, t) => { (el as HTMLElement).innerText = t; }, updatedText);
      await outer.locator('.comment-edit-form .comment-edit-submit').first().click();
      await expect.poll(async () =>
        (await outer.locator('.comment-text').first().textContent())?.trim())
          .toBe(updatedText);

      // Allow time for the change to be persisted, then reload.
      await page.waitForTimeout(1000);
      await reopenCommentsPad(page, padId);
      const outer2 = await getPadOuter(page);
      await expect.poll(async () =>
        (await outer2.locator('.comment-text').first().textContent())?.trim(),
      {timeout: 20_000}).toBe(updatedText);
    });

    test('new user tries editing should not update the comment text', async ({page}) => {
      const updatedText2 = 'this comment was edited again';
      await page.waitForTimeout(500);
      // Reopen with cleared cookies / storage so Etherpad allocates a new
      // authorId — otherwise the edit-auth check sees the original author
      // and the test's "should not update" assertion is silently bypassed.
      await reopenCommentsPadAsFreshUser(page, padId);
      const outer = await getPadOuter(page);
      // Wait for the comment marker to re-attach in the inner pad before
      // resolving its id; right after reopen the .comment span hasn't
      // necessarily been re-applied yet.
      const commentId = await waitForCommentOnLine(page, FIRST_LINE);
      // After a fresh load the sidebar comment is collapsed; expand it so
      // .comment-edit becomes visible.
      await expandSidebarComment(page, commentId);
      await expect.poll(async () =>
        outer.locator('#comments .comment-edit').count()).toBeGreaterThan(0);

      await outer.locator('.comment-edit').first().click();
      await outer.locator('.comment-edit-form .comment-edit-text').first()
          .evaluate((el, t) => { (el as HTMLElement).innerText = t; }, updatedText2);
      await outer.locator('.comment-edit-form .comment-edit-submit').first().click();

      // Error gritter is shown.
      await expect.poll(async () =>
        page.locator('#gritter-container .error').count()).toBeGreaterThan(0);
      // Comment text is not the new text.
      const got = (await outer.locator('.comment-text').first().textContent())?.trim();
      expect(got).not.toBe(updatedText2);
    });
  });
});
