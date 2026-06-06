import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #241: prev/next arrows on an open comment box step to the adjacent comment,
// so a reviewer doesn't have to hover precisely between neighbouring comments.
test.describe('ep_comments_page - Comment navigation arrows (#241)', () => {
  test('next/prev arrows move between comments', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);

    const addCommentOnLine = async (lineIndex: number, text: string) => {
      await expect.poll(async () => {
        await inner.locator('div').nth(lineIndex).click({clickCount: 3});
        await page.locator('.addComment').click();
        return page.locator('#newComment.popup-show').count();
      }, {timeout: 20_000}).toBeGreaterThan(0);
      await page.locator('#newComment textarea.comment-content').fill(text);
      await page.locator('#comment-create-btn').click();
      await expect(page.locator('#newComment.popup-show')).toBeHidden();
    };

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('first line here');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second line here');

    await addCommentOnLine(0, 'COMMENT_ALPHA');
    await addCommentOnLine(1, 'COMMENT_BETA');

    // Open the first comment by clicking its inline highlight.
    await inner.locator('div').nth(0).locator('.comment').first().click();
    const open = outer.locator('#comments .sidebar-comment.full-display');
    await expect.poll(async () => open.count()).toBe(1);
    await expect(open).toContainText('COMMENT_ALPHA');

    // Next → second comment opens.
    await open.locator('.comment-nav-next').click();
    await expect.poll(async () => {
      const t = await outer.locator('#comments .sidebar-comment.full-display').first()
          .textContent();
      return (t || '').includes('COMMENT_BETA');
    }).toBe(true);
    expect(await outer.locator('#comments .sidebar-comment.full-display').count()).toBe(1);

    // Prev → back to the first comment.
    await outer.locator('#comments .sidebar-comment.full-display .comment-nav-prev').click();
    await expect.poll(async () => {
      const t = await outer.locator('#comments .sidebar-comment.full-display').first()
          .textContent();
      return (t || '').includes('COMMENT_ALPHA');
    }).toBe(true);
  });
});
