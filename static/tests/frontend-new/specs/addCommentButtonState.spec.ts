import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #96: the toolbar "Add comment" button should look unavailable when there is
// no selection (commenting needs selected text) and become available once text
// is selected. While disabled it must also not be activatable (an aria-disabled
// control must not open the form on click/keyboard). This spec checks the visual
// state toggles with the selection AND that activation is blocked while disabled.
test.describe('ep_comments_page - Add-comment button state (#96)', () => {
  test('button is disabled-looking with no selection, enabled with one',
      async ({page}) => {
        test.setTimeout(60_000);
        await aNewCommentsPad(page);
        const inner = await getPadBody(page);
        const addBtn = page.locator('.addComment');

        await inner.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.type('hello world');

        // After typing, the caret is collapsed → button looks disabled.
        await expect.poll(async () =>
          addBtn.first().evaluate((el) =>
            el.classList.contains('comment-btn-disabled'))).toBe(true);

        // Select all → button becomes available.
        await page.keyboard.press('Control+A');
        await expect.poll(async () =>
          addBtn.first().evaluate((el) =>
            el.classList.contains('comment-btn-disabled'))).toBe(false);
        expect(await addBtn.first().getAttribute('aria-disabled')).toBe('false');

        // Collapse the selection again → back to disabled-looking.
        await page.keyboard.press('ArrowRight');
        await expect.poll(async () =>
          addBtn.first().evaluate((el) =>
            el.classList.contains('comment-btn-disabled'))).toBe(true);
      });

  test('clicking the disabled button does not open the new-comment form',
      async ({page}) => {
        test.setTimeout(60_000);
        await aNewCommentsPad(page);
        const inner = await getPadBody(page);
        const addBtn = page.locator('.addComment');
        const newCommentForm = page.locator('.new-comment-popup, #newComment');

        await inner.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.type('hello world');
        await page.keyboard.press('ArrowRight'); // collapse selection

        // Disabled (no selection).
        await expect.poll(async () =>
          addBtn.first().evaluate((el) =>
            el.classList.contains('comment-btn-disabled'))).toBe(true);

        // Activating it must NOT reveal the new-comment form.
        await addBtn.first().dispatchEvent('click');
        await page.waitForTimeout(500);
        await expect(newCommentForm).toBeHidden();

        // With a selection the same activation DOES open the form.
        await page.keyboard.press('Control+A');
        await expect.poll(async () =>
          addBtn.first().evaluate((el) =>
            el.classList.contains('comment-btn-disabled'))).toBe(false);
        await addBtn.first().dispatchEvent('click');
        await expect(newCommentForm.first()).toBeVisible({timeout: 5_000});
      });
});
