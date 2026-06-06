import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #217: in a high-contrast / forced-colors environment the inline comment
// highlight (a fixed yellow fill with dark text) is discarded by the UA, so
// commented text becomes indistinguishable from the rest of the document.
// The CSS now re-asserts the highlight with the system "marked text" colour
// pair under `@media (forced-colors: active)`. This spec drives Chromium's
// forced-colors emulation and verifies the highlight survives.
test.describe('ep_comments_page - High contrast / forced colors (#217)', () => {
  test('comment highlight stays visible under forced-colors', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);

    // Create a comment on real typed text.
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('commented text');
    await inner.locator('div').first().click({clickCount: 3});
    await page.locator('.addComment').click();
    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await page.locator('#newComment textarea.comment-content').fill('A comment');
    await page.locator('#comment-create-btn').click();

    const commentSpan = inner.locator('div').first().locator('.comment').first();
    await expect.poll(async () => commentSpan.count()).toBeGreaterThan(0);

    // Turn on forced-colors emulation (Windows High Contrast Mode equivalent).
    await page.emulateMedia({forcedColors: 'active'});

    const style = await commentSpan.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        color: cs.color,
        forcedColorAdjust: cs.forcedColorAdjust || (cs as any).getPropertyValue?.(
            'forced-color-adjust'),
      };
    });

    // Our forced-colors rule opts back into author colours...
    expect(style.forcedColorAdjust).toBe('none');
    // ...and keeps a real (non-transparent) highlight fill so commented text
    // remains distinguishable instead of blending into the page.
    expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.background).not.toBe('transparent');
    // The highlight background and its text must not collapse to the same
    // colour (which would make the text invisible).
    expect(style.background).not.toBe(style.color);
  });
});
