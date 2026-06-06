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
    await open.locator('.comment-nav-next').dispatchEvent('click');
    await expect.poll(async () => {
      const t = await outer.locator('#comments .sidebar-comment.full-display').first()
          .textContent();
      return (t || '').includes('COMMENT_BETA');
    }).toBe(true);
    expect(await outer.locator('#comments .sidebar-comment.full-display').count()).toBe(1);

    // Prev → back to the first comment.
    await outer.locator('#comments .sidebar-comment.full-display .comment-nav-prev').dispatchEvent('click');
    await expect.poll(async () => {
      const t = await outer.locator('#comments .sidebar-comment.full-display').first()
          .textContent();
      return (t || '').includes('COMMENT_ALPHA');
    }).toBe(true);
  });

  // #6 follow-up: the arrows render as the ‹ / › glyph only, not a full text
  // label. The localized label html10n writes into the element is clipped and
  // made transparent by CSS (kept as the accessible name), so the controls are
  // compact icons rather than "Previous comment" / "Next comment" text.
  test('arrows show a glyph and a localized accessible name, not a text label',
      async ({page}) => {
        test.setTimeout(60_000);
        await aNewCommentsPad(page);
        const inner = await getPadBody(page);
        const outer = await getPadOuter(page);
        await inner.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.type('a commented word');
        await addCommentOnLine(page, 0, 'NAV_LABEL');
        await inner.locator('div').first().locator('.comment').first().click();
        const navNext = outer.locator('#comments .sidebar-comment.full-display .comment-nav-next')
            .first();
        await expect.poll(async () => navNext.count()).toBeGreaterThan(0);
        // Only the ‹ / › glyph is visible: the localized label html10n writes is
        // clipped and transparent (kept as the accessible name), so the arrows are
        // compact icons, not a "Next comment" text label.
        expect(await navNext.evaluate((el) => getComputedStyle(el).color)).toBe('rgba(0, 0, 0, 0)');
        const accessibleName = (await navNext.getAttribute('aria-label')) ||
          (await navNext.getAttribute('title'));
        expect(accessibleName).toBeTruthy();
      });

  // #6 follow-up: navigating on a narrow/mobile viewport (sidebar hidden, comments
  // shown in a modal) must not throw "Cannot read properties of undefined
  // (reading 'clientX')".
  test('navigating does not throw on a narrow viewport', async ({page}) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({width: 360, height: 720});
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('alpha bravo');
    await addCommentOnLine(page, 0, 'M_ALPHA');
    // second comment on same line (select last word)
    await inner.locator('div').first().click();
    await page.keyboard.press('End');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.locator('.addComment').click();
    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await page.locator('#newComment textarea.comment-content').fill('M_BRAVO');
    await page.locator('#comment-create-btn').click();
    await expect(page.locator('#newComment.popup-show')).toBeHidden();

    // Open a comment as a modal and click next.
    await inner.locator('div').first().locator('.comment').first().click();
    const modalNext = outer.locator('.comment-modal .comment-nav-next');
    await expect.poll(async () => modalNext.count()).toBeGreaterThan(0);
    await modalNext.first().click();
    await page.waitForTimeout(300);
    expect(errors.join('\n')).not.toContain('clientX');
  });
});

const addCommentOnLine = async (
  page: import('@playwright/test').Page, lineIndex: number, text: string,
) => {
  const inner = await getPadBody(page);
  await expect.poll(async () => {
    await inner.locator('div').nth(lineIndex).click({clickCount: 3});
    await page.locator('.addComment').click();
    return page.locator('#newComment.popup-show').count();
  }, {timeout: 20_000}).toBeGreaterThan(0);
  await page.locator('#newComment textarea.comment-content').fill(text);
  await page.locator('#comment-create-btn').click();
  await expect(page.locator('#newComment.popup-show')).toBeHidden();
};
