import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #192: on small / mobile viewports the comment sidebar is hidden and comments
// open in a floating ".comment-modal" instead. The modal was positioned with
// only a right-edge guard, so it spilled off-screen (the reported iPad bug).
// This spec uses a narrow viewport to take the modal path and asserts the popup
// stays fully within the viewport. Rather than hard-coding the sidebar
// breakpoint, it asserts the sidebar is actually hidden first, so the test
// fails loudly (instead of silently exercising the sidebar path) if the
// breakpoint ever changes.
test.describe('ep_comments_page - Mobile comment popup (#192)', () => {
  const VIEWPORT = {width: 320, height: 700};
  test.use({viewport: VIEWPORT});

  test('comment modal stays within the viewport', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);

    // A long unbreakable comment is the realistic trigger: on a narrow screen
    // the cloned box would grow past the viewport (no wrapping / no width cap),
    // which is when the old right-only clamp placed it off-screen.
    const longComment = 'ThisIsAnExtremelyLongUnbreakableCommentStringWithoutAnySpaces' +
      'ThatWouldOtherwiseStretchTheModalWayBeyondTheEdgeOfANarrowPhoneScreen';

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('A passage that will be commented on the phone');
    await inner.locator('div').first().click({clickCount: 3});
    await page.locator('.addComment').click();
    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await page.locator('#newComment textarea.comment-content').fill(longComment);
    await page.locator('#comment-create-btn').click();

    const commentSpan = inner.locator('div').first().locator('.comment').first();
    await expect.poll(async () => commentSpan.count()).toBeGreaterThan(0);

    // Precondition: the sidebar must be hidden at this viewport so that
    // highlightComment takes the modal branch. Assert it explicitly so a
    // breakpoint change surfaces as a clear failure here rather than silently
    // exercising the sidebar path.
    await expect(outer.locator('#comments')).toBeHidden();

    // Tap the commented text to open the floating modal.
    await commentSpan.click();

    const modal = outer.locator('.comment-modal.popup-show');
    await expect(modal).toBeVisible();

    // The modal must be fully on screen: not past the left edge, not past the
    // right edge. boundingBox() is relative to the top-level viewport.
    const box = await modal.boundingBox();
    expect(box).not.toBeNull();
    const tolerance = 2;
    expect(box!.x).toBeGreaterThanOrEqual(-tolerance);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORT.width + tolerance);
    // And it should have a real width (not collapsed).
    expect(box!.width).toBeGreaterThan(0);
  });
});
