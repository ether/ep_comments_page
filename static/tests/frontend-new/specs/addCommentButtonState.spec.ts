import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #96: the toolbar "Add comment" button should look unavailable when there is
// no selection (commenting needs selected text) and become available once text
// is selected. The button stays clickable (falls back to a hint) so it can
// never wedge; this spec checks the visual state toggles with the selection.
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
});
