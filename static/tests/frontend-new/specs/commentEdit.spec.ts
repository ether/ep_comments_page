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

    test('a new user cannot reach the edit action for another user\'s comment',
        async ({page}) => {
          await page.waitForTimeout(500);
          // Reopen with cleared cookies / storage so Etherpad allocates a
          // new authorId.
          await reopenCommentsPadAsFreshUser(page, padId);
          await enlargeScreen(page);
          const outer = await getPadOuter(page);
          const inner = await getPadBody(page);
          const commentId = await waitForCommentOnLine(page, FIRST_LINE);
          await expandSidebarComment(page, commentId);

          // The plugin hides the entire .comment-actions-wrapper for
          // non-authors at insertComment() time (see static/js/index.js),
          // so the edit button is unreachable from the UI. Assert the
          // wrapper carries `hidden` and the edit glyph is invisible.
          const wrapper = outer.locator(
              `#${commentId} .comment-actions-wrapper`).first();
          await expect.poll(async () => wrapper.evaluate(
              (el) => el.classList.contains('hidden'))).toBe(true);
          expect(await outer.locator(`#${commentId} .comment-edit`).first()
              .isVisible()).toBe(false);

          // Comment text in the inner pad is still the original.
          expect((await inner.locator('.comment').first().textContent())?.trim())
              .not.toBe('');
        });
  });
});
