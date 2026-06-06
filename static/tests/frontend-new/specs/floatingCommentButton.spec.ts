import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #95: a floating "add comment" button appears next to the selection and opens
// the new-comment form, so users don't have to reach for the toolbar. It is
// anchored to the text (not the sidebar) so it also works on narrow viewports.
test.describe('ep_comments_page - Floating add-comment button (#95)', () => {
  test('appears on selection, opens the form, and stays on-screen', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const visibleFab = page.locator('.floating-add-comment.visible');

    // No selection yet → button not visible.
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('please comment on this text');
    await expect.poll(async () => visibleFab.count()).toBe(0);

    // Select the text → button becomes visible and within the viewport.
    await page.keyboard.press('Control+A');
    await expect.poll(async () => visibleFab.count()).toBeGreaterThan(0);

    const box = await visibleFab.boundingBox();
    const vp = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && vp) {
      expect(box.x).toBeGreaterThanOrEqual(-2);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2);
    }

    // Clicking it opens the new-comment form and hides the button.
    await visibleFab.click();
    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await expect.poll(async () => visibleFab.count()).toBe(0);
  });
});
