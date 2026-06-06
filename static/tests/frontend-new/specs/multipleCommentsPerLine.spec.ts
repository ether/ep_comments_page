import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #181 (ether/etherpad-lite#4627): two comments on the same line both aligned
// their sidebar box to the same Y, so the boxes overlapped and one became
// hidden / unclickable. setYofComments now de-overlaps boxes that share a line.
test.describe('ep_comments_page - Multiple comments on one line (#181)', () => {
  test('sidebar boxes for same-line comments do not overlap', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);
    const line = inner.locator('div').first();

    const addCommentForSelection = async (text: string) => {
      await page.locator('.addComment').click();
      await expect(page.locator('#newComment.popup-show')).toBeVisible();
      await page.locator('#newComment textarea.comment-content').fill(text);
      await page.locator('#comment-create-btn').click();
      // The create popup closes once the comment is committed.
      await expect(page.locator('#newComment.popup-show')).toBeHidden();
    };

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('hello world');

    // Select "hello" (first 5 chars) and comment it.
    await line.click();
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
    await addCommentForSelection('comment on hello');

    // Re-focus the editor (the create popup stole focus), then select "world".
    await line.click();
    await page.keyboard.press('End');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
    await addCommentForSelection('comment on world');

    // Both comments keep their own inline highlight on the one line...
    await expect.poll(async () => line.locator('.comment').count()).toBeGreaterThanOrEqual(2);
    // ...and each has its own sidebar box.
    const boxes = outer.locator('#comments .sidebar-comment');
    await expect.poll(async () => boxes.count()).toBe(2);

    const rects = await boxes.evaluateAll((els) =>
      els.map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return {top: r.top, bottom: r.bottom, height: r.height};
      }));
    rects.sort((a, b) => a.top - b.top);

    // The boxes must be stacked, not piled on the same Y: the lower box must
    // start at (or below) the upper box's bottom, with a little tolerance.
    const tolerance = 4;
    expect(rects[0].height).toBeGreaterThan(0);
    expect(rects[1].height).toBeGreaterThan(0);
    expect(rects[1].top).toBeGreaterThanOrEqual(rects[0].bottom - tolerance);
  });
});
