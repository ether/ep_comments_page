import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

test.describe('ep_comments_page - New comment', () => {
  test('new comment button focuses on comment textarea', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('commented text');
    await inner.locator('div').first().click({clickCount: 3});

    await page.locator('.addComment').click();

    // The textarea must be the active element in the chrome document.
    const isFocused = await page.evaluate(() => {
      const ta = document.querySelector<HTMLTextAreaElement>(
          '#newComment .comment-content');
      return !!ta && document.activeElement === ta;
    });
    expect(isFocused).toBe(true);
  });
});
